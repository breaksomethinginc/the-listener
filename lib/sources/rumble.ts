// Rumble — per-channel RSS. Point `url` at the channel's feed URL.

import type { ListenerConfig } from "../config";
import { httpGet, parseFeed, toCandidate } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchRumble(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const raw = await httpGet(source.url.trim(), { proxy: config.corsProxy });
  return parseFeed(raw, source.label).map(toCandidate);
}
