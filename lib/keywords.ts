// Turns a plain-English subject into a starting keyword bundle and a set
// of working sources. The user can edit everything afterwards — this is
// just a sensible default so a new listener works on the first run.

import type { FeedSource, KeywordBundle } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "is", "are",
  "was", "were", "with", "at", "by", "from", "about", "this", "that", "these",
  "those", "new", "news", "latest", "update", "updates", "into", "over",
  "their", "your", "our", "his", "her",
]);

/** Build a starter KeywordBundle from a subject phrase. */
export function suggestKeywords(subject: string): KeywordBundle {
  const s = subject.trim();
  const any: string[] = [];
  if (s) any.push(s);

  const words = s
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  for (const w of words) {
    if (!any.some((x) => x.toLowerCase() === w)) any.push(w);
  }

  return {
    any: any.slice(0, 8),
    boost: ["breaking", "exclusive", "just in", "report", "analysis", "investigation"],
    veto: ["sponsored", "advertisement", "horoscope", "coupon", "giveaway", "promo code"],
  };
}

/**
 * Build a default set of sources for a subject. The first four work with
 * zero API keys; Brave is included disabled (it needs BRAVE_API_KEY).
 */
export function suggestSources(subject: string): FeedSource[] {
  const q = subject.trim() || "news";
  const enc = encodeURIComponent(q);
  const slug =
    q.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) ||
    "listener";

  return [
    {
      id: `gnews-${slug}`,
      label: `Google News — ${q}`,
      url: `https://news.google.com/rss/search?q=${enc}&hl=en-US&gl=US&ceid=US:en`,
      platform: "rss",
      enabled: true,
      trustWeight: 1,
    },
    {
      id: `bing-${slug}`,
      label: `Bing News — ${q}`,
      url: `https://www.bing.com/news/search?q=${enc}&format=rss`,
      platform: "rss",
      enabled: true,
      trustWeight: 1,
    },
    {
      id: `reddit-${slug}`,
      label: `Reddit search — ${q}`,
      url: `https://www.reddit.com/search.json?q=${enc}&sort=new&limit=25`,
      platform: "reddit",
      enabled: true,
      trustWeight: 0.9,
    },
    {
      id: `bsky-${slug}`,
      label: `Bluesky search — ${q}`,
      url: q,
      platform: "bluesky",
      enabled: true,
      trustWeight: 0.8,
    },
    {
      id: `brave-${slug}`,
      label: `Brave News — ${q}  (needs BRAVE_API_KEY)`,
      url: q,
      platform: "brave",
      enabled: false,
      trustWeight: 1,
    },
  ];
}
