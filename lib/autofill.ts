// Smart autofill — turns wizard answers into a complete Listener config
// (keywords + sources + maxAgeDays). The output is "good enough to scan"
// without the user ever touching the source list.
//
// Inputs come from the new-listener wizard:
//   • kind:      person | organization | event | topic
//   • name:      the subject ("Mark Kelly")
//   • context:   disambiguating context ("US Senator, Arizona, Democrat")
//   • handles:   the subject's own social accounts (optional, increases quality)
//   • coverage:  which kinds of coverage to pull
//   • maxAgeDays: how far back to look

import { MAJOR_NEWS_CHANNELS } from "./newsChannels";
import type {
  FeedSource,
  KeywordBundle,
  ListenerKind,
  Platform,
} from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "is", "are",
  "was", "were", "with", "at", "by", "from", "about", "this", "that", "these",
  "those", "new", "news", "latest", "update", "updates", "into", "over",
  "their", "your", "our", "his", "her", "it", "us",
]);

// ── inputs ────────────────────────────────────────────────────────────

export interface SubjectHandles {
  youtube?: string;
  tiktok?: string;
  instagram?: string;
  x?: string;
  facebook?: string;
}

export interface Coverage {
  /** Their own posts (own YouTube/TikTok/IG/X feeds). */
  ofThem?: boolean;
  /** Searches for them across YouTube, TikTok, Instagram. */
  aboutThem?: boolean;
  /** Pre-built news channel feeds (CNN, Fox, MSNBC etc., filtered by keyword scoring). */
  newsClips?: boolean;
  /** Articles from Google News, Bing News, Brave News. */
  articles?: boolean;
  /** Reddit + Bluesky + Mastodon discussion. */
  social?: boolean;
}

export interface AvailableKeys {
  apify: boolean;
  youtube: boolean;
  brave: boolean;
}

export interface AutofillInput {
  kind: ListenerKind;
  name: string;
  context?: string;
  handles?: SubjectHandles;
  coverage: Coverage;
  maxAgeDays?: number;
}

export interface AutofillOutput {
  keywords: KeywordBundle;
  sources: FeedSource[];
}

/** Wizard input for the Voices mode (real-people-only). */
export interface VoicesInput {
  name: string;
  context?: string;
  maxAgeDays?: number;
  /** Whether to include Reddit + Bluesky discussion alongside video platforms. */
  includeDiscussion?: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────

function clean(s: string): string {
  return s.trim();
}

function id(prefix: string, suffix: string): string {
  return `${prefix}-${suffix.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "x"}`;
}

function stripAt(h: string): string {
  return h.replace(/^@+/, "").trim();
}

function hashtag(q: string): string {
  const words = q
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return (words.slice(0, 2).join("") || "topic").slice(0, 30);
}

function contextTerms(context?: string): string[] {
  if (!context) return [];
  return context
    .toLowerCase()
    .replace(/[^\w\s,]/g, " ")
    .split(/[,\s]+/)
    .map(clean)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8);
}

// ── keyword builder ───────────────────────────────────────────────────

function buildKeywords(input: AutofillInput): KeywordBundle {
  const name = clean(input.name);
  // Single full-phrase "must include" — way more precise than splitting
  // into individual words like the old autofill did. "Mark Kelly" as a
  // single string only matches items containing that exact phrase.
  const any = [name];

  // Boosts: disambiguating context terms.
  const boost = contextTerms(input.context);
  // Generic editorial signal boosts also help surface higher-quality items.
  if (input.kind !== "topic") {
    boost.push("interview", "speech", "remarks", "address");
  }

  return {
    any,
    boost,
    veto: [], // user adds later if they need disambiguation (e.g. astronaut vs senator)
  };
}

// ── source builders ───────────────────────────────────────────────────

function youtubeChannelByHandle(handle: string, name: string): FeedSource {
  return {
    id: id("yt-own", handle),
    label: `YouTube — @${stripAt(handle)} (videos by ${name})`,
    url: `@${stripAt(handle)}`,
    platform: "youtube",
    enabled: true,
    trustWeight: 1.4, // their own uploads are very high signal
  };
}

function tiktokOwn(handle: string, name: string): FeedSource {
  return {
    id: id("tt-own", handle),
    label: `TikTok — @${stripAt(handle)} (posts by ${name})`,
    url: `@${stripAt(handle)}`,
    platform: "tiktok",
    enabled: true,
    trustWeight: 1.3,
  };
}

function instagramOwn(handle: string, name: string): FeedSource {
  return {
    id: id("ig-own", handle),
    label: `Instagram — @${stripAt(handle)} (posts by ${name})`,
    url: `@${stripAt(handle)}`,
    platform: "instagram",
    enabled: true,
    trustWeight: 1.3,
  };
}

