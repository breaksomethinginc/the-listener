// Mastodon — public APIs, no key required.
//   • "@user@instance.tld"   → that user's recent statuses
//   • "#tag@instance.tld"    → public hashtag timeline on that instance
//   • "#tag"                 → defaults to mastodon.social
//   • bare instance URL      → public local timeline
//
// Defaults to mastodon.social when no instance is given.

import type { ListenerConfig } from "../config";
import { httpGetJson, stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

const DEFAULT_INSTANCE = "mastodon.social";

interface Parsed {
  kind: "user" | "tag" | "local";
  value: string;
  instance: string;
}

function parseInput(raw: string): Parsed {
  const trimmed = raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  if (trimmed.startsWith("#")) {
    const [tag, instance] = trimmed.slice(1).split("@");
    return { kind: "tag", value: tag, instance: instance || DEFAULT_INSTANCE };
  }

  if (trimmed.startsWith("@")) {
    const [user, instance] = trimmed.slice(1).split("@");
    return { kind: "user", value: user, instance: instance || DEFAULT_INSTANCE };
  }

  if (trimmed.includes(".") && !trimmed.includes("/")) {
    return { kind: "local", value: "", instance: trimmed };
  }

  return { kind: "tag", value: trimmed, instance: DEFAULT_INSTANCE };
}

function statusToCandidate(s: any, instance: string): CandidateItem {
  const text = stripHtml(String(s.content || ""));
  const acct = s.account?.acct;
  const displayName = s.account?.display_name;
  const handle = acct ? `@${acct}` : undefined;
  const creator =
    displayName && handle
      ? `${displayName} (${handle})`
      : handle || displayName || "Mastodon";
  return toCandidate({
    title: text.slice(0, 180) || "(toot)",
    url: String(s.url || s.uri || ""),
    guid: String(s.id),
    summary: text.slice(0, 600),
    publishedAt: toIso(s.created_at),
    imageUrl: s.media_attachments?.[0]?.preview_url,
    source: `${handle || "Mastodon"} (${instance})`,
    platform: "mastodon",
    creator,
    creatorUrl: s.account?.url ? String(s.account.url) : undefined,
    likes: typeof s.favourites_count === "number" ? s.favourites_count : undefined,
    commentCount: typeof s.replies_count === "number" ? s.replies_count : undefined,
  });
}

export async function fetchMastodon(
  source: FeedSource,
  _config: ListenerConfig,
): Promise<CandidateItem[]> {
  const parsed = parseInput(source.url);
  const base = `https://${parsed.instance}/api/v1`;

  if (parsed.kind === "tag") {
    const items = await httpGetJson<any[]>(
      `${base}/timelines/tag/${encodeURIComponent(parsed.value)}?limit=40`,
    );
    return (Array.isArray(items) ? items : []).map((s) =>
      statusToCandidate(s, parsed.instance),
    );
  }

  if (parsed.kind === "local") {
    const items = await httpGetJson<any[]>(
      `${base}/timelines/public?local=true&limit=40`,
    );
    return (Array.isArray(items) ? items : []).map((s) =>
      statusToCandidate(s, parsed.instance),
    );
  }

  // kind === "user"
  const handle = parsed.value;
  const lookup = await httpGetJson<any>(
    `${base}/accounts/lookup?acct=${encodeURIComponent(handle)}`,
  );
  const accountId = lookup?.id;
  if (!accountId) throw new Error(`Mastodon user not found: @${handle}`);

  const items = await httpGetJson<any[]>(
    `${base}/accounts/${accountId}/statuses?limit=40&exclude_replies=true`,
  );
  return (Array.isArray(items) ? items : []).map((s) =>
    statusToCandidate(s, parsed.instance),
  );
}
