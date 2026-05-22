// Truth Social — resolution order:
//   1. trumpstruth.org feed URL → plain RSS (no auth, Trump posts)
//   2. APIFY_TOKEN              → Apify Truth Social scraper
//   3. neither                 → Mastodon-style public API (often blocked)

import type { ListenerConfig } from "../config";
import { httpGet, httpGetJson, parseFeed, stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";
import { fetchApify } from "./apify";

export async function fetchTruthSocial(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const raw = source.url.trim();

  // 1. trumpstruth.org RSS
  if (/trumpstruth\.org/i.test(raw) || /\/feed\/?$/i.test(raw) || raw.endsWith(".rss")) {
    const url = /^https?:\/\//i.test(raw) ? raw : "https://trumpstruth.org/feed";
    const xml = await httpGet(url, { proxy: config.corsProxy });
    return parseFeed(xml, "Truth Social").map(toCandidate);
  }

  // 2. Apify
  if (config.apifyToken) {
    return fetchApify(
      {
        ...source,
        platform: "apify",
        apifyActor: source.apifyActor || "muhammetakkurtt/truth-social-scraper",
        apifyInput:
          source.apifyInput || {
            usernames: [raw.replace(/^@/, "")],
            maxItems: 25,
          },
      },
      config,
    );
  }

  // 3. Mastodon-style public API
  const base = config.truthSocialBase.replace(/\/+$/, "");
  const acct = raw.replace(/^@/, "");
  const lookup = await httpGetJson<any>(
    `${base}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`,
  );
  if (!lookup?.id) throw new Error("Truth Social account not found");
  const statuses = await httpGetJson<any>(
    `${base}/api/v1/accounts/${lookup.id}/statuses?limit=20`,
  );
  return (Array.isArray(statuses) ? statuses : []).map((s: any) =>
    toCandidate({
      title: stripHtml(String(s.content || "")).slice(0, 180) || "(post)",
      url: String(s.url || s.uri || ""),
      guid: String(s.id || ""),
      summary: stripHtml(String(s.content || "")).slice(0, 600),
      publishedAt: toIso(s.created_at),
      source: `@${acct}`,
    }),
  );
}
