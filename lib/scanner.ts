// The scoring engine + runScan() orchestrator.
// One Listener in, one ranked ScanResult out.

import { loadConfig, type ListenerConfig } from "./config";
import { fetchAllSources } from "./sources";
import type { CandidateItem, KeywordBundle, Listener, ScanResult } from "./types";

interface Scored {
  score: number;
  matched: string[];
}

/**
 * Score one item against a keyword bundle.
 *   +10  per `any` keyword present   (≥1 required)
 *   +5   per `boost` keyword present
 *   veto keyword present  → score 0 (disqualified)
 *   +6   published < 24h ago,  +3 if < 72h ago
 */
export function scoreItem(item: CandidateItem, kw: KeywordBundle): Scored {
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();

  for (const v of kw.veto) {
    if (v && text.includes(v.toLowerCase())) return { score: 0, matched: [] };
  }

  const matched: string[] = [];
  let base = 0;

  for (const a of kw.any) {
    if (a && text.includes(a.toLowerCase())) {
      base += 10;
      matched.push(a);
    }
  }
  if (base === 0) return { score: 0, matched: [] };

  for (const b of kw.boost) {
    if (b && text.includes(b.toLowerCase())) {
      base += 5;
      matched.push(b);
    }
  }

  const ageHours = (Date.now() - new Date(item.publishedAt).getTime()) / 3.6e6;
  let recency = 0;
  if (ageHours >= 0 && ageHours < 24) recency = 6;
  else if (ageHours >= 0 && ageHours < 72) recency = 3;

  return { score: base + recency, matched };
}

function dedupeTerms(terms: string[]): string[] {
  return Array.from(new Set(terms));
}

/** Score, filter, multiply by trust weight, de-dupe by URL, sort. */
export function rankCandidates(
  items: CandidateItem[],
  kw: KeywordBundle,
  trustById: Record<string, number>,
): CandidateItem[] {
  const scored: CandidateItem[] = [];

  for (const it of items) {
    const { score, matched } = scoreItem(it, kw);
    if (score <= 0) continue;
    const trust =
      (it.sourceId && trustById[it.sourceId] !== undefined
        ? trustById[it.sourceId]
        : 1) ?? 1;
    scored.push({
      ...it,
      score: Math.round(score * trust),
      matchedTerms: dedupeTerms(matched),
    });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
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

  const ranked = rankCandidates(candidates, listener.keywords, trustById);

  return {
    ranAt: new Date().toISOString(),
    fetchedFrom: sources.map((s) => s.id),
    candidates,
    errors,
    ranked,
  };
}
