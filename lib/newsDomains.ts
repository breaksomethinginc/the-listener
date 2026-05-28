// Domains where the content is almost certainly published BY a news
// outlet, not by a real person. Voices mode drops items whose URL is
// on this list, even if they came in via a Reddit/Bluesky/Mastodon
// link post.
//
// We match the registrable domain at the END of the hostname so
// `m.cnn.com` and `edition.cnn.com` both match `cnn.com`.

export const NEWS_DOMAINS: ReadonlyArray<string> = [
  // US TV / cable
  "cnn.com",
  "foxnews.com",
  "msnbc.com",
  "nbcnews.com",
  "abcnews.go.com",
  "cbsnews.com",
  "pbs.org",
  "npr.org",
  "c-span.org",
  "cspan.org",
  "cnbc.com",
  // US papers
  "nytimes.com",
  "washingtonpost.com",
  "wsj.com",
  "usatoday.com",
  "latimes.com",
  "chicagotribune.com",
  "bostonglobe.com",
  // Wires / business
  "reuters.com",
  "apnews.com",
  "bloomberg.com",
  "ft.com",
  "economist.com",
  "marketwatch.com",
  "barrons.com",
  // International
  "bbc.com",
  "bbc.co.uk",
  "theguardian.com",
  "guardian.co.uk",
  "skynews.com",
  "news.sky.com",
  "telegraph.co.uk",
  "thetimes.co.uk",
  "independent.co.uk",
  "dailymail.co.uk",
  "metro.co.uk",
  "lemonde.fr",
  "spiegel.de",
  "aljazeera.com",
  "rt.com",
  "cbc.ca",
  "ctvnews.ca",
  "globalnews.ca",
  "abc.net.au",
  "smh.com.au",
  // Digital-native news
  "axios.com",
  "politico.com",
  "thehill.com",
  "vox.com",
  "buzzfeednews.com",
  "huffpost.com",
  "huffingtonpost.com",
  "businessinsider.com",
  "insider.com",
  "slate.com",
  "salon.com",
  "thedailybeast.com",
  "theintercept.com",
  "propublica.org",
  "mediaite.com",
  "newsweek.com",
  "time.com",
  "theatlantic.com",
  "newyorker.com",
  "vanityfair.com",
  "rollingstone.com",
  "yahoo.com",
  "news.yahoo.com",
  // Right / partisan US
  "breitbart.com",
  "dailycaller.com",
  "dailywire.com",
  "nypost.com",
  "thefederalist.com",
  "townhall.com",
  "washingtontimes.com",
  // Left / partisan US
  "motherjones.com",
  "thenation.com",
  "commondreams.org",
];

/**
 * Returns true if the URL's hostname matches one of NEWS_DOMAINS
 * (exactly or as a subdomain). Returns false for malformed/missing
 * URLs (don't drop items just because the URL is weird).
 */
export function isNewsDomain(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  let host: string;
  try {
    const withProto = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    host = new URL(withProto).hostname.toLowerCase();
  } catch {
    return false;
  }
  for (const d of NEWS_DOMAINS) {
    if (host === d || host.endsWith("." + d)) return true;
  }
  return false;
}
