// Substack — point `url` at the publication URL; we append /feed.

import type { ListenerConfig } from "../config";
import { httpGet, parseFeed, toCandidate } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchSubstack(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  let url = source.url.trim().replace(/\/+$/, "");
  if (!url.endsWith("/feed")) url += "/feed";
  const xml = await httpGet(url, { proxy: config.corsProxy });
  return parseFeed(xml, source.label).map(toCandidate);
}
