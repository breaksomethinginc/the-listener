// YouTube — accepts a channel feed URL, a /channel/<id> URL, or a raw
// channel id, and reads the public per-channel RSS feed (no API key).

import type { ListenerConfig } from "../config";
import { httpGet, parseFeed, toCandidate } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchYouTube(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const input = source.url.trim();
  let feedUrl = input;

  if (!input.includes("/feeds/videos.xml")) {
    const channelId =
      input.match(/channel_id=([^&]+)/)?.[1] ||
      input.match(/\/channel\/([^/?#]+)/)?.[1] ||
      input.match(/^(UC[\w-]{20,})$/)?.[1];
    if (channelId) {
      feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    }
  }

  const xml = await httpGet(feedUrl, { proxy: config.corsProxy });
  return parseFeed(xml, source.label).map(toCandidate);
}
