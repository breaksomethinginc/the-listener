// Reddit — public JSON listings. `url` can be:
//   • "r/Subreddit"            → newest posts in that subreddit
//   • a full reddit JSON URL   → used as-is
//   • a search phrase          → site-wide search, sorted newest

import type { ListenerConfig } from "../config";
import { httpGetJson, stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchReddit(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const input = source.url.trim();
  let url: string;

  if (/^\/?r\/[\w]+\/?$/i.test(input)) {
    const sub = input.replace(/^\/?r\//i, "").replace(/\/$/, "");
    url = `https://www.reddit.com/r/${sub}/new/.json?limit=25`;
  } else if (/^https?:\/\//i.test(input)) {
    url = input.includes(".json")
      ? input
      : input.replace(/\/?$/, "/.json");
  } else {
    url = `https://www.reddit.com/search.json?q=${encodeURIComponent(
      input,
    )}&sort=new&limit=25`;
  }

  const data = await httpGetJson<any>(url, {
    headers: { "user-agent": config.redditUserAgent },
  });

  const children: any[] = data?.data?.children || [];
  return children
    .map((c: any) => c?.data)
    .filter(Boolean)
    .map((d: any) => {
      const permalink = d.permalink
        ? `https://www.reddit.com${d.permalink}`
        : String(d.url || "");
      const thumb =
        typeof d.thumbnail === "string" && d.thumbnail.startsWith("http")
          ? d.thumbnail
          : undefined;
      return toCandidate({
        title: String(d.title || "(untitled)"),
        url: permalink,
        guid: String(d.id || d.name || permalink),
        summary: stripHtml(String(d.selftext || "")).slice(0, 600),
        publishedAt: toIso(d.created_utc ? d.created_utc * 1000 : undefined),
        imageUrl: thumb,
        source: String(d.subreddit_name_prefixed || source.label),
      });
    });
}
