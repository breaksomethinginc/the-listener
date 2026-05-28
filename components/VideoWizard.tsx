"use client";

import { useState } from "react";
import type {
  AutofillInput,
  Coverage,
  SubjectHandles,
} from "@/lib/autofill";
import type {
  FeedSource,
  KeywordBundle,
  ListenerKind,
  ListenerVisibility,
} from "@/lib/types";
import VisibilityPicker from "./VisibilityPicker";

// ── helpers ──────────────────────────────────────────────────────────
const KIND_OPTIONS: { value: ListenerKind; label: string; hint: string }[] = [
  { value: "person", label: "🧑 A person", hint: "politician, exec, creator, celebrity" },
  { value: "organization", label: "🏢 An organization", hint: "company, campaign, agency" },
  { value: "event", label: "📅 An event", hint: "election, summit, conference, controversy" },
  { value: "topic", label: "💡 A topic", hint: "issue, trend, policy area" },
];

const TIME_OPTIONS: { days: number; label: string }[] = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
  { days: 0, label: "All time" },
];

export interface WizardResult {
  name: string;
  subject: string;
  mode: "video";
  visibility: ListenerVisibility;
  kind: ListenerKind;
  context?: string;
  maxAgeDays?: number;
  keywords: KeywordBundle;
  sources: FeedSource[];
}

interface Props {
  onSubmit: (value: WizardResult) => Promise<void>;
}

