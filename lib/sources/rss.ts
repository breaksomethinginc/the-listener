// RSS / Atom / JSON Feed — any standard feed URL.

import type { ListenerConfig } from "../config";
import { httpGet, parseFeed, toCandidate } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchRss(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const raw = await httpGet(source.url.trim(), { proxy: config.corsProxy });
  return parseFeed(raw, source.label).map(toCandidate);
}
