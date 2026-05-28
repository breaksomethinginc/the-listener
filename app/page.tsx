"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/components/util";

interface ListenerCard {
  id: string;
  name: string;
  subject: string;
  mode?: "news" | "video" | "voices";
  sources: { enabled: boolean }[];
  updatedAt: string;
  lastRunAt?: string;
  summary: { ranked: number; errors: number; ranAt: string } | null;
}

function modeBadge(mode: ListenerCard["mode"]) {
  if (mode === "video") return { emoji: "🎥", title: "Video listener" };
  if (mode === "voices") return { emoji: "🗣", title: "Voices listener" };
  return { emoji: "📰", title: "News listener" };
}

export default function Home() {
  const [listeners, setListeners] = useState<ListenerCard[] | null>(null);
  const [storage, setStorage] = useState("");
  const [runState, setRunState] = useState<{
    running: boolean;
    done: number;
    total: number;
  }>({ running: false, done: 0, total: 0 });

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

  async function runAll() {
    if (!listeners || listeners.length === 0) return;
    setRunState({ running: true, done: 0, total: listeners.length });
    for (let i = 0; i < listeners.length; i++) {
      try {
        // Sequential — each scan already fans out across many sources.
        await fetch(`/api/listeners/${listeners[i].id}/scan`, { method: "POST" });
      } catch {
        // Per-listener failures are surfaced in the listener's lastResult.errors.
      }
      setRunState((prev) => ({ ...prev, done: i + 1 }));
    }
    await load();
    setRunState({ running: false, done: 0, total: 0 });
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
        <div className="row">
          {listeners && listeners.length > 0 ? (
            <button
              className="btn"
              onClick={runAll}
              disabled={runState.running}
              title="Run a fresh scan on every listener"
            >
              {runState.running ? (
                <>
                  <span className="spinner" /> Scanning {runState.done}/
                  {runState.total}…
                </>
              ) : (
                "▶ Run all"
              )}
            </button>
          ) : null}
          <Link href="/listeners/new" className="btn btn-primary">
            + New listener
          </Link>
        </div>
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
                <p className="card-title">
                  <span
                    title={modeBadge(l.mode).title}
                    style={{ marginRight: 6 }}
                  >
                    {modeBadge(l.mode).emoji}
                  </span>
                  {l.name}
                </p>
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
