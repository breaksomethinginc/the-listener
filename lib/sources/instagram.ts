// Instagram — wraps Apify with a sensible default actor + input shape.
// `url` accepts:
//   • @username           → that user's posts
//   • #hashtag            → posts tagged with that hashtag
// Requires APIFY_TOKEN. Override `apifyActor` / `apifyInput` on the source
// to use a different actor.

import type { ListenerConfig } from "../config";
import type { CandidateItem, FeedSource } from "../types";
import { fetchApify } from "./apify";

export async function fetchInstagram(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.apifyToken) {
    throw new Error("APIFY_TOKEN is not set");
  }
  const raw = source.url.trim();

  let input: Record<string, unknown>;
  if (raw.startsWith("#")) {
    input = { hashtags: [raw.slice(1)], resultsLimit: 30 };
  } else {
    input = { username: [raw.replace(/^@/, "")], resultsLimit: 30 };
  }

  return fetchApify(
    {
      ...source,
      platform: "apify",
      apifyActor: source.apifyActor || "apify/instagram-scraper",
      apifyInput: source.apifyInput || input,
    },
    config,
  );
}
