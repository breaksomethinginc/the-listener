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

/**
 * Compact, hashtag-safe form of a subject.
 * "Mark Kelly"               → "markkelly"
 * "Mark Kelly footage clips" → "markkelly"      (first 2 meaningful words)
 * "Federal Reserve rates"    → "federalreserve" (stopwords dropped)
 *
 * Hashtags can't contain dashes, spaces, or punctuation, so we strip them
 * and join the first 1–2 meaningful words. Capped at 30 chars.
 */
function makeHashtag(q: string): string {
  const words = q
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return (words.slice(0, 2).join("") || "topic").slice(0, 30);
}

/** News-style defaults: text + RSS + social search. */
function suggestNewsSources(q: string, keys: AvailableKeys): FeedSource[] {
  const enc = encodeURIComponent(q);
  const slug = makeSlug(q);
  const tag = makeHashtag(q);

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
      label: `Mastodon #${tag} (mastodon.social)`,
      url: `#${tag}`,
      platform: "mastodon",
      enabled: true,
      trustWeight: 0.7,
    },
    {
      id: `brave-${slug}`,
      label: keys.brave
        ? `Brave News — ${q}`
        : `Brave News — ${q}  (needs BRAVE_API_KEY)`,
      url: q,
      platform: "brave",
      enabled: keys.brave,
      trustWeight: 1,
    },
  ];
}

/**
 * Video-style defaults: surface videos of people talking about the subject
 * across YouTube, TikTok, Instagram, and Facebook. Covers hashtags,
 * keyword search, and named handles (left as a placeholder so the user
 * can fill in specific creators they care about).
 *
 * Sources that need an API key are only enabled-by-default when the
 * relevant env var is set on the server. Otherwise they're added
 * disabled with a "(needs X)" label so the user knows what to wire up.
 */
function suggestVideoSources(q: string, keys: AvailableKeys): FeedSource[] {
  const slug = makeSlug(q);
  const tag = makeHashtag(q);
  // YouTube search works with either key.
  const ytSearchEnabled = keys.youtube || keys.apify;
  const ytSearchLabel = ytSearchEnabled
    ? `YouTube search — "${q}"`
    : `YouTube search — "${q}"  (needs YOUTUBE_API_KEY or APIFY_TOKEN)`;
  // TikTok / Instagram hashtag scraping needs Apify.
  const apifyMissingSuffix = keys.apify ? "" : "  (needs APIFY_TOKEN)";

  return [
    // 1. Keyword search across YouTube.
    {
      id: `yt-search-${slug}`,
      label: ytSearchLabel,
      url: q,
      platform: "youtube",
      enabled: ytSearchEnabled,
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
    // 3. TikTok hashtag.
    {
      id: `tt-tag-${slug}`,
      label: `TikTok #${tag}${apifyMissingSuffix}`,
      url: `#${tag}`,
      platform: "tiktok",
      enabled: keys.apify,
      trustWeight: 0.9,
    },
    // 4. TikTok handle slot.
    {
      id: `tt-handle-${slug}`,
      label: `TikTok creator — add an @handle`,
      url: "",
      platform: "tiktok",
      enabled: false,
      trustWeight: 1,
    },
    // 5. Instagram hashtag.
    {
      id: `ig-tag-${slug}`,
      label: `Instagram #${tag}${apifyMissingSuffix}`,
      url: `#${tag}`,
      platform: "instagram",
      enabled: keys.apify,
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
    // 7. Facebook page slot — Facebook has no public search.
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
 * Which paid APIs are available on the server right now. Affects which
 * sources get enabled-by-default in autofill (vs. created in a disabled
 * "needs X" state for the user to wire up).
 */
export interface AvailableKeys {
  apify: boolean;
  youtube: boolean;
  brave: boolean;
}

const NO_KEYS: AvailableKeys = { apify: false, youtube: false, brave: false };

/**
 * Build a default set of sources for a subject.
 * - `news`  (default): broad news + social-search coverage, zero-key.
 * - `video`: YouTube / TikTok / Instagram / Facebook discovery.
 *
 * `keys` should reflect which server-side env vars are set; sources that
 * depend on a key the server doesn't have are returned disabled.
 */
export function suggestSources(
  subject: string,
  mode: ListenerMode = "news",
  keys: AvailableKeys = NO_KEYS,
): FeedSource[] {
  const q = subject.trim() || "news";
  return mode === "video"
    ? suggestVideoSources(q, keys)
    : suggestNewsSources(q, keys);
}
