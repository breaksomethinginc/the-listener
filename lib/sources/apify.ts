// Generic Apify actor runner — Instagram, TikTok, Facebook, anything on
// the Apify store. Requires APIFY_TOKEN plus `apifyActor` / `apifyInput`
// on the source. Output is mapped heuristically into CandidateItems.
//
// Engagement extraction is heuristic too: each scraper names its fields
// differently (likeCount, likesCount, like_count, diggCount on TikTok,
// playCount, viewCount, views, etc.) — we look for the most common
// names and surface whatever we find.

import type { ListenerConfig } from "../config";
import { stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource, Platform } from "../types";

/** First numeric value from a list of candidate keys; undefined if none. */
function num(obj: any, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === null || v === undefined) continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,_]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** First non-empty string from a list of candidate keys. */
function str(obj: any, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function guessPlatform(it: any, fallback?: Platform): Platform | undefined {
  const u = String(it?.url || it?.postUrl || it?.permalink || "");
  if (/youtube\.com|youtu\.be/.test(u)) return "youtube";
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/instagram\.com/.test(u)) return "instagram";
  if (/facebook\.com/.test(u)) return "facebook";
  if (/threads\.net/.test(u)) return "threads";
  if (/twitter\.com|x\.com/.test(u)) return "x";
  return fallback;
}

function profileUrl(platform: Platform | undefined, handle: string): string | undefined {
  if (!handle) return undefined;
  const h = handle.replace(/^@/, "");
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${h}/`;
    case "tiktok": return `https://www.tiktok.com/@${h}`;
    case "youtube": return `https://www.youtube.com/@${h}`;
    case "facebook": return `https://www.facebook.com/${h}`;
    case "threads": return `https://www.threads.net/@${h}`;
    case "x":
    case "twitter": return `https://x.com/${h}`;
    default: return undefined;
  }
}

function extractVideoId(platform: Platform | undefined, url: string): string | undefined {
  if (!url) return undefined;
  if (platform === "youtube") {
    return (
      url.match(/[?&]v=([\w-]{6,})/)?.[1] ||
      url.match(/youtu\.be\/([\w-]{6,})/)?.[1] ||
      url.match(/\/shorts\/([\w-]{6,})/)?.[1]
    );
  }
  if (platform === "tiktok") {
    return url.match(/\/video\/(\d+)/)?.[1];
  }
  if (platform === "instagram") {
    return url.match(/\/(?:p|reel)\/([\w-]+)/)?.[1];
  }
  return undefined;
}

