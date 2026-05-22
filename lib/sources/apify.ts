// Generic Apify actor runner — Instagram, TikTok, Facebook, anything on
// the Apify store. Requires APIFY_TOKEN plus `apifyActor` / `apifyInput`
// on the source. Output is mapped heuristically into CandidateItems.

import type { ListenerConfig } from "../config";
import { stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchApify(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.apifyToken) {
    throw new Error("APIFY_TOKEN is not set");
  }
  if (!source.apifyActor) {
    throw new Error("This Apify source has no `apifyActor` configured");
  }

  const actor = source.apifyActor.replace("/", "~");
  const endpoint = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${config.apifyToken}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(source.apifyInput || {}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}`);

  const items: any[] = await res.json();
  return (Array.isArray(items) ? items : []).map((it: any) => {
    const text = String(
      it.text || it.title || it.caption || it.content || it.fullText || "",
    );
    const link = String(
      it.url || it.link || it.postUrl || it.tweetUrl || it.permalink || "",
    );
    return toCandidate({
      title: stripHtml(text).slice(0, 180) || "(item)",
      url: link,
      guid: String(it.id || link || text.slice(0, 40)),
      summary: stripHtml(text).slice(0, 600),
      publishedAt: toIso(
        it.createdAt || it.date || it.timestamp || it.publishedAt,
      ),
      imageUrl: it.image || it.thumbnail || it.displayUrl,
      source: String(
        it.author || it.username || it.ownerUsername || source.label,
      ),
    });
  });
}
