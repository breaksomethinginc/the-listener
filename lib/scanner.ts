// The scoring engine + runScan() orchestrator.
// One Listener in, one ranked ScanResult out.

import { loadConfig, type ListenerConfig } from "./config";
import { fetchAllSources } from "./sources";
import type { CandidateItem, KeywordBundle, Listener, ScanResult } from "./types";

interface Scored {
  /** Relevance score — used as the filter (must be > 0 to display). */
  relevance: number;
  matched: string[];
}

/**
 * Viral score (0–100). Combines reach (views, log-scaled), engagement
 * rate (likes/views and comments/views), and recency. Items without
 * engagement data degrade gracefully to a recency-based score so RSS
 * articles still get a sensible number rather than 0.
 */
export function viralScore(item: CandidateItem): number {
  const v = typeof item.views === "number" && item.views > 0 ? item.views : 0;
  const l = typeof item.likes === "number" && item.likes > 0 ? item.likes : 0;
  const c =
    typeof item.commentCount === "number" && item.commentCount > 0
      ? item.commentCount
      : 0;

  let score = 0;

  if (v > 0) {
    // Reach: log10 spreads the wide range of view counts into a usable
    // 0–70 band. 1k=30, 10k=40, 100k=50, 1M=60, 10M=70.
    score += Math.min(70, Math.log10(v + 1) * 10);
  }

  // Engagement rate (likes / views). Healthy is 1–5%, viral is 5%+.
  if (v > 0 && l > 0) {
    const rate = l / v;
    score += Math.min(20, rate * 200);
  }

  // Comments per view — rarer signal, weighted higher per unit.
  if (v > 0 && c > 0) {
    const rate = c / v;
    score += Math.min(10, rate * 1000);
  }

  // Items without any view data get a recency-only floor — keeps RSS
  // articles in the running rather than pegged at 0.
  if (v === 0) {
    const ageHours = (Date.now() - new Date(item.publishedAt).getTime()) / 3.6e6;
    if (Number.isFinite(ageHours) && ageHours >= 0) {
      if (ageHours < 24) score = 25;
      else if (ageHours < 72) score = 18;
      else if (ageHours < 168) score = 12;
      else score = 6;
    } else {
      score = 8;
    }
  }

  // Recency multiplier for items that DO have engagement data: fresh
  // viral content > old viral content.
  if (v > 0) {
    const ageHours = (Date.now() - new Date(item.publishedAt).getTime()) / 3.6e6;
    if (Number.isFinite(ageHours) && ageHours >= 0) {
      if (ageHours < 24) score *= 1.2;
      else if (ageHours < 72) score *= 1.05;
      else if (ageHours < 168) score *= 0.95;
      else if (ageHours < 720) score *= 0.85;
      else score *= 0.7;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Relevance check against a keyword bundle. Returns a positive number
 * if the item matches (used purely as a filter — items must score > 0
 * to appear). The DISPLAYED score is viralScore(); this function just
 * decides "is this item relevant enough to surface?".
 *
 *   +10 per `any` keyword present   (≥1 required)
 *   +5  per `boost` keyword
 *   veto keyword → 0 (disqualified)
 *   +8  if creator handle matches the subject (video OF them)
 */
export function scoreItem(item: CandidateItem, kw: KeywordBundle): Scored {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();

  for (const v of kw.veto) {
    if (v && text.includes(v.toLowerCase())) {
      return { relevance: 0, matched: [] };
    }
  }

  const matched: string[] = [];
  let base = 0;

  for (const a of kw.any) {
    if (a && text.includes(a.toLowerCase())) {
      base += 10;
      matched.push(a);
    }
  }
  // Also count creator-is-subject as a relevance match — videos by the
  // person themselves are relevant even if title doesn't repeat the name.
  let creatorMatch = false;
  if (item.creator) {
    const c = item.creator.toLowerCase().replace(/^@+/, "").replace(/\s+/g, "");
    for (const a of kw.any) {
      if (!a) continue;
      const needle = a.toLowerCase().replace(/\s+/g, "");
      if (needle.length >= 4 && c.includes(needle)) {
        base += 18; // Strong relevance + "OF them" signal
        matched.push(a);
        creatorMatch = true;
        break;
      }
    }
  }

  if (base === 0) return { relevance: 0, matched: [] };

  for (const b of kw.boost) {
    if (b && text.includes(b.toLowerCase())) {
      base += 5;
      matched.push(b);
    }
  }

  return { relevance: base, matched };
}

function dedupeTerms(terms: string[]): string[] {
  return Array.from(new Set(terms));
}

/** Drop items older than maxAgeDays. Items with unparseable dates pass. */
function applyAgeFilter(
  items: CandidateItem[],
  maxAgeDays: number | undefined,
): CandidateItem[] {
  if (!maxAgeDays || maxAgeDays <= 0) return items;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  return items.filter((it) => {
    const t = new Date(it.publishedAt).getTime();
    if (!Number.isFinite(t)) return true;
    return t >= cutoff;
  });
}

/**
 * Score, filter, multiply by trust weight, de-dupe by URL, sort.
 *
 * `score` on the output items is the **viral score** (0–100) — that's
 * what the UI shows. `relevance` is kept as a secondary field for the
 * curious. Items must clear the relevance filter (>0) to appear.
 */
export function rankCandidates(
  items: CandidateItem[],
  kw: KeywordBundle,
  trustById: Record<string, number>,
  maxAgeDays?: number,
): CandidateItem[] {
  const inWindow = applyAgeFilter(items, maxAgeDays);
  const scored: CandidateItem[] = [];

  for (const it of inWindow) {
    const { relevance, matched } = scoreItem(it, kw);
    if (relevance <= 0) continue;
    const trust =
      (it.sourceId && trustById[it.sourceId] !== undefined
        ? trustById[it.sourceId]
        : 1) ?? 1;
    const viral = viralScore(it);
    // Bias viral score by source trust (a viral clip from a curated
    // news channel slightly outranks the same numbers from an unknown
    // source) but keep it on the 0–100 scale.
    const trustedViral = Math.min(100, Math.round(viral * (0.7 + 0.3 * trust)));
    scored.push({
      ...it,
      score: trustedViral,
      relevance: Math.round(relevance * trust),
      matchedTerms: dedupeTerms(matched),
    });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.relevance ?? 0) - (a.relevance ?? 0) ||
      +new Date(b.publishedAt) - +new Date(a.publishedAt) ||
      // Stable tiebreak so order is deterministic across runs.
      a.id.localeCompare(b.id),
  );

  const seen = new Set<string>();
  const ranked: CandidateItem[] = [];
  for (const it of scored) {
    const key = (it.url || it.id).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(it);
  }
  return ranked;
}

/** Run a full scan for a listener: fetch every enabled source, then rank. */
export async function runScan(
  listener: Listener,
  config?: ListenerConfig,
): Promise<ScanResult> {
  const cfg = config ?? loadConfig();
  const sources = (listener.sources || []).filter((s) => s.enabled);

  const { candidates, errors } = await fetchAllSources(sources, cfg);

  const trustById: Record<string, number> = {};
  for (const s of sources) trustById[s.id] = s.trustWeight ?? 1;

  const ranked = rankCandidates(
    candidates,
    listener.keywords,
    trustById,
    listener.maxAgeDays,
  );

  return {
    ranAt: new Date().toISOString(),
    fetchedFrom: sources.map((s) => s.id),
    candidates,
    errors,
    ranked,
  };
}
