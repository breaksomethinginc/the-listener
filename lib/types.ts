// Shared types for The Listener engine.

export type Platform =
  | "rss"
  | "atom"
  | "json"
  | "youtube"
  | "rumble"
  | "x"
  | "twitter"
  | "truth"
  | "truthsocial"
  | "substack"
  | "reddit"
  | "bluesky"
  | "discord"
  | "apify"
  | "brave";

/** A place to listen. `url` means different things per platform — see SOURCES. */
export interface FeedSource {
  id: string;
  label: string;
  url: string;
  platform: Platform;
  enabled: boolean;
  /** 0–2 score multiplier applied to every item from this source. */
  trustWeight: number;
  /** Only used by the `apify` platform (or x/truth routed through Apify). */
  apifyActor?: string;
  apifyInput?: Record<string, unknown>;
}

/** The editorial filter for a listener. */
export interface KeywordBundle {
  /** At least one of these must appear for an item to count. */
  any: string[];
  /** Extra score when present. */
  boost: string[];
  /** Any of these disqualifies the item. */
  veto: string[];
}

export interface CandidateItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  imageUrl?: string;
  score: number;
  matchedTerms: string[];
  /** Set by the dispatcher so scoring can apply the source trustWeight. */
  sourceId?: string;
}

export interface ScanError {
  sourceId: string;
  message: string;
}

export interface ScanResult {
  ranAt: string;
  fetchedFrom: string[];
  candidates: CandidateItem[];
  errors: ScanError[];
  ranked: CandidateItem[];
}

/** A saved listener — the thing the user creates, saves, and re-runs. */
export interface Listener {
  id: string;
  name: string;
  subject: string;
  keywords: KeywordBundle;
  sources: FeedSource[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastResult?: ScanResult;
}
