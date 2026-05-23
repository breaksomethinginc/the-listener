"use client";

import { useMemo, useState } from "react";
import type { CandidateItem, ScanResult } from "@/lib/types";
import { cx, timeAgo } from "./util";

function ResultRow({ item }: { item: CandidateItem }) {
  const tier = item.score >= 20 ? "hot" : item.score >= 13 ? "warm" : "";
  return (
    <div className="result">
      <div>
        <span className={cx("score", tier)}>{item.score}</span>
      </div>
      <div className="result-body">
        <p className="result-title">
          <a href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        </p>
        {item.summary ? <p className="result-summary">{item.summary}</p> : null}
        <div className="result-meta">
          <span>{item.source}</span>
          <span>·</span>
          <span>{timeAgo(item.publishedAt)}</span>
          {item.matchedTerms.length > 0 ? <span>·</span> : null}
          {item.matchedTerms.map((t, i) => (
            <span key={i} className="term">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(items: CandidateItem[]): string {
  const header = ["score", "title", "url", "source", "publishedAt", "matched"];
  const rows = items.map((it) =>
    [
      String(it.score),
      it.title,
      it.url,
      it.source,
      it.publishedAt,
      it.matchedTerms.join("|"),
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

export default function ScanResults({ result }: { result: ScanResult | null }) {
  const [filter, setFilter] = useState("");

  const allRanked = result?.ranked ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allRanked;
    return allRanked.filter((it) => {
      const hay = `${it.title} ${it.summary ?? ""} ${it.source} ${it.matchedTerms.join(" ")}`.toLowerCase();
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
        <span className="faint">
          {filtered.length}
          {filter && filtered.length !== allRanked.length
            ? ` of ${allRanked.length}`
            : ""}{" "}
          result{filtered.length === 1 ? "" : "s"} · last scan{" "}
          {timeAgo(ranAt)}
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