export async function fetchApify(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.apifyToken) {
    throw new Error("APIFY_TOKEN is not set");
  }
  if (!source.apifyActor) {
    throw new Error("This Apify source has no `apifyActor` configured");
  }

  const actor = source.apifyActor.replace("/", "~");
  const endpoint = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${config.apifyToken}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(source.apifyInput || {}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}`);

  const items: any[] = await res.json();
  // Use the source's configured platform as a hint when URL detection fails.
  const fallbackPlatform: Platform | undefined =
    source.platform === "apify" ? undefined : (source.platform as Platform);

  return (Array.isArray(items) ? items : []).map((it: any) => {
    const text = String(
      it.text || it.title || it.caption || it.content || it.fullText || "",
    );
    let link = String(
      it.url ||
        it.link ||
        it.postUrl ||
        it.tweetUrl ||
        it.permalink ||
        it.webVideoUrl ||  // TikTok (clockworks/tiktok-scraper)
        it.videoUrl ||
        it.shareUrl ||
        it.pageUrl ||
        "",
    );
    const platform = guessPlatform(it, fallbackPlatform);
    // Reconstruct URLs from platform-specific id fields when no full
    // URL came through.
    if (!link) {
      if (platform === "instagram" && (it.shortCode || it.shortcode || it.code)) {
        link = `https://www.instagram.com/p/${it.shortCode || it.shortcode || it.code}/`;
      } else if (platform === "tiktok" && it.id && (it.authorMeta?.name || it.author?.uniqueId)) {
        const user = String(it.authorMeta?.name || it.author?.uniqueId).replace(/^@/, "");
        link = `https://www.tiktok.com/@${user}/video/${it.id}`;
      } else if (platform === "youtube" && it.id) {
        link = `https://www.youtube.com/watch?v=${it.id}`;
      } else if (platform === "threads" && it.code) {
        link = `https://www.threads.net/t/${it.code}`;
      }
    }

    // Creator info — handle is the "@username" you'd DM; displayName
    // is the human name shown publicly. Different scrapers put both
    // at different places (sometimes top-level, sometimes nested in
    // authorMeta / author / user / channel / owner). Walk both.
    const handle =
      str(
        it,
        "ownerUsername",
        "username",
        "userName",
        "uniqueId",
        "creatorUsername",
        "pageName",
      ) ||
      // Nested object shapes used by major scrapers.
      str(it.authorMeta, "name", "uniqueId", "username", "userName") || // TikTok
      str(it.author, "username", "userName", "uniqueId", "name") || // X / Threads / TT alt
      str(it.user, "username", "userName", "name") || // Facebook page
      str(it.channel, "name", "username", "handle") || // YouTube
      str(it.owner, "username", "userName", "name"); // IG alt

    const displayName =
      str(it, "ownerFullName", "authorName", "fullName", "name") ||
      str(it.authorMeta, "nickName", "nickname", "displayName") || // TikTok
      str(it.author, "name", "displayName", "fullName") ||
      str(it.user, "name", "displayName") ||
      str(it.channel, "title", "name") ||
      str(it.owner, "fullName", "name");

    const cleanHandle = handle ? handle.replace(/^@+/, "") : undefined;
    // Render order: "Display Name (@handle)" when we have both,
    // "@handle" when only handle, "Display Name" when only name.
    const creatorDisplay =
      displayName && cleanHandle
        ? `${displayName} (@${cleanHandle})`
        : cleanHandle
          ? `@${cleanHandle}`
          : displayName || undefined;
    const creatorHandle = cleanHandle;

    return toCandidate({
      title: stripHtml(text).slice(0, 180) || "(item)",
      url: link,
      guid: String(it.id || link || text.slice(0, 40)),
      summary: stripHtml(text).slice(0, 600),
      publishedAt: toIso(
        it.createdAt || it.date || it.timestamp || it.publishedAt || it.createTimeISO,
      ),
      imageUrl:
        it.image ||
        it.thumbnail ||
        it.displayUrl ||
        it.videoMeta?.coverUrl ||
        it.thumbnailUrl,
      source: creatorDisplay || source.label,
      platform,
      videoId: extractVideoId(platform, link),
      creator: creatorDisplay,
      creatorUrl: creatorHandle ? profileUrl(platform, creatorHandle) : undefined,
      views: num(
        it,
        "playCount",
        "viewCount",
        "views",
        "videoViewCount",
        "videoPlayCount",
        "viewsCount",
      ),
      likes: num(
        it,
        "likesCount",
        "likeCount",
        "diggCount",
        "likes",
        "favoriteCount",
        "reactions",
      ),
      commentCount: num(
        it,
        "commentsCount",
        "commentCount",
        "comments",
        "commentsTotal",
      ),
      // Creator follower / subscriber count. Different scrapers put it
      // at different paths — top-level OR inside the same nested
      // creator object that holds the handle. Walk both.
      creatorFollowers:
        num(
          it,
          "ownerFollowersCount",      // Instagram (apify/instagram-scraper)
          "followersCount",           // Threads, generic
          "followerCount",
          "subscriberCount",          // YouTube
          "channelSubscriberCount",
          "fans",                     // TikTok top-level (rare)
          "pageFollowers",            // Facebook page
          "pageLikes",
        ) ??
        num(it.authorMeta, "fans", "followers", "followersCount") ?? // TikTok
        num(it.author, "followersCount", "followerCount", "subscriberCount") ??
        num(it.user, "followersCount", "subscriberCount") ??
        num(it.channel, "subscriberCount", "subscribers"),
      durationSec: num(
        it,
        "duration",
        "durationSec",
        "videoMeta.duration",
      ),
    });
  });
}
