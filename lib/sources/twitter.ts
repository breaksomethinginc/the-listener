// X / Twitter — `url` is an "@handle" or a search query.
// Resolution order:
//   1. TWITTER_BEARER  → official API v2
//   2. APIFY_TOKEN     → Apify twitter scraper
//   3. neither         → Nitter RSS fallback (often blocked — unreliable)

import type { ListenerConfig } from "../config";
import { httpGet, httpGetJson, parseFeed, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";
import { fetchApify } from "./apify";

function isHandle(raw: string): boolean {
  return raw.startsWith("@") || /^[A-Za-z0-9_]{1,15}$/.test(raw);
}

function tweetToCandidate(tw: any, username: string): CandidateItem {
  const text = String(tw.text || "");
  return toCandidate({
    title: text.slice(0, 180) || "(tweet)",
    url: `https://x.com/${username}/status/${tw.id}`,
    guid: String(tw.id),
    summary: text,
    publishedAt: toIso(tw.created_at),
    source: `@${username}`,
  });
}

async function viaApiV2(
  raw: string,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const headers = { authorization: `Bearer ${config.twitterBearer}` };
  const fields = "tweet.fields=created_at&max_results=25";

  if (isHandle(raw)) {
    const uname = raw.replace(/^@/, "");
    const user = await httpGetJson<any>(
      `https://api.twitter.com/2/users/by/username/${uname}`,
      { headers },
    );
    const uid = user?.data?.id;
    if (!uid) throw new Error("X user not found");
    const tweets = await httpGetJson<any>(
      `https://api.twitter.com/2/users/${uid}/tweets?${fields}`,
      { headers },
    );
    return (tweets?.data || []).map((t: any) => tweetToCandidate(t, uname));
  }

  const search = await httpGetJson<any>(
    `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
      raw,
    )}&${fields}`,
    { headers },
  );
  return (search?.data || []).map((t: any) => tweetToCandidate(t, "i"));
}

export async function fetchTwitter(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const raw = source.url.trim();

  if (config.twitterBearer) {
    return viaApiV2(raw, config);
  }

  if (config.apifyToken) {
    const handle = isHandle(raw);
    return fetchApify(
      {
        ...source,
        platform: "apify",
        apifyActor: source.apifyActor || "apidojo/twitter-scraper-lite",
        apifyInput:
          source.apifyInput ||
          (handle
            ? { twitterHandles: [raw.replace(/^@/, "")], maxItems: 25 }
            : { searchTerms: [raw], maxItems: 25 }),
      },
      config,
    );
  }

  // Nitter fallback — best-effort only.
  const base = config.nitterBase.replace(/\/+$/, "");
  const feed = isHandle(raw)
    ? `${base}/${raw.replace(/^@/, "")}/rss`
    : `${base}/search/rss?q=${encodeURIComponent(raw)}`;
  const xml = await httpGet(feed, { proxy: config.corsProxy });
  return parseFeed(xml, isHandle(raw) ? raw : `X: ${raw}`).map(toCandidate);
}
