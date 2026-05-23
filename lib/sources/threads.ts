// Threads (Meta) — wraps Apify with a default actor + input shape.
// `url` accepts:
//   • @username      → that user's recent threads
//   • search phrase  → keyword search
// Requires APIFY_TOKEN.

import type { ListenerConfig } from "../config";
import type { CandidateItem, FeedSource } from "../types";
import { fetchApify } from "./apify";

export async function fetchThreads(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.apifyToken) {
    throw new Error("APIFY_TOKEN is not set");
  }
  const raw = source.url.trim();
  const handle = raw.startsWith("@");

  return fetchApify(
    {
      ...source,
      platform: "apify",
      apifyActor: source.apifyActor || "apify/threads-scraper",
      apifyInput:
        source.apifyInput ||
        (handle
          ? { usernames: [raw.replace(/^@/, "")], resultsLimit: 30 }
          : { searchTerms: [raw], resultsLimit: 30 }),
    },
    config,
  );
}
