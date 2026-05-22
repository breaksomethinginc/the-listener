// Brave News Search — topic-based discovery. `url` is the search query.
// Requires BRAVE_API_KEY (free tier: 2,000 queries/month).

import type { ListenerConfig } from "../config";
import { httpGetJson, stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchBrave(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.braveApiKey) {
    throw new Error("BRAVE_API_KEY is not set — add it to enable Brave News");
  }
  const query = source.url.trim();
  const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(
    query,
  )}&count=20&freshness=pw`;

  const data = await httpGetJson<any>(url, {
    headers: {
      "X-Subscription-Token": config.braveApiKey,
      accept: "application/json",
    },
  });

  const results: any[] = data?.results || [];
  return results.map((r: any) =>
    toCandidate({
      title: stripHtml(String(r.title || "(untitled)")),
      url: String(r.url || ""),
      guid: String(r.url || r.title || ""),
      summary: stripHtml(String(r.description || "")).slice(0, 600),
      publishedAt: toIso(r.page_age || r.age),
      imageUrl: r.thumbnail?.src,
      source: String(r.meta_url?.hostname || "Brave News"),
    }),
  );
}
