"use client";

import { useState } from "react";
import type {
  FeedSource,
  KeywordBundle,
  ListenerVisibility,
} from "@/lib/types";
import ScanFrequencyPicker from "./ScanFrequencyPicker";
import VisibilityPicker from "./VisibilityPicker";

export interface QuickStartResult {
  name: string;
  subject: string;
  mode: "news";
  visibility: ListenerVisibility;
  scanIntervalMinutes?: number;
  keywords: KeywordBundle;
  sources: FeedSource[];
}

interface Props {
  onSubmit: (value: QuickStartResult) => Promise<void>;
}

/**
 * News quick-start: just name + subject. We auto-generate sensible
 * sources + keywords behind the scenes via the legacy GET /api/suggest
 * endpoint. User can still customize everything in Settings after save.
 */
export default function NewsQuickStart({ onSubmit }: Props) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState<ListenerVisibility>("private");
  const [scanIntervalMinutes, setScanIntervalMinutes] = useState<number>(1440);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const s = subject.trim();
    const n = name.trim();
    if (!s) {
      setError("Type a subject so we know what to listen for.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/suggest?subject=${encodeURIComponent(s)}&mode=news`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build autofill");
      await onSubmit({
        name: n || s,
        subject: s,
        mode: "news",
        visibility,
        scanIntervalMinutes,
        keywords: data.keywords,
        sources: data.sources,
      });
    } catch (e: any) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Set up a news listener</h2>
      <p className="subtle" style={{ marginBottom: 16 }}>
        Type what you're tracking. We'll wire up Google News, Bing News,
        Reddit, Bluesky, Mastodon, and Brave News automatically. You can
        tune sources in Settings after.
      </p>

      {error ? <div className="banner error">⚠ {error}</div> : null}

      <div className="field">
        <label>
          Subject <span className="hint">— required</span>
        </label>
        <input
          type="text"
          value={subject}
          placeholder="e.g. Federal Reserve interest rates"
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          autoFocus
        />
      </div>

      <div className="field">
        <label>
          Listener name <span className="hint">— optional</span>
        </label>
        <input
          type="text"
          value={name}
          placeholder={subject || "e.g. Fed rate watch"}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
      </div>

      <div className="field" style={{ marginBottom: 4 }}>
        <label>Visibility</label>
        <VisibilityPicker value={visibility} onChange={setVisibility} small />
      </div>

      <div className="field" style={{ marginBottom: 4 }}>
        <label>Auto-scan frequency</label>
        <ScanFrequencyPicker
          value={scanIntervalMinutes}
          onChange={setScanIntervalMinutes}
        />
      </div>

      <div
        className="row"
        style={{ justifyContent: "flex-end", marginTop: 16 }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Creating…" : "Create listener"}
        </button>
      </div>
    </div>
  );
}
