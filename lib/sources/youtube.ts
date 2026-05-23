// YouTube — three modes, auto-detected from `url`:
//   1. Channel feed: a /channel/<id> URL, a feeds/videos.xml URL, or a
//      raw UC… channel id  → public per-channel RSS feed, no key needed.
//   2. @handle:        e.g. "@MarkKellyAZ" → resolves to the channel via
//                      YouTube's /feeds/videos.xml?user= or via API.
//   3. Search query:   any other plain text → most-recent videos matching
//                      the phrase. Uses YouTube Data API v3 (preferred,
//                      YOUTUBE_API_KEY) or Apify (fallback, APIFY_TOKEN).

import type { ListenerConfig } from "../config";
import {
  httpGet,
  httpGetJson,
  parseFeed,
  stripHtml,
  toCandidate,
  toIso,
} from "../feeds";
import type { CandidateItem, FeedSource } from "../types";
import { fetchApify } from "./apify";

function looksLikeFeedUrl(s: string): boolean {
  return /\/feeds\/videos\.xml/i.test(s);
}

function extractChannelId(s: string): string | null {
  return (
    s.match(/channel_id=([^&]+)/)?.[1] ||
    s.match(/\/channel\/([^/?#]+)/)?.[1] ||
    s.match(/^(UC[\w-]{20,})$/)?.[1] ||
    null
  );
}

function extractHandle(s: string): string | null {
  // "@MarkKellyAZ" or "youtube.com/@MarkKellyAZ"
  const m = s.match(/^@([\w.-]+)$/) || s.match(/youtube\.com\/@([\w.-]+)/);
  return m ? m[1] : null;
}

/** ISO-8601 duration ("PT4M13S") → seconds. Returns undefined on garbage. */
function parseIsoDuration(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  const h = parseInt(m[1] || "0", 10);
  const mi = parseInt(m[2] || "0", 10);
  const sec = parseInt(m[3] || "0", 10);
  return h * 3600 + mi * 60 + sec;
}

async function viaApiV3Search(
  query: string,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet` +
    `&type=video&order=date&maxResults=25` +
    `&q=${encodeURIComponent(query)}` +
    `&key=${config.youtubeApiKey}`;
  const search = await httpGetJson<any>(searchUrl);
  const searchItems: any[] = (search?.items || []).filter(
    (it: any) => it?.id?.videoId,
  );
  if (searchItems.length === 0) return [];

  // Second call: hydrate with statistics + contentDetails (duration).
  // One request covers up to 50 ids — we have at most 25.
  const ids = searchItems.map((it) => it.id.videoId).join(",");
  const detailsUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet` +
    `&id=${ids}&key=${config.youtubeApiKey}`;
  let detailsById: Record<string, any> = {};
  try {
    const details = await httpGetJson<any>(detailsUrl);
    for (const it of details?.items || []) {
      if (it?.id) detailsById[it.id] = it;
    }
  } catch {
    // Stats are nice-to-have — proceed without them if the second call fails.
  }

  return searchItems.map((it: any) => {
    const sn = it.snippet || {};
    const vid = it.id.videoId;
    const det = detailsById[vid] || {};
    const stats = det.statistics || {};
    const channelHandle = sn.channelTitle ? sn.channelTitle : undefined;
    return toCandidate({
      title: stripHtml(String(sn.title || "(untitled)")),
      url: `https://www.youtube.com/watch?v=${vid}`,
      guid: String(vid),
      summary: stripHtml(String(sn.description || "")).slice(0, 600),
      publishedAt: toIso(sn.publishedAt),
      imageUrl: sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url,
      source: `${channelHandle || "YouTube"} (YouTube)`,
      platform: "youtube",
      videoId: vid,
      creator: channelHandle,
      creatorUrl: sn.channelId
        ? `https://www.youtube.com/channel/${sn.channelId}`
        : undefined,
      views: stats.viewCount ? Number(stats.viewCount) : undefined,
      likes: stats.likeCount ? Number(stats.likeCount) : undefined,
      commentCount: stats.commentCount
        ? Number(stats.commentCount)
        : undefined,
      durationSec: parseIsoDuration(det.contentDetails?.duration),
    });
  });
}

async function viaApifySearch(
  query: string,
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  return fetchApify(
    {
      ...source,
      platform: "apify",
      apifyActor: source.apifyActor || "streamers/youtube-scraper",
      apifyInput: source.apifyInput || {
        searchKeywords: [query],
        maxResults: 25,
      },
    },
    config,
  );
}

export async function fetchYouTube(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const input = source.url.trim();
  if (!input) return [];

  // 1. Direct feed URL
  if (looksLikeFeedUrl(input)) {
    const xml = await httpGet(input, { proxy: config.corsProxy });
    return parseFeed(xml, source.label).map(toCandidate);
  }

  // 2. Channel id (raw or inside a URL)
  const channelId = extractChannelId(input);
  if (channelId) {
    const xml = await httpGet(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { proxy: config.corsProxy },
    );
    return parseFeed(xml, source.label).map(toCandidate);
  }

  // 3. @handle — YouTube's per-user feed accepts the handle directly
  const handle = extractHandle(input);
  if (handle) {
    const xml = await httpGet(
      `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(handle)}`,
      { proxy: config.corsProxy },
    );
    return parseFeed(xml, source.label).map(toCandidate);
  }

  // 4. Plain text → search query
  if (config.youtubeApiKey) {
    return viaApiV3Search(input, config);
  }
  if (config.apifyToken) {
    return viaApifySearch(input, source, config);
  }
  throw new Error(
    "YouTube keyword search needs YOUTUBE_API_KEY or APIFY_TOKEN. " +
      "Or pass a channel id / @handle / feed URL instead.",
  );
}
