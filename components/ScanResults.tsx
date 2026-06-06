"use client";

import { useMemo, useState } from "react";
import type { CandidateItem, ScanResult, SubjectDef } from "@/lib/types";
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

// ── categorize each item for the filter chips ───────────────────────
// More useful than raw platform — distinguishes "News clips" (videos from
// CNN/Fox/MSNBC etc.) from regular YouTube content, even though both
// are platform="youtube".
const CATEGORY_ORDER = [
  "YouTube",
  "News clips",
  "TikTok",
  "Instagram",
  "X",
  "Facebook",
  "Threads",
  "News articles",
  "Reddit",
  "Bluesky",
  "Mastodon",
  "Other",
];

const CATEGORY_EMOJI: Record<string, string> = {
  "YouTube": "🎥",
  "News clips": "📺",
  "TikTok": "🎵",
  "Instagram": "📸",
  "X": "🐦",
  "Facebook": "📘",
  "Threads": "🧵",
  "News articles": "📰",
  "Reddit": "💬",
  "Bluesky": "🦋",
  "Mastodon": "🦣",
  "Other": "•",
};

function categoryOf(item: CandidateItem): string {
  // News clips = YouTube videos from the curated news-channel feeds.
  // Autofill ids them with a "news-" prefix on the source.
  if (item.sourceId?.startsWith("news-")) return "News clips";
  switch (item.platform) {
    case "youtube": return "YouTube";
    case "tiktok": return "TikTok";
    case "instagram": return "Instagram";
    case "x":
    case "twitter": return "X";
    case "facebook": return "Facebook";
    case "threads": return "Threads";
    case "reddit": return "Reddit";
    case "bluesky": return "Bluesky";
    case "mastodon": return "Mastodon";
    case "rss":
    case "atom":
    case "json":
    case "brave": return "News articles";
  }
  return "Other";
}

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

