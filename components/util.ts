// Small client-side helpers shared across components.

/** "3h ago", "2d ago", "just now" — from an ISO timestamp. */
export function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "unknown";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/** Join class names, dropping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const PLATFORMS = [
  "rss", "atom", "json", "youtube", "rumble", "x", "twitter", "truth",
  "truthsocial", "substack", "reddit", "bluesky", "discord", "apify", "brave",
] as const;
