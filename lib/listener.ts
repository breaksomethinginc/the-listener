// Helpers for creating and validating Listener objects from raw input
// (API request bodies, the create/edit form, etc.).

import type { FeedSource, KeywordBundle, Listener, Platform } from "./types";

const PLATFORMS: Platform[] = [
  "rss", "atom", "json", "youtube", "rumble", "x", "twitter", "truth",
  "truthsocial", "substack", "reddit", "bluesky", "discord", "mastodon",
  "instagram", "tiktok", "facebook", "threads", "apify", "brave",
];

export function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function emptyKeywords(): KeywordBundle {
  return { any: [], boost: [], veto: [] };
}

/** Accept either a string[] or a comma-separated string. */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    return v.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeKeywords(v: any): KeywordBundle {
  const k = v || {};
  return { any: toList(k.any), boost: toList(k.boost), veto: toList(k.veto) };
}

export function normalizeSources(v: any): FeedSource[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s: any, i: number): FeedSource => {
      const platform: Platform = PLATFORMS.includes(s?.platform)
        ? s.platform
        : "rss";
      const trust = Number(s?.trustWeight);
      return {
        id: String(s?.id || `src-${i}-${genId()}`),
        label: String(s?.label || s?.url || "Source").slice(0, 140),
        url: String(s?.url || "").trim(),
        platform,
        enabled: s?.enabled !== false,
        trustWeight: Number.isFinite(trust) ? Math.max(0, Math.min(2, trust)) : 1,
        apifyActor: s?.apifyActor ? String(s.apifyActor) : undefined,
        apifyInput:
          s?.apifyInput && typeof s.apifyInput === "object"
            ? s.apifyInput
            : undefined,
      };
    })
    .filter((s: FeedSource) => s.url.length > 0);
}

/** Build a fresh Listener from a raw request body. */
export function makeListener(body: any): Listener {
  const now = new Date().toISOString();
  return {
    id: genId(),
    name: String(body?.name || "Untitled listener").slice(0, 140),
    subject: String(body?.subject || "").slice(0, 200),
    keywords: normalizeKeywords(body?.keywords),
    sources: normalizeSources(body?.sources),
    createdAt: now,
    updatedAt: now,
  };
}

/** Apply an edit to an existing listener, preserving id / timestamps / results. */
export function applyEdit(existing: Listener, body: any): Listener {
  return {
    ...existing,
    name: String(body?.name ?? existing.name).slice(0, 140),
    subject: String(body?.subject ?? existing.subject).slice(0, 200),
    keywords: body?.keywords
      ? normalizeKeywords(body.keywords)
      : existing.keywords,
    sources: body?.sources
      ? normalizeSources(body.sources)
      : existing.sources,
    updatedAt: new Date().toISOString(),
  };
}
