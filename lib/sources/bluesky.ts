// Bluesky — public AppView API, no auth. `url` can be:
//   • "@handle" or a bsky.app/profile/<handle> URL → that account's posts
//   • anything else                                → a post search query

import type { ListenerConfig } from "../config";
import { stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchBluesky(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  const base = config.blueskyBase || "https://public.api.bsky.app";
  const input = source.url.trim();

  const profileMatch = input.match(/bsky\.app\/profile\/([^/?#]+)/i);
  const looksLikeHandle =
    input.startsWith("@") || /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(input);

  let endpoint: string;
  let isSearch = false;
  if (profileMatch || looksLikeHandle) {
    const actor = (profileMatch ? profileMatch[1] : input).replace(/^@/, "");
    endpoint = `${base}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(
      actor,
    )}&limit=30`;
  } else {
    isSearch = true;
    endpoint = `${base}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(
      input,
    )}&limit=30&sort=latest`;
  }

  const res = await fetch(endpoint, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bluesky HTTP ${res.status}`);
  const data: any = await res.json();

  const posts: any[] = isSearch
    ? data.posts || []
    : (data.feed || []).map((f: any) => f.post);

  return posts
    .filter(Boolean)
    .map((p: any) => {
      const record = p.record || {};
      const handle = p.author?.handle || "bsky";
      const displayName = p.author?.displayName
        ? String(p.author.displayName)
        : undefined;
      const rkey = String(p.uri || "").split("/").pop() || "";
      const text = String(record.text || "");
      const creator =
        displayName && handle
          ? `${displayName} (@${handle})`
          : `@${handle}`;
      return toCandidate({
        title: stripHtml(text).slice(0, 180) || "(post)",
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
        guid: String(p.uri || ""),
        summary: text.slice(0, 600),
        publishedAt: toIso(record.createdAt),
        source: `@${handle}`,
        platform: "bluesky",
        creator,
        creatorUrl: `https://bsky.app/profile/${handle}`,
        likes: typeof p.likeCount === "number" ? p.likeCount : undefined,
        commentCount: typeof p.replyCount === "number" ? p.replyCount : undefined,
      });
    });
}
