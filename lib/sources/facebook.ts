// Facebook — wraps Apify with a default actor + input shape.
// `url` accepts a Facebook Page URL (e.g. https://www.facebook.com/nasa)
// or a bare page slug. Requires APIFY_TOKEN.

import type { ListenerConfig } from "../config";
import type { CandidateItem, FeedSource } from "../types";
import { fetchApify } from "./apify";

export async function fetchFacebook(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.apifyToken) {
    throw new Error("APIFY_TOKEN is not set");
  }
  const raw = source.url.trim();
  const pageUrl = raw.startsWith("http")
    ? raw
    : `https://www.facebook.com/${raw.replace(/^@/, "")}`;

  return fetchApify(
    {
      ...source,
      platform: "apify",
      apifyActor: source.apifyActor || "apify/facebook-posts-scraper",
      apifyInput: source.apifyInput || {
        startUrls: [{ url: pageUrl }],
        resultsLimit: 30,
      },
    },
    config,
  );
}
