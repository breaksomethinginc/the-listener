"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/components/util";

interface ListenerCard {
  id: string;
  name: string;
  subject: string;
  sources: { enabled: boolean }[];
  updatedAt: string;
  lastRunAt?: string;
  summary: { ranked: number; errors: number; ranAt: string } | null;
}

export default function Home() {
  const [listeners, setListeners] = useState<ListenerCard[] | null>(null);
  const [storage, setStorage] = useState("");

  async function load() {
    const res = await fetch("/api/listeners");
    const data = await res.json();
    setListeners(data.listeners || []);
    setStorage(data.storage || "");
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await fetch(`/api/listeners/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your listeners</h1>
          <p className="subtle">
            Each one watches a subject. Open it to run a fresh scan.
            {storage ? (
              <span className="faint"> · storage: {storage}</span>
            ) : null}
          </p>
        </div>
        <Link href="/listeners/new" className="btn btn-primary">
          + New listener
        </Link>
      </div>

      {listeners === null ? (
        <div>
          <div className="loading-line" />
          <div className="loading-line" />
          <div className="loading-line" />
        </div>
      ) : listeners.length === 0 ? (
        <div className="empty">
          <h2>No listeners yet</h2>
          <p className="subtle">
            Create your first one — give it a subject, and The Listener
            builds the keywords and sources for you.
          </p>
          <div style={{ marginTop: 18 }}>
            <Link href="/listeners/new" className="btn btn-primary">
              + Create a listener
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid">
          {listeners.map((l) => (
            <Link
              key={l.id}
              href={`/listeners/${l.id}`}
              className="card link"
            >
              <div className="spread">
                <p className="card-title">{l.name}</p>
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(l.id, l.name);
                  }}
                >
                  ✕
                </button>
              </div>
              <p className="card-sub">
                {l.subject || "No subject set"}
              </p>
              <div className="card-meta">
                <span>
                  {l.sources.filter((s) => s.enabled).length} active source
                  {l.sources.filter((s) => s.enabled).length === 1 ? "" : "s"}
                </span>
                {l.summary ? (
                  <span className="chip accent">
                    {l.summary.ranked} results
                  </span>
                ) : (
                  <span className="chip">never scanned</span>
                )}
                <span>
                  {l.lastRunAt
                    ? `scanned ${timeAgo(l.lastRunAt)}`
                    : `created ${timeAgo(l.updatedAt)}`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
