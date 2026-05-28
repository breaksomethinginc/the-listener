"use client";

import { useState } from "react";
import type {
  FeedSource,
  KeywordBundle,
  ListenerMode,
  ListenerVisibility,
  Platform,
} from "@/lib/types";
import VisibilityPicker from "./VisibilityPicker";

const PLATFORM_OPTIONS: Platform[] = [
  "rss", "youtube", "rumble", "x", "truthsocial", "substack",
  "reddit", "bluesky", "mastodon", "instagram", "tiktok", "facebook",
  "threads", "discord", "apify", "brave",
];

type EditSource = FeedSource & { apifyInputText?: string };

export interface ListenerFormValue {
  name: string;
  subject: string;
  mode: ListenerMode;
  visibility?: ListenerVisibility;
  keywords: KeywordBundle;
  sources: FeedSource[];
}

interface Props {
  initial?: Partial<ListenerFormValue>;
  submitLabel: string;
  onSubmit: (value: ListenerFormValue) => Promise<void>;
}

function rid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toEditSource(s: FeedSource): EditSource {
  return {
    ...s,
    apifyInputText: s.apifyInput ? JSON.stringify(s.apifyInput, null, 2) : "",
  };
}

export default function ListenerForm({ initial, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [mode, setMode] = useState<ListenerMode>(initial?.mode ?? "news");
  const [visibility, setVisibility] = useState<ListenerVisibility>(
    initial?.visibility ?? "private",
  );
  const [kwAny, setKwAny] = useState((initial?.keywords?.any ?? []).join(", "));
  const [kwBoost, setKwBoost] = useState(
    (initial?.keywords?.boost ?? []).join(", "),
  );
  const [kwVeto, setKwVeto] = useState(
    (initial?.keywords?.veto ?? []).join(", "),
  );
  const [sources, setSources] = useState<EditSource[]>(
    (initial?.sources ?? []).map(toEditSource),
  );
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function autofill() {
    const s = subject.trim();
    if (!s) {
      setError("Type a subject first, then auto-fill.");
      return;
    }
    setError(null);
    setSuggesting(true);
    try {
      const res = await fetch(
        `/api/suggest?subject=${encodeURIComponent(s)}&mode=${mode}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build suggestions");
      const k: KeywordBundle = data.keywords;
      setKwAny(k.any.join(", "));
      setKwBoost(k.boost.join(", "));
      setKwVeto(k.veto.join(", "));
      setSources((data.sources as FeedSource[]).map(toEditSource));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSuggesting(false);
    }
  }

  function patchSource(idx: number, patch: Partial<EditSource>) {
    setSources((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }

  function addSource() {
    setSources((prev) => [
      ...prev,
      {
        id: `src-${rid()}`,
        label: "New source",
        url: "",
        platform: "rss",
        enabled: true,
        trustWeight: 1,
        apifyInputText: "",
      },
    ]);
  }

  function removeSource(idx: number) {
    setSources((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Give your listener a name.");
      return;
    }
    // Validate / pack Apify JSON inputs.
    const packed: FeedSource[] = [];
    for (const s of sources) {
      let apifyInput: Record<string, unknown> | undefined;
      if (s.platform === "apify" && s.apifyInputText?.trim()) {
        try {
          apifyInput = JSON.parse(s.apifyInputText);
        } catch {
          setError(`The Apify input for "${s.label}" is not valid JSON.`);
          return;
        }
      }
      const { apifyInputText, ...rest } = s;
      packed.push({ ...rest, apifyInput });
    }

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        subject: subject.trim(),
        mode,
        visibility,
        keywords: {
          any: splitList(kwAny),
          boost: splitList(kwBoost),
          veto: splitList(kwVeto),
        },
        sources: packed,
      });
    } catch (e: any) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  }

  return (
    <div>
      {error ? <div className="banner error">⚠ {error}</div> : null}

      <div className="panel">
        <h2>Basics</h2>
        <div className="field">
          <label>Type</label>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === "news" ? "btn-primary" : ""}`}
              onClick={() => setMode("news")}
              title="Articles, social posts, broad news coverage"
            >
              📰 News
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === "video" ? "btn-primary" : ""}`}
              onClick={() => setMode("video")}
              title="Videos of (and about) your subject across YouTube, TikTok, Instagram, Facebook"
            >
              🎥 Video
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === "voices" ? "btn-primary" : ""}`}
              onClick={() => setMode("voices")}
              title="Real people only — TikTok / IG / Threads / FB"
            >
              🗣 Voices
            </button>
            <span className="faint" style={{ fontSize: 12 }}>
              {mode === "video"
                ? "Pulls YouTube, TikTok, Instagram, Facebook + news channels."
                : mode === "voices"
                  ? "Pulls TikTok, Instagram, Threads, Facebook — no outlets."
                  : "Pulls Google News, Bing News, Reddit, Bluesky, Mastodon."}
            </span>
          </div>
        </div>
        <div className="field">
          <label>Visibility</label>
          <VisibilityPicker value={visibility} onChange={setVisibility} small />
        </div>
        <div className="field">
          <label>Listener name</label>
          <input
            type="text"
            value={name}
            placeholder="e.g. Fed rate watch"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 6 }}>
          <label>
            Subject <span className="hint">— what you want to track</span>
          </label>
          <div className="row">
            <input
              type="text"
              value={subject}
              placeholder="e.g. Federal Reserve interest rates"
              onChange={(e) => setSubject(e.target.value)}
              onBlur={() => {
                if (subject.trim() && sources.length === 0) autofill();
              }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={autofill}
              disabled={suggesting}
              style={{ whiteSpace: "nowrap" }}
            >
              {suggesting ? "Building…" : "✨ Auto-fill"}
            </button>
          </div>
        </div>
        <p className="faint">
          Auto-fill turns your subject into starter keywords and free
          zero-key sources. Tweak anything below.
        </p>
      </div>

      <div className="panel">
        <h2>Keywords — the editorial filter</h2>
        <div className="field">
          <label>
            Must include <span className="hint">— at least one required</span>
          </label>
          <textarea
            value={kwAny}
            placeholder="comma, separated, terms"
            onChange={(e) => setKwAny(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Boost <span className="hint">— extra score when present</span>
          </label>
          <textarea
            value={kwBoost}
            placeholder="breaking, exclusive, report"
            onChange={(e) => setKwBoost(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>
            Veto <span className="hint">— disqualifies an item</span>
          </label>
          <textarea
            value={kwVeto}
            placeholder="sponsored, horoscope"
            onChange={(e) => setKwVeto(e.target.value)}
          />
        </div>
      </div>

      <div className="panel">
        <div className="spread" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Sources — where to listen</h2>
          <button type="button" className="btn btn-sm" onClick={addSource}>
            + Add source
          </button>
        </div>

        {sources.length === 0 ? (
          <p className="faint">
            No sources yet. Use Auto-fill above, or add one manually.
          </p>
        ) : null}

        <div className="stack">
          {sources.map((s, i) => (
            <div
              key={s.id}
              className="source-row"
              style={{
                gridTemplateColumns: "1fr",
                opacity: s.enabled ? 1 : 0.55,
              }}
            >
              <div className="row wrap" style={{ gap: 8 }}>
                <input
                  type="text"
                  value={s.label}
                  placeholder="Label"
                  onChange={(e) => patchSource(i, { label: e.target.value })}
                  style={{ flex: "2 1 180px" }}
                />
                <select
                  value={s.platform}
                  onChange={(e) =>
                    patchSource(i, { platform: e.target.value as Platform })
                  }
                  style={{ flex: "0 0 130px" }}
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <label
                  className="row"
                  style={{ gap: 5, fontSize: 12, color: "var(--text-dim)" }}
                >
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) =>
                      patchSource(i, { enabled: e.target.checked })
                    }
                    style={{ width: "auto" }}
                  />
                  on
                </label>
                <input
                  type="number"
                  value={s.trustWeight}
                  min={0}
                  max={2}
                  step={0.1}
                  title="Trust weight (0–2)"
                  onChange={(e) =>
                    patchSource(i, { trustWeight: Number(e.target.value) })
                  }
                  style={{ flex: "0 0 64px" }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove source"
                  onClick={() => removeSource(i)}
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                className="src-url"
                value={s.url}
                placeholder="feed URL, @handle, r/Subreddit, or search phrase"
                onChange={(e) => patchSource(i, { url: e.target.value })}
                style={{ marginTop: 8 }}
              />
              {s.platform === "apify" ? (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    value={s.apifyActor ?? ""}
                    placeholder="Apify actor, e.g. apify/instagram-scraper"
                    onChange={(e) =>
                      patchSource(i, { apifyActor: e.target.value })
                    }
                  />
                  <textarea
                    value={s.apifyInputText ?? ""}
                    placeholder='Apify input JSON, e.g. {"usernames":["nasa"]}'
                    onChange={(e) =>
                      patchSource(i, { apifyInputText: e.target.value })
                    }
                    style={{ marginTop: 8, fontFamily: "ui-monospace, monospace" }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function splitList(v: string): string[] {
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