function xOwn(handle: string, name: string): FeedSource {
  return {
    id: id("x-own", handle),
    label: `X — @${stripAt(handle)} (posts by ${name})`,
    url: `@${stripAt(handle)}`,
    platform: "x",
    enabled: true,
    trustWeight: 1.2,
  };
}

function facebookOwn(handleOrUrl: string, name: string): FeedSource {
  return {
    id: id("fb-own", handleOrUrl),
    label: `Facebook — ${name}`,
    url: handleOrUrl,
    platform: "facebook",
    enabled: true,
    trustWeight: 1.1,
  };
}

function newsChannelSources(name: string): FeedSource[] {
  return MAJOR_NEWS_CHANNELS.map((ch) => ({
    id: id("news", ch.slug),
    label: `${ch.name} on YouTube (filtered for ${name})`,
    url: ch.channelId, // YouTube adapter handles raw channel IDs
    platform: "youtube" as Platform,
    enabled: true,
    trustWeight: 1.1,
  }));
}

// ── main ──────────────────────────────────────────────────────────────

export function buildListenerFromIntent(
  input: AutofillInput,
  keys: AvailableKeys,
): AutofillOutput {
  const name = clean(input.name);
  const tag = hashtag(name);
  // Quoted phrase + context word for keyword search — way better
  // disambiguation than just the bare name.
  const ctxWord = contextTerms(input.context)[0];
  const searchPhrase = ctxWord ? `"${name}" ${ctxWord}` : `"${name}"`;

  const sources: FeedSource[] = [];

  // ── Videos OF the subject (their own accounts) ──────────────────────
  if (input.coverage.ofThem !== false) {
    const h = input.handles || {};
    if (h.youtube) sources.push(youtubeChannelByHandle(h.youtube, name));
    if (h.tiktok && keys.apify) sources.push(tiktokOwn(h.tiktok, name));
    if (h.instagram && keys.apify) sources.push(instagramOwn(h.instagram, name));
    if (h.x) sources.push(xOwn(h.x, name));
    if (h.facebook && keys.apify) sources.push(facebookOwn(h.facebook, name));
  }

  // ── Videos ABOUT the subject (searches across video platforms) ──────
  if (input.coverage.aboutThem !== false) {
    // YouTube keyword search (with context disambiguation when available)
    if (keys.youtube || keys.apify) {
      sources.push({
        id: id("yt-search", name),
        label: `YouTube search — ${searchPhrase}`,
        url: searchPhrase,
        platform: "youtube",
        enabled: true,
        trustWeight: 1,
      });
    }
    // Hashtags on TikTok + Instagram
    if (keys.apify) {
      sources.push({
        id: id("tt-tag", tag),
        label: `TikTok #${tag}`,
        url: `#${tag}`,
        platform: "tiktok",
        enabled: true,
        trustWeight: 0.9,
      });
      sources.push({
        id: id("ig-tag", tag),
        label: `Instagram #${tag}`,
        url: `#${tag}`,
        platform: "instagram",
        enabled: true,
        trustWeight: 0.9,
      });
    }
  }

  // ── News clips (major outlets on YouTube, filtered by keyword) ──────
  if (input.coverage.newsClips) {
    sources.push(...newsChannelSources(name));
  }

  // ── News articles (text) ────────────────────────────────────────────
  if (input.coverage.articles !== false) {
    const enc = encodeURIComponent(name);
    sources.push({
      id: id("gnews", name),
      label: `Google News — ${name}`,
      url: `https://news.google.com/rss/search?q=${enc}&hl=en-US&gl=US&ceid=US:en`,
      platform: "rss",
      enabled: true,
      trustWeight: 1,
    });
    sources.push({
      id: id("bing", name),
      label: `Bing News — ${name}`,
      url: `https://www.bing.com/news/search?q=${enc}&format=rss`,
      platform: "rss",
      enabled: true,
      trustWeight: 1,
    });
    sources.push({
      id: id("brave", name),
      label: keys.brave
        ? `Brave News — ${name}`
        : `Brave News — ${name}  (needs BRAVE_API_KEY)`,
      url: name,
      platform: "brave",
      enabled: keys.brave,
      trustWeight: 1,
    });
  }

  // ── Social discussion ───────────────────────────────────────────────
  if (input.coverage.social !== false) {
    const enc = encodeURIComponent(name);
    sources.push({
      id: id("reddit", name),
      label: `Reddit search — ${name}`,
      url: `https://www.reddit.com/search.json?q=${enc}&sort=new&limit=25`,
      platform: "reddit",
      enabled: true,
      trustWeight: 0.8,
    });
    sources.push({
      id: id("bsky", name),
      label: `Bluesky search — ${name}`,
      url: name,
      platform: "bluesky",
      enabled: true,
      trustWeight: 0.8,
    });
    sources.push({
      id: id("masto", tag),
      label: `Mastodon #${tag}`,
      url: `#${tag}`,
      platform: "mastodon",
      enabled: true,
      trustWeight: 0.7,
    });
  }

  return {
    keywords: buildKeywords(input),
    sources,
  };
}

