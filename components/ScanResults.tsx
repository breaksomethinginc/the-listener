"use client";

import { useMemo, useState } from "react";
import type { CandidateItem, ScanResult } from "@/lib/types";
import { cx, timeAgo } from "./util";
import Embed from "./Embed";

// ── number + duration formatting ─────────────────────────────────────
function fmtNum(n: number | undefined): string | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined;
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  if (n < 10_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return Math.round(n / 1_000_000) + "M";
}

function fmtDuration(sec: number | undefined): string | undefined {
  if (sec === undefined || !Number.isFinite(sec) || sec <= 0) return undefined;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  x: "X",
  twitter: "X",
  truthsocial: "Truth Social",
  truth: "Truth Social",
  reddit: "Reddit",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  substack: "Substack",
  rumble: "Rumble",
  rss: "RSS",
  atom: "RSS",
  json: "RSS",
  brave: "Brave",
  discord: "Discord",
  apify: "Apify",
};

// ── comments (YouTube only, lazy) ────────────────────────────────────
interface CommentRow {
  author: string;
  authorUrl?: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

function CommentList({ videoId }: { videoId: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; comments: CommentRow[]; note?: string }
    | { kind: "error"; msg: string }
  >({ kind: "idle" });

  async function load() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/youtube-comments?videoId=${encodeURIComponent(videoId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setState({ kind: "ready", comments: data.comments || [], note: data.note });
    } catch (e: any) {
      setState({ kind: "error", msg: String(e?.message || e) });
    }
  }

  if (state.kind === "idle") {
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={load}
        style={{ marginTop: 8 }}
      >
        💬 Show top comments
      </button>
    );
  }
  if (state.kind === "loading") {
    return <p className="faint" style={{ marginTop: 8 }}>Loading comments…</p>;
  }
  if (state.kind === "error") {
    return (
      <p className="faint" style={{ marginTop: 8 }}>
        Couldn't load comments: {state.msg}
      </p>
    );
  }
  if (state.comments.length === 0) {
    return (
      <p className="faint" style={{ marginTop: 8 }}>
        {state.note || "No comments returned."}
      </p>
    );
  }
  return (
    <div className="stack" style={{ marginTop: 10, gap: 10 }}>
      {state.comments.map((c, i) => (
        <div key={i} style={{ paddingLeft: 10, borderLeft: "2px solid var(--border-soft)" }}>
          <div style={{ fontSize: 12, marginBottom: 2 }}>
            {c.authorUrl ? (
              <a href={c.authorUrl} target="_blank" rel="noreferrer">
                {c.author}
              </a>
            ) : (
              <b>{c.author}</b>
            )}
            <span className="faint"> · {timeAgo(c.publishedAt)} · ❤ {c.likeCount}</span>
          </div>
          <div
            style={{ fontSize: 13, color: "var(--text-dim)" }}
            // YouTube comment text comes pre-formatted with <br> etc.
            dangerouslySetInnerHTML={{ __html: c.text }}
          />
        </div>
      ))}
    </div>
  );
}

// ── viral score tiering ──────────────────────────────────────────────
function viralTier(score: number): { cls: string; emoji: string; label: string } {
  if (score >= 70) return { cls: "hot", emoji: "🔥", label: "viral" };
  if (score >= 40) return { cls: "warm", emoji: "📈", label: "trending" };
  if (score >= 20) return { cls: "", emoji: "✨", label: "noticed" };
  return { cls: "", emoji: "", label: "" };
}

const SCORE_TOOLTIP =
  "Viral score (0–100). Combines reach (log-scaled views), engagement rate (likes/views, comments/views), and recency. Items without view data fall back to recency only. Items must also match your keywords to appear.";

