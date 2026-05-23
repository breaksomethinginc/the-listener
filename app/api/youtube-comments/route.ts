// Lazily fetch top-level comments for one YouTube video. Hits YouTube
// Data API v3 commentThreads. Quota cost is ~1 unit per call; only fires
// when the user explicitly expands a row's comments section.

import { loadConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

interface OutComment {
  author: string;
  authorUrl?: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

export async function GET(req: Request) {
  const cfg = loadConfig();
  if (!cfg.youtubeApiKey) {
    return Response.json(
      { error: "YOUTUBE_API_KEY is not set on the server" },
      { status: 400 },
    );
  }
  const videoId = new URL(req.url).searchParams.get("videoId")?.trim();
  if (!videoId) {
    return Response.json({ error: "Provide ?videoId=" }, { status: 400 });
  }

  const url =
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet` +
    `&order=relevance&maxResults=10` +
    `&videoId=${encodeURIComponent(videoId)}` +
    `&key=${cfg.youtubeApiKey}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // 403 with commentsDisabled is the most common — surface gracefully.
    if (/commentsDisabled/i.test(txt)) {
      return Response.json({ comments: [], note: "Comments disabled on this video" });
    }
    return Response.json(
      { error: `YouTube HTTP ${res.status}`, detail: txt.slice(0, 300) },
      { status: 502 },
    );
  }
  const data: any = await res.json();
  const comments: OutComment[] = (data?.items || [])
    .map((it: any) => {
      const top = it?.snippet?.topLevelComment?.snippet;
      if (!top) return null;
      return {
        author: String(top.authorDisplayName || "Anonymous"),
        authorUrl: top.authorChannelUrl ? String(top.authorChannelUrl) : undefined,
        text: String(top.textDisplay || "").slice(0, 600),
        likeCount: Number(top.likeCount || 0),
        publishedAt: String(top.publishedAt || ""),
      };
    })
    .filter(Boolean) as OutComment[];

  return Response.json({ comments });
}