// ── url normalization ────────────────────────────────────────────────
// Some scrapers return URLs without a protocol (`tiktok.com/@user/...`)
// or as bare strings. A plain href="" anchor renders fine but does
// nothing on click. This makes "click the card" always behave.
function safeUrl(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  const t = String(u).trim();
  if (!t) return undefined;
  // Already absolute.
  if (/^https?:\/\//i.test(t)) return t;
  // Protocol-relative.
  if (/^\/\//.test(t)) return "https:" + t;
  // Anything containing a dot in the first segment — treat as a domain.
  // (More permissive than the strict domain regex; better to over-link
  //  than to leave the user with a dead card.)
  if (/^[^\s/?#]+\.[^\s/?#]/.test(t)) return "https://" + t;
  return undefined;
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
interface ResultRowProps {
  item: CandidateItem;
  /** When set (race mode), shown as a chip in the meta row. */
  candidateName?: string;
}

function ResultRow({ item, candidateName }: ResultRowProps) {
  const [playing, setPlaying] = useState(false);
  const tier = viralTier(item.score);
  const dur = fmtDuration(item.durationSec);
  const platformLabel =
    item.platform && PLATFORM_LABEL[item.platform]
      ? PLATFORM_LABEL[item.platform]
      : undefined;
  const postUrl = safeUrl(item.url);
  const creatorUrl = safeUrl(item.creatorUrl);
  const canPlay =
    !!postUrl &&
    (item.platform === "youtube" ||
      item.platform === "tiktok" ||
      item.platform === "instagram" ||
      item.platform === "facebook" ||
      /youtube\.com|youtu\.be/.test(item.url || ""));

  // Click the thumbnail: play inline if we can, otherwise open the post.
  function onThumbClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (canPlay) setPlaying((p) => !p);
    else if (postUrl) window.open(postUrl, "_blank", "noopener,noreferrer");
  }

  // Click anywhere else on the card opens the post (creator URL is a
  // fallback for items where the post URL is genuinely missing).
  function onCardClick(e: React.MouseEvent) {
    // If the click landed on an interactive child (link, button, input),
    // let that handler run and don't open the card-level URL.
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, details, summary"))
      return;
    const dest = postUrl || creatorUrl;
    if (dest) window.open(dest, "_blank", "noopener,noreferrer");
  }

  const views = fmtNum(item.views);
  const likes = fmtNum(item.likes);
  const comments = fmtNum(item.commentCount);
  const followers = fmtNum(item.creatorFollowers);
  const showYouTubeComments =
    item.platform === "youtube" && (item.videoId || /[?&]v=/.test(item.url || ""));
  const ytId =
    item.videoId ||
    item.url?.match(/[?&]v=([\w-]{6,})/)?.[1] ||
    item.url?.match(/youtu\.be\/([\w-]{6,})/)?.[1];

  const cardClickable = !!(postUrl || creatorUrl);

  return (
    <div
      className="result result-clickable"
      onClick={cardClickable ? onCardClick : undefined}
      role={cardClickable ? "link" : undefined}
      tabIndex={cardClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (cardClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          const dest = postUrl || creatorUrl;
          if (dest) window.open(dest, "_blank", "noopener,noreferrer");
        }
      }}
      style={{ cursor: cardClickable ? "pointer" : "default" }}
    >
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
          onClick={onThumbClick}
          title={canPlay ? "Play inline" : postUrl ? "Open in new tab" : "No link available"}
          disabled={!canPlay && !postUrl}
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
          {postUrl ? (
            <a href={postUrl} target="_blank" rel="noreferrer">
              {item.title}
            </a>
          ) : (
            <span title="No URL on this item">{item.title}</span>
          )}
        </p>

        {/* Creator pill — prominent, separate from the meta line. The
            primary outreach affordance: who said this, click to go
            straight to their profile. */}
        {item.creator || creatorUrl ? (
          <div style={{ margin: "4px 0 8px" }}>
            {creatorUrl ? (
              <a
                href={creatorUrl}
                target="_blank"
                rel="noreferrer"
                title="Open creator profile in a new tab"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(61, 215, 198, 0.12)",
                  border: "1px solid rgba(61, 215, 198, 0.35)",
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                👤 {item.creator || "Profile"}
                <span style={{ opacity: 0.7, fontWeight: 400 }}>↗</span>
              </a>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-soft)",
                  color: "var(--text-dim)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                👤 {item.creator}
              </span>
            )}
          </div>
        ) : null}

        {item.summary ? <p className="result-summary">{item.summary}</p> : null}

        <div className="result-meta">
          {candidateName ? (
            <span
              className="chip"
              title="Tagged to this candidate"
              style={{
                background: "rgba(61, 215, 198, 0.12)",
                color: "var(--accent)",
                border: "1px solid rgba(61, 215, 198, 0.3)",
                fontWeight: 600,
              }}
            >
              🏁 {candidateName}
            </span>
          ) : null}
          {platformLabel ? (
            <span className="chip" style={{ background: "rgba(255,255,255,0.05)" }}>
              {platformLabel}
            </span>
          ) : null}

          <span>{item.source}</span>

          <span>·</span>
          <span>{timeAgo(item.publishedAt)}</span>

          {followers ? (
            <>
              <span>·</span>
              <span title="Creator followers">🫂 {followers}</span>
            </>
          ) : null}
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
    "creator_followers",
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
      it.creatorFollowers !== undefined ? String(it.creatorFollowers) : "",
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
interface ScanResultsProps {
  result: ScanResult | null;
  /** For race-mode listeners — surfaces a per-candidate filter row above
   *  the category chips. */
  subjects?: SubjectDef[];
}

/**
 * Which candidate (if any) does an item match? Tested against the item's
 * matchedTerms (case-insensitive). First match wins. Returns undefined
 * when no candidate is mentioned.
 */
function matchedCandidate(
  item: CandidateItem,
  subjects: SubjectDef[] | undefined,
): string | undefined {
  if (!subjects || subjects.length === 0) return undefined;
  const hay = (item.matchedTerms || []).map((t) => t.toLowerCase());
  for (const s of subjects) {
    const n = s.name.toLowerCase();
    if (hay.includes(n)) return s.name;
  }
  // Fallback — name appears verbatim in the title/summary.
  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  for (const s of subjects) {
    if (text.includes(s.name.toLowerCase())) return s.name;
  }
  return undefined;
}

export default function ScanResults({ result, subjects }: ScanResultsProps) {
  const [filter, setFilter] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [candFilter, setCandFilter] = useState<string | null>(null);

  const allRanked = result?.ranked ?? [];

  // Count every category present in the unfiltered results — drives
  // the chip row even after some chips are toggled off.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of allRanked) {
      const c = categoryOf(it);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [allRanked]);

  // Sort categories by our canonical order; unknown categories go last.
  const orderedCategories = useMemo(() => {
    return Array.from(categoryCounts.keys()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [categoryCounts]);

  // Per-candidate counts for the race-mode chip row.
  const candidateCounts = useMemo(() => {
    if (!subjects || subjects.length === 0) return null;
    const counts = new Map<string, number>();
    let unmatched = 0;
    for (const it of allRanked) {
      const c = matchedCandidate(it, subjects);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
      else unmatched++;
    }
    return { counts, unmatched };
  }, [allRanked, subjects]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allRanked.filter((it) => {
      if (hidden.has(categoryOf(it))) return false;
      if (candFilter) {
        if (candFilter === "__race__") {
          if (matchedCandidate(it, subjects)) return false;
        } else {
          if (matchedCandidate(it, subjects) !== candFilter) return false;
        }
      }
      if (!q) return true;
      const hay = `${it.title} ${it.summary ?? ""} ${it.source} ${it.creator ?? ""} ${it.matchedTerms.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allRanked, filter, hidden, candFilter, subjects]);

  function toggleCategory(c: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }
  function showAll() {
    setHidden(new Set());
  }
  function onlyShow(c: string) {
    const next = new Set<string>();
    for (const cat of orderedCategories) if (cat !== c) next.add(cat);
    setHidden(next);
  }

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
  const anyHidden = hidden.size > 0;

  return (
    <div>
      <div className="spread" style={{ marginBottom: 14, gap: 12 }}>
        <span className="faint" title={SCORE_TOOLTIP}>
          {filtered.length}
          {filtered.length !== allRanked.length
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

      {candidateCounts && subjects && subjects.length > 0 ? (
        <div
          className="row"
          style={{
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 10,
            alignItems: "center",
          }}
        >
          <span
            className="faint"
            style={{ fontSize: 11, marginRight: 4 }}
            title="Click to filter results to one candidate"
          >
            🏁 BY CANDIDATE
          </span>
          {subjects.map((s) => {
            const count = candidateCounts.counts.get(s.name) ?? 0;
            const active = candFilter === s.name;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => setCandFilter(active ? null : s.name)}
                className="chip"
                style={{
                  cursor: "pointer",
                  background: active
                    ? "rgba(61, 215, 198, 0.18)"
                    : "transparent",
                  color: active ? "var(--accent)" : "var(--text-dim)",
                  border: `1px solid ${active ? "rgba(61, 215, 198, 0.5)" : "var(--border-soft)"}`,
                  padding: "3px 9px",
                  fontSize: 12,
                  borderRadius: 999,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {s.name} · {count}
              </button>
            );
          })}
          {candidateCounts.unmatched > 0 ? (
            <button
              type="button"
              onClick={() =>
                setCandFilter(candFilter === "__race__" ? null : "__race__")
              }
              className="chip"
              style={{
                cursor: "pointer",
                background:
                  candFilter === "__race__"
                    ? "rgba(61, 215, 198, 0.18)"
                    : "transparent",
                color:
                  candFilter === "__race__"
                    ? "var(--accent)"
                    : "var(--text-dim)",
                border: `1px solid ${candFilter === "__race__" ? "rgba(61, 215, 198, 0.5)" : "var(--border-soft)"}`,
                padding: "3px 9px",
                fontSize: 12,
                borderRadius: 999,
              }}
              title="Items not tagged to a specific candidate"
            >
              race-wide · {candidateCounts.unmatched}
            </button>
          ) : null}
          {candFilter ? (
            <button
              type="button"
              onClick={() => setCandFilter(null)}
              className="chip"
              style={{
                cursor: "pointer",
                background: "transparent",
                border: "1px dashed var(--border-soft)",
                padding: "3px 9px",
                fontSize: 12,
                borderRadius: 999,
                color: "var(--text-dim)",
              }}
            >
              clear
            </button>
          ) : null}
        </div>
      ) : null}

      {orderedCategories.length > 1 ? (
        <div
          className="row"
          style={{
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
            alignItems: "center",
          }}
        >
          {orderedCategories.map((c) => {
            const off = hidden.has(c);
            const count = categoryCounts.get(c) ?? 0;
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                onDoubleClick={() => onlyShow(c)}
                title={off ? `Show ${c}` : `Hide ${c} (double-click: only ${c})`}
                className="chip"
                style={{
                  cursor: "pointer",
                  background: off
                    ? "transparent"
                    : "rgba(61, 215, 198, 0.12)",
                  color: off
                    ? "var(--text-faint)"
                    : "var(--accent)",
                  border: `1px solid ${off ? "var(--border-soft)" : "rgba(61, 215, 198, 0.4)"}`,
                  textDecoration: off ? "line-through" : "none",
                  padding: "3px 9px",
                  fontSize: 12,
                  borderRadius: 999,
                }}
              >
                {CATEGORY_EMOJI[c] || "•"} {c} · {count}
              </button>
            );
          })}
          {anyHidden ? (
            <button
              type="button"
              onClick={showAll}
              className="chip"
              style={{
                cursor: "pointer",
                background: "transparent",
                border: "1px dashed var(--border-soft)",
                padding: "3px 9px",
                fontSize: 12,
                borderRadius: 999,
                color: "var(--text-dim)",
              }}
              title="Show all categories"
            >
              show all
            </button>
          ) : null}
        </div>
      ) : null}

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
            <ResultRow
              key={item.id}
              item={item}
              candidateName={matchedCandidate(item, subjects)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