// ── result row ───────────────────────────────────────────────────────
function ResultRow({ item }: { item: CandidateItem }) {
  const [playing, setPlaying] = useState(false);
  const tier = viralTier(item.score);
  const dur = fmtDuration(item.durationSec);
  const platformLabel =
    item.platform && PLATFORM_LABEL[item.platform]
      ? PLATFORM_LABEL[item.platform]
      : undefined;
  const canPlay =
    item.platform === "youtube" ||
    item.platform === "tiktok" ||
    item.platform === "instagram" ||
    item.platform === "facebook" ||
    /youtube\.com|youtu\.be/.test(item.url || "");

  const views = fmtNum(item.views);
  const likes = fmtNum(item.likes);
  const comments = fmtNum(item.commentCount);
  const showYouTubeComments =
    item.platform === "youtube" && (item.videoId || /[?&]v=/.test(item.url || ""));
  const ytId =
    item.videoId ||
    item.url?.match(/[?&]v=([\w-]{6,})/)?.[1] ||
    item.url?.match(/youtu\.be\/([\w-]{6,})/)?.[1];

  return (
    <div className="result">
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
        title={SCORE_TOOLTIP}
      >
        <span className={cx("score", tier.cls)}>{item.score}</span>
        {tier.label ? (
          <span
            className="faint"
            style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            {tier.emoji} {tier.label}
          </span>
        ) : null}
      </div>

      {item.imageUrl ? (
        <button
          type="button"
          onClick={() => canPlay && setPlaying((p) => !p)}
          title={canPlay ? "Play inline" : "Open in new tab"}
          style={{
            flex: "0 0 auto",
            position: "relative",
            width: 160,
            height: 90,
            padding: 0,
            border: 0,
            background: "var(--bg-soft, #1a1a1a)",
            borderRadius: 6,
            overflow: "hidden",
            cursor: canPlay ? "pointer" : "default",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
          {canPlay ? (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                fontSize: 28,
              }}
            >
              ▶
            </span>
          ) : null}
          {dur ? (
            <span
              style={{
                position: "absolute",
                right: 4,
                bottom: 4,
                background: "rgba(0,0,0,0.75)",
                color: "white",
                padding: "1px 5px",
                borderRadius: 3,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {dur}
            </span>
          ) : null}
        </button>
      ) : null}

      <div className="result-body">
        <p className="result-title">
          <a href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        </p>

        {item.summary ? <p className="result-summary">{item.summary}</p> : null}

        <div className="result-meta">
          {platformLabel ? (
            <span className="chip" style={{ background: "rgba(255,255,255,0.05)" }}>
              {platformLabel}
            </span>
          ) : null}

          {item.creator ? (
            item.creatorUrl ? (
              <a
                href={item.creatorUrl}
                target="_blank"
                rel="noreferrer"
                title="Open creator profile"
              >
                {item.creator}
              </a>
            ) : (
              <span>{item.creator}</span>
            )
          ) : (
            <span>{item.source}</span>
          )}

          <span>·</span>
          <span>{timeAgo(item.publishedAt)}</span>

          {views ? (
            <>
              <span>·</span>
              <span title="Views">👁 {views}</span>
            </>
          ) : null}
          {likes ? (
            <>
              <span>·</span>
              <span title="Likes">❤ {likes}</span>
            </>
          ) : null}
          {comments ? (
            <>
              <span>·</span>
              <span title="Comments">💬 {comments}</span>
            </>
          ) : null}

          {canPlay ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setPlaying((p) => !p)}
              style={{ marginLeft: "auto" }}
            >
              {playing ? "Hide" : "▶ Play"}
            </button>
          ) : null}
        </div>

        {item.matchedTerms.length > 0 ? (
          <div
            className="result-meta"
            style={{ marginTop: 4, gap: "6px 8px" }}
          >
            {item.matchedTerms.map((t, i) => (
              <span key={i} className="term">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {playing ? <Embed item={item} /> : null}

        {showYouTubeComments && playing && ytId ? (
          <CommentList videoId={ytId} />
        ) : null}
      </div>
    </div>
  );
}

// ── CSV export ───────────────────────────────────────────────────────
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(items: CandidateItem[]): string {
  const header = [
    "viral_score",
    "relevance",
    "title",
    "url",
    "platform",
    "creator",
    "creator_url",
    "publishedAt",
    "views",
    "likes",
    "comments",
    "duration_sec",
    "matched",
    "summary",
  ];
  const rows = items.map((it) =>
    [
      String(it.score),
      it.relevance !== undefined ? String(it.relevance) : "",
      it.title,
      it.url,
      it.platform || "",
      it.creator || it.source,
      it.creatorUrl || "",
      it.publishedAt,
      it.views !== undefined ? String(it.views) : "",
      it.likes !== undefined ? String(it.likes) : "",
      it.commentCount !== undefined ? String(it.commentCount) : "",
      it.durationSec !== undefined ? String(it.durationSec) : "",
      it.matchedTerms.join("|"),
      (it.summary || "").replace(/\s+/g, " ").slice(0, 500),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function downloadCsv(items: CandidateItem[]) {
  const blob = new Blob([toCsv(items)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `listener-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── shell ────────────────────────────────────────────────────────────
export default function ScanResults({ result }: { result: ScanResult | null }) {
  const [filter, setFilter] = useState("");

  const allRanked = result?.ranked ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allRanked;
    return allRanked.filter((it) => {
      const hay = `${it.title} ${it.summary ?? ""} ${it.source} ${it.creator ?? ""} ${it.matchedTerms.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allRanked, filter]);

  if (!result) {
    return (
      <div className="empty">
        <h2>No scans yet</h2>
        <p className="subtle">
          Hit <b>Run scan</b> above to pull and score fresh results.
        </p>
      </div>
    );
  }

  const { errors, ranAt } = result;

  return (
    <div>
      <div className="spread" style={{ marginBottom: 14, gap: 12 }}>
        <span className="faint" title={SCORE_TOOLTIP}>
          {filtered.length}
          {filter && filtered.length !== allRanked.length
            ? ` of ${allRanked.length}`
            : ""}{" "}
          result{filtered.length === 1 ? "" : "s"} · ranked by viral
          score · last scan {timeAgo(ranAt)}
        </span>
        <div className="row" style={{ gap: 8 }}>
          {allRanked.length > 0 ? (
            <input
              type="search"
              value={filter}
              placeholder="Filter results…"
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: 180 }}
            />
          ) : null}
          {allRanked.length > 0 ? (
            <button
              className="btn btn-sm"
              onClick={() => downloadCsv(filtered)}
              title="Download visible results as CSV"
            >
              ⤓ CSV
            </button>
          ) : null}
        </div>
      </div>

      {errors.length > 0 ? (
        <details style={{ marginBottom: 14 }}>
          <summary>
            {errors.length} source{errors.length === 1 ? "" : "s"} reported a
            problem
          </summary>
          <div className="stack" style={{ marginTop: 10 }}>
            {errors.map((e, i) => (
              <div key={i} className="faint">
                · <b>{e.sourceId}</b> — {e.message}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {allRanked.length === 0 ? (
        <div className="empty">
          <h2>Nothing scored above zero</h2>
          <p className="subtle">
            No item matched your keywords this run. Try broadening the
            &ldquo;must include&rdquo; list or adding more sources.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h2>No matches for &ldquo;{filter}&rdquo;</h2>
          <p className="subtle">Clear the filter to see all results again.</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: "2px 20px" }}>
          {filtered.map((item) => (
            <ResultRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