// ── Voices mode ───────────────────────────────────────────────────────
// Real people talking about the subject — TikTok / Instagram / Threads /
// Facebook / Reddit hashtag + keyword searches only. No news channels,
// no RSS, no Brave, no big media accounts surfaced by official handles.

/** Phrases that boost authentic UGC commentary. */
const VOICES_BOOST = [
  "reaction",
  "response",
  "opinion",
  "POV",
  "real talk",
  "honestly",
  "my take",
  "thoughts",
  "story time",
];

/** Phrases that signal institutional / press content — vetoed in Voices. */
const VOICES_VETO = [
  "press release",
  "official statement",
  "spokesperson said",
  "according to a statement",
];

function buildVoicesKeywords(input: VoicesInput): KeywordBundle {
  const name = clean(input.name);
  return {
    any: [name],
    boost: [...VOICES_BOOST, ...contextTerms(input.context)],
    veto: [...VOICES_VETO],
  };
}

export function buildVoicesFromIntent(
  input: VoicesInput,
  keys: AvailableKeys,
): AutofillOutput {
  const name = clean(input.name);
  const tag = hashtag(name);
  const sources: FeedSource[] = [];

  if (keys.apify) {
    // ── TikTok ─────────────────────────────────────────────────────
    sources.push({
      id: id("tt-tag", tag),
      label: `TikTok #${tag}`,
      url: `#${tag}`,
      platform: "tiktok",
      enabled: true,
      trustWeight: 1,
    });
    sources.push({
      id: id("tt-search", name),
      label: `TikTok search — ${name}`,
      url: name,
      platform: "tiktok",
      enabled: true,
      trustWeight: 0.9,
    });

    // ── Instagram ──────────────────────────────────────────────────
    sources.push({
      id: id("ig-tag", tag),
      label: `Instagram #${tag}`,
      url: `#${tag}`,
      platform: "instagram",
      enabled: true,
      trustWeight: 1,
    });

    // ── Threads ────────────────────────────────────────────────────
    sources.push({
      id: id("threads-search", name),
      label: `Threads search — ${name}`,
      url: name,
      platform: "threads",
      enabled: true,
      trustWeight: 0.9,
    });

    // ── Facebook ───────────────────────────────────────────────────
    // No public search — leave a slot the user can wire up.
    sources.push({
      id: id("fb-page", name),
      label: `Facebook page — add a page URL`,
      url: "",
      platform: "facebook",
      enabled: false,
      trustWeight: 0.7,
    });
  } else {
    // Without Apify the video platforms can't be searched. Add a
    // disabled stub so the user knows what's missing.
    sources.push({
      id: id("tt-tag", tag),
      label: `TikTok #${tag}  (needs APIFY_TOKEN)`,
      url: `#${tag}`,
      platform: "tiktok",
      enabled: false,
      trustWeight: 1,
    });
    sources.push({
      id: id("ig-tag", tag),
      label: `Instagram #${tag}  (needs APIFY_TOKEN)`,
      url: `#${tag}`,
      platform: "instagram",
      enabled: false,
      trustWeight: 1,
    });
  }

  // ── Reddit + Bluesky + Mastodon ──────────────────────────────────
  // Discussion is opt-in. These are people talking, not videos, but
  // they're useful context for outreach / sentiment.
  if (input.includeDiscussion) {
    const enc = encodeURIComponent(name);
    sources.push({
      id: id("reddit", name),
      label: `Reddit search — ${name}`,
      url: `https://www.reddit.com/search.json?q=${enc}&sort=new&limit=25`,
      platform: "reddit",
      enabled: true,
      trustWeight: 0.8,
    });
    sources.push({
      id: id("bsky", name),
      label: `Bluesky search — ${name}`,
      url: name,
      platform: "bluesky",
      enabled: true,
      trustWeight: 0.7,
    });
    sources.push({
      id: id("masto", tag),
      label: `Mastodon #${tag}`,
      url: `#${tag}`,
      platform: "mastodon",
      enabled: true,
      trustWeight: 0.6,
    });
  }

  return {
    keywords: buildVoicesKeywords(input),
    sources,
  };
}