// ── component ────────────────────────────────────────────────────────
export default function VideoWizard({ onSubmit }: Props) {
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ListenerKind>("person");
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [handles, setHandles] = useState<SubjectHandles>({});
  const [maxAgeDays, setMaxAgeDays] = useState<number>(90);
  const [visibility, setVisibility] = useState<ListenerVisibility>("private");
  const [coverage, setCoverage] = useState<Coverage>({
    ofThem: true,
    aboutThem: true,
    newsClips: true,
    articles: false, // video mode default — focus on video, not articles
    social: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    keywords: KeywordBundle;
    sources: FeedSource[];
  } | null>(null);

  function patchHandles(p: Partial<SubjectHandles>) {
    setHandles((prev) => ({ ...prev, ...p }));
  }
  function patchCoverage(p: Partial<Coverage>) {
    setCoverage((prev) => ({ ...prev, ...p }));
  }

  async function fetchPreview() {
    setError(null);
    setBusy(true);
    try {
      const body: AutofillInput = {
        kind,
        name: name.trim(),
        context: context.trim() || undefined,
        handles,
        coverage,
        maxAgeDays: maxAgeDays > 0 ? maxAgeDays : undefined,
      };
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build autofill");
      setPreview({ keywords: data.keywords, sources: data.sources });
      setStep(5);
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
        name: name.trim() || `${name} listener`,
        subject: name.trim(),
        mode: "video",
        visibility,
        kind,
        context: context.trim() || undefined,
        maxAgeDays: maxAgeDays > 0 ? maxAgeDays : undefined,
        keywords: preview.keywords,
        sources: preview.sources,
      });
    } catch (e: any) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  }

  const canNextFromStep1 = !!kind;
  const canNextFromStep2 = name.trim().length > 0;

  return (
    <div>
      {/* Progress dots */}
      <div className="row" style={{ gap: 8, marginBottom: 24 }}>
        {[1, 2, 3, 4, 5].map((n) => (
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

      {/* ── STEP 1: kind ─────────────────────────────────────────── */}
      {step === 1 ? (
        <div className="panel">
          <h2>What are you tracking?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            Pick the closest match — it shapes how we search.
          </p>
          <div className="stack" style={{ gap: 10 }}>
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn ${kind === opt.value ? "btn-primary" : ""}`}
                onClick={() => setKind(opt.value)}
                style={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  padding: "14px 16px",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  {opt.label}
                </span>
                <span
                  className="faint"
                  style={{ marginLeft: 10, fontSize: 13 }}
                >
                  {opt.hint}
                </span>
              </button>
            ))}
          </div>
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 20 }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(2)}
              disabled={!canNextFromStep1}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 2: details ──────────────────────────────────────── */}
      {step === 2 ? (
        <div className="panel">
          <h2>
            {kind === "person"
              ? "Who is it?"
              : kind === "organization"
                ? "Which organization?"
                : kind === "event"
                  ? "Which event?"
                  : "Which topic?"}
          </h2>
          <div className="field">
            <label>
              {kind === "person"
                ? "Their full name"
                : kind === "organization"
                  ? "Organization name"
                  : "Subject"}
            </label>
            <input
              type="text"
              value={name}
              placeholder={
                kind === "person"
                  ? "e.g. Mark Kelly"
                  : kind === "organization"
                    ? "e.g. OpenAI"
                    : kind === "event"
                      ? "e.g. 2026 midterm elections"
                      : "e.g. AI regulation"
              }
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label>
              Context <span className="hint">— helps disambiguate</span>
            </label>
            <input
              type="text"
              value={context}
              placeholder={
                kind === "person"
                  ? "e.g. US Senator, Arizona, Democrat"
                  : kind === "organization"
                    ? "e.g. AI lab, San Francisco"
                    : "e.g. policy, congressional hearings"
              }
              onChange={(e) => setContext(e.target.value)}
            />
            <p className="faint" style={{ marginTop: 6, fontSize: 12 }}>
              Used to narrow searches (e.g. "Mark Kelly" + "senator"
              filters out other Mark Kellys). Skip if not needed.
            </p>
          </div>

          {kind === "person" || kind === "organization" ? (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", padding: "6px 0" }}>
                Optional: their social handles{" "}
                <span className="faint">
                  — adds their own posts as high-trust sources
                </span>
              </summary>
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>YouTube</label>
                  <input
                    type="text"
                    value={handles.youtube ?? ""}
                    placeholder="@SenMarkKelly"
                    onChange={(e) => patchHandles({ youtube: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>TikTok</label>
                  <input
                    type="text"
                    value={handles.tiktok ?? ""}
                    placeholder="@senmarkkelly"
                    onChange={(e) => patchHandles({ tiktok: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Instagram</label>
                  <input
                    type="text"
                    value={handles.instagram ?? ""}
                    placeholder="@senmarkkelly"
                    onChange={(e) => patchHandles({ instagram: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>X / Twitter</label>
                  <input
                    type="text"
                    value={handles.x ?? ""}
                    placeholder="@SenMarkKelly"
                    onChange={(e) => patchHandles({ x: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Facebook</label>
                  <input
                    type="text"
                    value={handles.facebook ?? ""}
                    placeholder="https://facebook.com/senmarkkelly or page slug"
                    onChange={(e) => patchHandles({ facebook: e.target.value })}
                  />
                </div>
              </div>
            </details>
          ) : null}

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
              disabled={!canNextFromStep2}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 3: time window ──────────────────────────────────── */}
      {step === 3 ? (
        <div className="panel">
          <h2>How far back?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            Older content gets dropped entirely. Set this loose if you're
            just exploring, tighter if you want fresh clips.
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
              onClick={() => setStep(4)}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 4: coverage ─────────────────────────────────────── */}
      {step === 4 ? (
        <div className="panel">
          <h2>What kind of coverage?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            Pick whatever's useful. Each one adds a set of sources.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            <CoverageCheck
              checked={!!coverage.ofThem}
              onChange={(v) => patchCoverage({ ofThem: v })}
              label="🎤 Videos OF them"
              hint="their own YouTube/TikTok/IG/X feeds (needs handles above)"
            />
            <CoverageCheck
              checked={!!coverage.aboutThem}
              onChange={(v) => patchCoverage({ aboutThem: v })}
              label="🗣 Videos ABOUT them"
              hint="searches across YouTube / TikTok / Instagram"
            />
            <CoverageCheck
              checked={!!coverage.newsClips}
              onChange={(v) => patchCoverage({ newsClips: v })}
              label="📺 News clips"
              hint="CNN, Fox, MSNBC, ABC, CBS, NBC, PBS, C-SPAN, Reuters + more"
            />
            <CoverageCheck
              checked={!!coverage.articles}
              onChange={(v) => patchCoverage({ articles: v })}
              label="📰 News articles"
              hint="Google News, Bing News, Brave News (text)"
            />
            <CoverageCheck
              checked={!!coverage.social}
              onChange={(v) => patchCoverage({ social: v })}
              label="💬 Social discussion"
              hint="Reddit, Bluesky, Mastodon"
            />
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
              onClick={fetchPreview}
              disabled={busy}
            >
              {busy ? "Building…" : "Preview →"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 5: preview + save ───────────────────────────────── */}
      {step === 5 && preview ? (
        <div className="panel">
          <h2>Looks good?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            {preview.sources.length} source
            {preview.sources.length === 1 ? "" : "s"} ·{" "}
            {preview.sources.filter((s) => s.enabled).length} active on
            first scan
            {maxAgeDays > 0
              ? ` · ${TIME_OPTIONS.find((t) => t.days === maxAgeDays)?.label.toLowerCase()}`
              : " · no time limit"}
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

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, margin: "8px 0" }}>Keywords</h3>
            <div className="faint" style={{ fontSize: 13, marginBottom: 4 }}>
              <b>Must include:</b> {preview.keywords.any.join(", ") || "—"}
            </div>
            {preview.keywords.boost.length > 0 ? (
              <div className="faint" style={{ fontSize: 13 }}>
                <b>Boost:</b> {preview.keywords.boost.join(", ")}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, margin: "8px 0" }}>
              Sources we'll pull
            </h3>
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
              You can edit, add, or remove sources in the Settings tab
              after saving.
            </p>
          </div>

          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 20 }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(4)}
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

function CoverageCheck({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className="row"
      style={{
        gap: 12,
        padding: "10px 12px",
        borderRadius: 6,
        background: checked
          ? "rgba(61, 215, 198, 0.08)"
          : "var(--bg-soft, transparent)",
        border: "1px solid var(--border-soft)",
        cursor: "pointer",
        alignItems: "flex-start",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: "auto", marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div className="faint" style={{ fontSize: 12 }}>
          {hint}
        </div>
      </div>
    </label>
  );
}
