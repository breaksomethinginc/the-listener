// TikTok — wraps Apify with a default actor + input shape.
// `url` accepts:
//   • @username      → that user's recent videos
//   • #hashtag       → videos tagged with that hashtag
// Requires APIFY_TOKEN.

import type { ListenerConfig } from "../config";
import type { CandidateItem, FeedSource } from "../types";
import { fetchApify } from "./apify";

export async function fetchTikTok(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.apifyToken) {
    throw new Error("APIFY_TOKEN is not set");
  }
  const raw = source.url.trim();

  let input: Record<string, unknown>;
  if (raw.startsWith("#")) {
    input = { hashtags: [raw.slice(1)], resultsPerPage: 30 };
  } else {
    input = { profiles: [raw.replace(/^@/, "")], resultsPerPage: 30 };
  }

  return fetchApify(
    {
      ...source,
      platform: "apify",
      apifyActor: source.apifyActor || "clockworks/tiktok-scraper",
      apifyInput: source.apifyInput || input,
    },
    config,
  );
}
