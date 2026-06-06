"use client";

import { useState } from "react";
import type { VoicesInput } from "@/lib/autofill";
import type {
  FeedSource,
  KeywordBundle,
  ListenerVisibility,
} from "@/lib/types";
import ScanFrequencyPicker from "./ScanFrequencyPicker";
import VisibilityPicker from "./VisibilityPicker";

// ── time options ─────────────────────────────────────────────────────
const TIME_OPTIONS: { days: number; label: string }[] = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
  { days: 0, label: "All time" },
];

// ── audience tiers ───────────────────────────────────────────────────
// Standard creator-economy bands. 0 = no cap.
const AUDIENCE_TIERS: {
  cap: number;
  label: string;
  hint: string;
}[] = [
  { cap: 0, label: "🌍 No limit", hint: "anyone, big or small" },
  { cap: 1_000, label: "🌱 Under 1K", hint: "very small / nano creators" },
  { cap: 10_000, label: "🪴 Under 10K", hint: "small / emerging creators" },
  { cap: 100_000, label: "🌳 Under 100K", hint: "micro-influencer range" },
  { cap: 1_000_000, label: "🏙 Under 1M", hint: "mid-tier creators" },
];

export interface VoicesWizardResult {
  name: string;
  subject: string;
  mode: "voices";
  visibility: ListenerVisibility;
  scanIntervalMinutes?: number;
  context?: string;
  maxAgeDays?: number;
  maxAudience?: number;
  keywords: KeywordBundle;
  sources: FeedSource[];
}

interface Props {
  onSubmit: (value: VoicesWizardResult) => Promise<void>;
}

