// Curated list of major news outlet YouTube channels. Used when a video
// listener opts in to "news clips" coverage — we pull each channel's
// recent uploads via the public RSS feed and let scoring filter for
// items matching the listener's keywords.
//
// Channels here are referenced by their canonical channel ID (UC...) so
// the feed URL is stable. Handles are included for display only.

export interface NewsChannel {
  /** Internal slug used in source IDs. */
  slug: string;
  /** Display name. */
  name: string;
  /** Public @handle (for display + creator URL). */
  handle: string;
  /** Canonical channel ID — drives the RSS feed URL. */
  channelId: string;
}

export const MAJOR_NEWS_CHANNELS: NewsChannel[] = [
  { slug: "cnn", name: "CNN", handle: "@CNN", channelId: "UCupvZG-5ko_eiXAupbDfxWw" },
  { slug: "foxnews", name: "Fox News", handle: "@FoxNews", channelId: "UCXIJgqnII2ZOINSWNOGFThA" },
  { slug: "msnbc", name: "MSNBC", handle: "@msnbc", channelId: "UCaXkIU1QidjPwiAYu6GcHjg" },
  { slug: "abcnews", name: "ABC News", handle: "@ABCNews", channelId: "UCBi2mrWuNuyYy4gbM6fU18Q" },
  { slug: "cbsnews", name: "CBS News", handle: "@CBSNews", channelId: "UC8p1vwvWtl6T73JiExfWs1g" },
  { slug: "nbcnews", name: "NBC News", handle: "@NBCNews", channelId: "UCeY0bbntWzzVIaj2z3QigXg" },
  { slug: "pbsnewshour", name: "PBS NewsHour", handle: "@PBSNewsHour", channelId: "UC6ZFN9Tx6xh-skXCuRHCDpQ" },
  { slug: "cspan", name: "C-SPAN", handle: "@cspan", channelId: "UCb-beA5Z1KMfVvyVlBpZpYQ" },
  { slug: "reuters", name: "Reuters", handle: "@Reuters", channelId: "UChqUTb7kYRX8-EiaN3XdGSQ" },
  { slug: "bloomberg", name: "Bloomberg Television", handle: "@BloombergTelevision", channelId: "UCUMZ7gohGI9HcU9VNsr2FJQ" },
  { slug: "cnbc", name: "CNBC", handle: "@CNBC", channelId: "UCvJJ_dzjViJCoLf5uKUTwoA" },
  { slug: "skynews", name: "Sky News", handle: "@SkyNews", channelId: "UCoMdktPbSTixAyNGwb-UYkQ" },
  { slug: "bbcnews", name: "BBC News", handle: "@BBCNews", channelId: "UC16niRr50-MSBwiO3YDb3RA" },
  { slug: "wsj", name: "Wall Street Journal", handle: "@WSJ", channelId: "UCK7tptUDHh-RYDsdxO1-5QQ" },
  { slug: "guardian", name: "The Guardian", handle: "@TheGuardian", channelId: "UCIRYBXDze5krPDzAEOxFGVA" },
];
