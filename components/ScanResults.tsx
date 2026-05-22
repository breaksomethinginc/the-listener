"use client";

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

export default function ScanResults({ result }: { result: ScanResult | null }) {
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

  const { ranked, errors, ranAt } = result;

  return (
    <div>
      <div className="spread" style={{ marginBottom: 14 }}>
        <span className="faint">
          {ranked.length} result{ranked.length === 1 ? "" : "s"} · last scan{" "}
          {timeAgo(ranAt)}
        </span>
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

      {ranked.length === 0 ? (
        <div className="empty">
          <h2>Nothing scored above zero</h2>
          <p className="subtle">
            No item matched your keywords this run. Try broadening the
            &ldquo;must include&rdquo; list or adding more sources.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: "2px 20px" }}>
          {ranked.map((item) => (
            <ResultRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