// ── component ────────────────────────────────────────────────────────
export default function VoicesWizard({ onSubmit }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [maxAgeDays, setMaxAgeDays] = useState<number>(90);
  const [includeDiscussion, setIncludeDiscussion] = useState(false);
  const [maxAudience, setMaxAudience] = useState<number>(0); // 0 = no cap
  const [customAudience, setCustomAudience] = useState<string>("");
  const [visibility, setVisibility] = useState<ListenerVisibility>("private");
  const [scanIntervalMinutes, setScanIntervalMinutes] = useState<number>(1440);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    keywords: KeywordBundle;
    sources: FeedSource[];
  } | null>(null);

  async function fetchPreview() {
    setError(null);
    setBusy(true);
    try {
      const body: VoicesInput & { mode: "voices" } = {
        mode: "voices",
        name: name.trim(),
        context: context.trim() || undefined,
        maxAgeDays: maxAgeDays > 0 ? maxAgeDays : undefined,
        includeDiscussion,
      };
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build autofill");
      setPreview({ keywords: data.keywords, sources: data.sources });
      setStep(4);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim() || `${name} (voices)`,
        subject: name.trim(),
        mode: "voices",
        visibility,
        scanIntervalMinutes,
        context: context.trim() || undefined,
        maxAgeDays: maxAgeDays > 0 ? maxAgeDays : undefined,
        maxAudience: maxAudience > 0 ? maxAudience : undefined,
        keywords: preview.keywords,
        sources: preview.sources,
      });
    } catch (e: any) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  }

  const canPreview = name.trim().length > 0;

  return (
    <div>
      {/* Progress dots */}
      <div className="row" style={{ gap: 8, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            style={{
              width: 28,
              height: 4,
              borderRadius: 2,
              background:
                n <= step ? "var(--accent)" : "var(--border-soft)",
              transition: "background 0.15s",
            }}
          />
        ))}
      </div>

      {error ? <div className="banner error">⚠ {error}</div> : null}

      <div className="banner" style={{ marginBottom: 16 }}>
        🗣 <b>Voices mode</b> — only real people on TikTok, Instagram,
        Threads, and Facebook. No news outlets, no press releases, no
        official accounts.
      </div>

      {/* ── STEP 1: subject ──────────────────────────────────────── */}
      {step === 1 ? (
        <div className="panel">
          <h2>Who or what are people talking about?</h2>
          <div className="field">
            <label>
              Person, issue, brand, event{" "}
              <span className="hint">— required</span>
            </label>
            <input
              type="text"
              value={name}
              placeholder="e.g. Mark Kelly  ·  Israel Gaza  ·  Stanley Cup  ·  taxes"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>
              Context <span className="hint">— optional, helps disambiguate</span>
            </label>
            <input
              type="text"
              value={context}
              placeholder="e.g. US Senator, Arizona  ·  policy, healthcare"
              onChange={(e) => setContext(e.target.value)}
            />
            <p className="faint" style={{ marginTop: 6, fontSize: 12 }}>
              Words you'd expect real people to mention alongside the
              subject. We use them as score boosts so the most on-topic
              videos rise to the top.
            </p>
          </div>
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 20 }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(2)}
              disabled={!canPreview}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 2: time window + options ────────────────────────── */}
      {step === 2 ? (
        <div className="panel">
          <h2>How recent?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            Older posts are dropped entirely.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                className={`btn ${maxAgeDays === opt.days ? "btn-primary" : ""}`}
                onClick={() => setMaxAgeDays(opt.days)}
                style={{ justifyContent: "flex-start", padding: "10px 14px" }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <label
              className="row"
              style={{
                gap: 10,
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-soft)",
                cursor: "pointer",
                alignItems: "flex-start",
                background: includeDiscussion
                  ? "rgba(61, 215, 198, 0.08)"
                  : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={includeDiscussion}
                onChange={(e) => setIncludeDiscussion(e.target.checked)}
                style={{ width: "auto", marginTop: 2 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  Also include Reddit / Bluesky / Mastodon discussion
                </div>
                <div className="faint" style={{ fontSize: 12 }}>
                  Text posts, not videos — useful for outreach and
                  sentiment, but adds noise if you only want clips.
                </div>
              </div>
            </label>
          </div>

          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 20 }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(1)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(3)}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 3: max audience ─────────────────────────────────── */}
      {step === 3 ? (
        <div className="panel">
          <h2>Cap on creator size?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            Drop posts from creators with more followers than this.
            Useful when you want to find up-and-coming voices, not
            verified mega-accounts. Items where we can&apos;t determine
            follower count pass through.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {AUDIENCE_TIERS.map((opt) => (
              <button
                key={opt.cap}
                type="button"
                className={`btn ${maxAudience === opt.cap ? "btn-primary" : ""}`}
                onClick={() => {
                  setMaxAudience(opt.cap);
                  setCustomAudience("");
                }}
                style={{
                  justifyContent: "flex-start",
                  padding: "10px 14px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 600 }}>{opt.label}</span>
                <span
                  className="faint"
                  style={{ marginLeft: 10, fontSize: 12 }}
                >
                  {opt.hint}
                </span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-dim)",
                marginBottom: 6,
              }}
            >
              Or set a custom cap (followers)
            </label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={customAudience}
              placeholder="e.g. 25000"
              onChange={(e) => {
                const v = e.target.value;
                setCustomAudience(v);
                const n = parseInt(v, 10);
                if (Number.isFinite(n) && n > 0) setMaxAudience(n);
                else if (v === "") setMaxAudience(0);
              }}
              style={{ width: 200 }}
            />
          </div>

          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 20 }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(2)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={fetchPreview}
              disabled={busy}
            >
              {busy ? "Building…" : "Preview →"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 4: preview + save ───────────────────────────────── */}
      {step === 4 && preview ? (
        <div className="panel">
          <h2>Ready to listen?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            {preview.sources.filter((s) => s.enabled).length} active
            source{preview.sources.filter((s) => s.enabled).length === 1 ? "" : "s"}
            {maxAgeDays > 0
              ? ` · ${TIME_OPTIONS.find((t) => t.days === maxAgeDays)?.label.toLowerCase()}`
              : " · no time limit"}
            {maxAudience > 0
              ? ` · creators ≤ ${maxAudience.toLocaleString()} followers`
              : " · no audience cap"}
          </p>

          <div className="field">
            <label>Listener name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, margin: "8px 0" }}>Keywords</h3>
            <div className="faint" style={{ fontSize: 13, marginBottom: 4 }}>
              <b>Must include:</b> {preview.keywords.any.join(", ") || "—"}
            </div>
            {preview.keywords.boost.length > 0 ? (
              <div className="faint" style={{ fontSize: 13, marginBottom: 4 }}>
                <b>Boost:</b> {preview.keywords.boost.join(", ")}
              </div>
            ) : null}
            {preview.keywords.veto.length > 0 ? (
              <div className="faint" style={{ fontSize: 13 }}>
                <b>Veto:</b> {preview.keywords.veto.join(", ")}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, margin: "8px 0" }}>Sources</h3>
            <div className="stack" style={{ gap: 4 }}>
              {preview.sources.map((s) => (
                <div
                  key={s.id}
                  className="faint"
                  style={{
                    fontSize: 12,
                    opacity: s.enabled ? 1 : 0.55,
                  }}
                >
                  {s.enabled ? "✓" : "○"} {s.label}
                </div>
              ))}
            </div>
            <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
              No news channels, no RSS, no Brave — only real people.
            </p>
          </div>

          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 20 }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(3)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={busy || !name.trim()}
            >
              {busy ? "Saving…" : "Save & start listening"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
