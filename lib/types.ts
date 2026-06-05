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
  | "mastodon"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "threads"
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
  /**
   * Displayed score. Now represents virality (0–100): higher = more
   * viewed/engaged/recent. Items must also clear a relevance check
   * (keyword match) to appear in results.
   */
  score: number;
  /** Optional relevance number too, for the curious. */
  relevance?: number;
  matchedTerms: string[];
  /** Set by the dispatcher so scoring can apply the source trustWeight. */
  sourceId?: string;

  // ── Optional rich-media fields (populated when the adapter has them) ──
  /** Which platform this came from — used for embeds, badges, comment fetch. */
  platform?: Platform;
  /** Platform-native id — e.g. YouTube video id — for direct embed URLs. */
  videoId?: string;
  /** Creator handle / display name, e.g. "@senmarkkelly". */
  creator?: string;
  /** Link to the creator's profile (for outreach). */
  creatorUrl?: string;
  /** Engagement signals. All optional; renderers should hide when undefined. */
  views?: number;
  likes?: number;
  commentCount?: number;
  /** Creator's follower / subscriber count, when known. Used by Voices'
   *  maxAudience filter to surface smaller creators. */
  creatorFollowers?: number;
  /** Video duration in seconds, when known. */
  durationSec?: number;
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

export type ListenerMode = "news" | "video" | "voices";
export type ListenerKind = "person" | "organization" | "event" | "topic";
export type ListenerVisibility = "private" | "shared";

/** A saved listener — the thing the user creates, saves, and re-runs. */
export interface Listener {
  id: string;
  name: string;
  subject: string;
  /** Email of the user who created it. Undefined = legacy/pre-OAuth listener. */
  ownerId?: string;
  /** Who can see it. Defaults to "shared" for legacy listeners, "private" for new ones. */
  visibility?: ListenerVisibility;
  /** "news" (default) or "video". Drives autofill + UI badge; runtime is identical. */
  mode: ListenerMode;
  /** What the subject is — used by the wizard for smarter source selection. */
  kind?: ListenerKind;
  /** Disambiguating context, e.g. "US Senator, Arizona, Democrat". */
  context?: string;
  /** Hard time filter — items older than this are dropped before scoring. Undefined = no filter. */
  maxAgeDays?: number;
  /** Voices: max creator follower/subscriber count to keep. Items with
   *  more get dropped; items with unknown follower count pass through. */
  maxAudience?: number;
  /** Slack Incoming Webhook URL. When set, top new results are posted
   *  to the channel after each scan (manual + cron). */
  slackWebhookUrl?: string;
  /** Minimum viral score for an item to be eligible for Slack posting. */
  slackMinScore?: number;
  /** FIFO dedupe ledger — IDs we've already posted, so reruns don't
   *  spam Slack with the same items. Capped to ~500 entries. */
  postedItemIds?: string[];
  keywords: KeywordBundle;
  sources: FeedSource[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastResult?: ScanResult;
}
