"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ListenerForm, { type ListenerFormValue } from "@/components/ListenerForm";
import ScanResults from "@/components/ScanResults";
import { timeAgo } from "@/components/util";
import type { Listener } from "@/lib/types";

export default function ListenerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [listener, setListener] = useState<Listener | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [tab, setTab] = useState<"results" | "settings">("results");
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/listeners/${id}`);
    if (res.status === 404) {
      setState("missing");
      return;
    }
    const data = await res.json();
    setListener(data.listener);
    setState("ready");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runScan() {
    setScanning(true);
    setScanSuccess(false);
    setError(null);
    try {
      const res = await fetch(`/api/listeners/${id}/scan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setListener((prev) =>
        prev
          ? { ...prev, lastResult: data.result, lastRunAt: data.result.ranAt }
          : prev,
      );
      setTab("results");
      // Flash the success mascot for a beat, then fade.
      setScanSuccess(true);
      window.setTimeout(() => setScanSuccess(false), 2800);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setScanning(false);
    }
  }

  async function saveEdit(value: ListenerFormValue) {
    const res = await fetch(`/api/listeners/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save changes");
    setListener(data.listener);
    setTab("results");
  }

  async function remove() {
    if (!listener) return;
    if (!window.confirm(`Delete "${listener.name}"? This can't be undone.`))
      return;
    await fetch(`/api/listeners/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (state === "loading") {
    return (
      <div>
        <div className="loading-line" style={{ height: 50, maxWidth: 320 }} />
        <div className="loading-line" />
        <div className="loading-line" />
      </div>
    );
  }

  if (state === "missing" || !listener) {
    return (
      <div className="empty">
        <h2>Listener not found</h2>
        <p className="subtle">It may have been deleted.</p>
        <div style={{ marginTop: 18 }}>
          <Link href="/" className="btn">
            ← Back to all listeners
          </Link>
        </div>
      </div>
    );
  }

  const activeSources = listener.sources.filter((s) => s.enabled).length;

  // "next auto-scan in 5h" — purely cosmetic, computed from interval
  // and last run time. Defaults to once daily.
  const intervalMin = listener.scanIntervalMinutes ?? 1440;
  const lastRunMs = listener.lastRunAt
    ? new Date(listener.lastRunAt).getTime()
    : 0;
  const nextRunMs = lastRunMs
    ? lastRunMs + intervalMin * 60_000
    : Date.now();
  const minsUntilNext = Math.max(
    0,
    Math.round((nextRunMs - Date.now()) / 60_000),
  );
  function fmtMins(m: number): string {
    if (m <= 0) return "due now";
    if (m < 60) return `in ${m}m`;
    if (m < 1440) return `in ${Math.round(m / 60)}h`;
    return `in ${Math.round(m / 1440)}d`;
  }

  return (
    <div>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <Link
            href="/"
            className="faint"
            style={{ display: "inline-block", marginBottom: 6 }}
          >
            ← All listeners
          </Link>
          <h1>{listener.name}</h1>
          <p className="subtle">
            {listener.subject || "No subject set"} · {activeSources} active
            source{activeSources === 1 ? "" : "s"} ·{" "}
            {listener.lastRunAt
              ? `last scan ${timeAgo(listener.lastRunAt)}`
              : "never scanned"}
            {" · "}
            <span
              title={`Auto-scan every ${intervalMin >= 1440 ? `${Math.round(intervalMin / 1440)}d` : intervalMin >= 60 ? `${Math.round(intervalMin / 60)}h` : `${intervalMin}m`}`}
            >
              next auto-scan {fmtMins(minsUntilNext)}
            </span>
          </p>
        </div>
        <div className="row">
          <button className="btn btn-danger btn-sm" onClick={remove}>
            Delete
          </button>
          <button
            className="btn btn-primary"
            onClick={runScan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <span className="spinner" /> Scanning…
              </>
            ) : (
              "▶ Run scan"
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="banner error">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="banner-mascot"
            src="/poses/error.svg"
            alt=""
            aria-hidden
          />
          <div>
            <b>Scan failed.</b> {error}
          </div>
        </div>
      ) : null}
      {scanning ? (
        <div className="banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="banner-mascot running"
            src="/poses/loading.svg"
            alt=""
            aria-hidden
          />
          <div>
            Pulling and scoring {activeSources} source
            {activeSources === 1 ? "" : "s"} — this usually takes a few
            seconds.
          </div>
        </div>
      ) : null}
      {scanSuccess && !scanning && !error ? (
        <div className="banner success">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="banner-mascot"
            src="/poses/success.svg"
            alt=""
            aria-hidden
          />
          <div>
            <b>Scan complete.</b>{" "}
            {listener.lastResult?.ranked?.length ?? 0} result
            {(listener.lastResult?.ranked?.length ?? 0) === 1 ? "" : "s"}.
          </div>
        </div>
      ) : null}

      <div className="tabs">
        <button
          className={`tab ${tab === "results" ? "active" : ""}`}
          onClick={() => setTab("results")}
        >
          Results
        </button>
        <button
          className={`tab ${tab === "settings" ? "active" : ""}`}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>

      {tab === "results" ? (
        <ScanResults
          result={listener.lastResult ?? null}
          subjects={listener.subjects}
        />
      ) : (
        <ListenerForm
          initial={{
            name: listener.name,
            subject: listener.subject,
            mode: listener.mode ?? "news",
            visibility: listener.visibility ?? "private",
            scanIntervalMinutes: listener.scanIntervalMinutes,
            slackWebhookUrl: listener.slackWebhookUrl,
            slackMinScore: listener.slackMinScore,
            keywords: listener.keywords,
            sources: listener.sources,
          }}
          submitLabel="Save changes"
          onSubmit={saveEdit}
        />
      )}
    </div>
  );
}
