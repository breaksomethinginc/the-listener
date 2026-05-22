// Loads source credentials from environment variables.
// Every field is optional; adapters that need a key fail gracefully
// (their error shows up per-source in ScanResult.errors).

export interface ListenerConfig {
  corsProxy?: string;
  youtubeApiKey?: string;
  twitterBearer?: string;
  nitterBase: string;
  truthSocialBase: string;
  redditUserAgent: string;
  blueskyBase: string;
  discordBotToken?: string;
  apifyToken?: string;
  braveApiKey?: string;
}

export function loadConfig(): ListenerConfig {
  const env: Record<string, string | undefined> =
    (typeof process !== "undefined" && process.env) || {};
  return {
    corsProxy: env.RLA_CORS_PROXY || undefined,
    youtubeApiKey: env.YOUTUBE_API_KEY || undefined,
    twitterBearer: env.TWITTER_BEARER || undefined,
    nitterBase: env.NITTER_BASE || "https://nitter.net",
    truthSocialBase: env.TRUTH_SOCIAL_BASE || "https://truthsocial.com",
    redditUserAgent: env.REDDIT_USER_AGENT || "TheListener/1.0 (listening app)",
    blueskyBase: env.BLUESKY_BASE || "https://public.api.bsky.app",
    discordBotToken: env.DISCORD_BOT_TOKEN || undefined,
    apifyToken: env.APIFY_TOKEN || undefined,
    braveApiKey: env.BRAVE_API_KEY || undefined,
  };
}
