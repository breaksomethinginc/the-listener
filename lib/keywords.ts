// Turns a plain-English subject into a starting keyword bundle and a set
// of working sources. The user can edit everything afterwards — this is
// just a sensible default so a new listener works on the first run.

import type { FeedSource, KeywordBundle, ListenerMode } from "./types";

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

function makeSlug(q: string): string {
  return (
    q.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) ||
    "listener"
  );
}

/** News-style defaults: text + RSS + social search. (Original behavior.) */
function suggestNewsSources(q: string): FeedSource[] {
  const enc = encodeURIComponent(q);
  const slug = makeSlug(q);

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
      id: `masto-${slug}`,
      label: `Mastodon #${slug} (mastodon.social)`,
      url: `#${slug}`,
      platform: "mastodon",
      enabled: true,
      trustWeight: 0.7,
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

/**
 * Video-style defaults: surface videos of people talking about the subject
 * across YouTube, TikTok, Instagram, and Facebook. Covers hashtags,
 * keyword search, and named handles (left as a placeholder so the user
 * can fill in specific creators they care about).
 */
function suggestVideoSources(q: string): FeedSource[] {
  const slug = makeSlug(q);

  return [
    // 1. Keyword search across YouTube — works with YOUTUBE_API_KEY or APIFY_TOKEN.
    {
      id: `yt-search-${slug}`,
      label: `YouTube search — "${q}"`,
      url: q,
      platform: "youtube",
      enabled: true,
      trustWeight: 1,
    },
    // 2. YouTube handle slot — disabled, user fills in a creator/channel.
    {
      id: `yt-handle-${slug}`,
      label: `YouTube channel — add an @handle`,
      url: "",
      platform: "youtube",
      enabled: false,
      trustWeight: 1,
    },
    // 3. TikTok hashtag — needs APIFY_TOKEN.
    {
      id: `tt-tag-${slug}`,
      label: `TikTok #${slug}`,
      url: `#${slug}`,
      platform: "tiktok",
      enabled: true,
      trustWeight: 0.9,
    },
    // 4. TikTok handle slot — disabled, user fills in a creator.
    {
      id: `tt-handle-${slug}`,
      label: `TikTok creator — add an @handle`,
      url: "",
      platform: "tiktok",
      enabled: false,
      trustWeight: 1,
    },
    // 5. Instagram hashtag — needs APIFY_TOKEN. Pulls Reels + posts.
    {
      id: `ig-tag-${slug}`,
      label: `Instagram #${slug}`,
      url: `#${slug}`,
      platform: "instagram",
      enabled: true,
      trustWeight: 0.9,
    },
    // 6. Instagram handle slot.
    {
      id: `ig-handle-${slug}`,
      label: `Instagram account — add an @handle`,
      url: "",
      platform: "instagram",
      enabled: false,
      trustWeight: 1,
    },
    // 7. Facebook page slot — Facebook has no public search; user must
    //    point at a specific page they want to follow.
    {
      id: `fb-page-${slug}`,
      label: `Facebook page — add a page URL`,
      url: "",
      platform: "facebook",
      enabled: false,
      trustWeight: 0.8,
    },
  ];
}

/**
 * Build a default set of sources for a subject.
 * - `news`  (default): broad news + social-search coverage, zero-key.
 * - `video`: YouTube / TikTok / Instagram / Facebook discovery.
 */
export function suggestSources(
  subject: string,
  mode: ListenerMode = "news",
): FeedSource[] {
  const q = subject.trim() || "news";
  return mode === "video" ? suggestVideoSources(q) : suggestNewsSources(q);
}
