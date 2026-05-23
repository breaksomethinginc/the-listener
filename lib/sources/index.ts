// Dispatcher — routes each source to the right adapter, then runs them
// all in parallel. One source failing never sinks the others.

import type { ListenerConfig } from "../config";
import type { CandidateItem, FeedSource, Platform, ScanError } from "../types";

import { fetchRss } from "./rss";
import { fetchYouTube } from "./youtube";
import { fetchRumble } from "./rumble";
import { fetchTwitter } from "./twitter";
import { fetchTruthSocial } from "./truthsocial";
import { fetchSubstack } from "./substack";
import { fetchReddit } from "./reddit";
import { fetchBluesky } from "./bluesky";
import { fetchDiscord } from "./discord";
import { fetchMastodon } from "./mastodon";
import { fetchInstagram } from "./instagram";
import { fetchTikTok } from "./tiktok";
import { fetchFacebook } from "./facebook";
import { fetchThreads } from "./threads";
import { fetchApify } from "./apify";
import { fetchBrave } from "./brave";

export type Adapter = (
  source: FeedSource,
  config: ListenerConfig,
) => Promise<CandidateItem[]>;

const ADAPTERS: Record<Platform, Adapter> = {
  rss: fetchRss,
  atom: fetchRss,
  json: fetchRss,
  youtube: fetchYouTube,
  rumble: fetchRumble,
  x: fetchTwitter,
  twitter: fetchTwitter,
  truth: fetchTruthSocial,
  truthsocial: fetchTruthSocial,
  substack: fetchSubstack,
  reddit: fetchReddit,
  bluesky: fetchBluesky,
  discord: fetchDiscord,
  mastodon: fetchMastodon,
  instagram: fetchInstagram,
  tiktok: fetchTikTok,
  facebook: fetchFacebook,
  threads: fetchThreads,
  apify: fetchApify,
  brave: fetchBrave,
};

export interface FetchOutcome {
  candidates: CandidateItem[];
  errors: ScanError[];
}

/** Fetch every source concurrently; collect items and per-source errors. */
export async function fetchAllSources(
  sources: FeedSource[],
  config: ListenerConfig,
): Promise<FetchOutcome> {
  const candidates: CandidateItem[] = [];
  const errors: ScanError[] = [];

  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const adapter = ADAPTERS[source.platform];
      if (!adapter) {
        throw new Error(`No adapter for platform "${source.platform}"`);
      }
      const items = await adapter(source, config);
      // Tag each item with its source so scoring can apply trustWeight.
      return items.map((it) => ({ ...it, sourceId: source.id }));
    }),
  );

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      candidates.push(...result.value);
    } else {
      const reason: any = result.reason;
      errors.push({
        sourceId: sources[i].id,
        message: String(reason?.message || reason || "unknown error"),
      });
    }
  });

  return { candidates, errors };
}
