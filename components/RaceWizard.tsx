"use client";

import { useState } from "react";
import type {
  Coverage,
  RaceCandidate,
  RaceInput,
} from "@/lib/autofill";
import type {
  FeedSource,
  KeywordBundle,
  ListenerVisibility,
  SubjectDef,
} from "@/lib/types";
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

export interface RaceWizardResult {
  name: string;
  subject: string;
  mode: "race";
  visibility: ListenerVisibility;
  context?: string;
  subjects: SubjectDef[];
  maxAgeDays?: number;
  keywords: KeywordBundle;
  sources: FeedSource[];
}

interface Props {
  onSubmit: (value: RaceWizardResult) => Promise<void>;
}

// Each candidate row is editable in place. Add / remove inline.
interface CandRow {
  id: string;
  name: string;
  context: string;
  expanded: boolean;
  handles: NonNullable<RaceCandidate["handles"]>;
}

function freshCand(): CandRow {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: "",
    context: "",
    expanded: false,
    handles: {},
  };
}

export default function RaceWizard({ onSubmit }: Props) {
  const [step, setStep] = useState(1);
  const [raceName, setRaceName] = useState("");
  const [raceContext, setRaceContext] = useState("");
  const [candidates, setCandidates] = useState<CandRow[]>([
    freshCand(),
    freshCand(),
  ]);
  const [maxAgeDays, setMaxAgeDays] = useState<number>(90);
  const [visibility, setVisibility] = useState<ListenerVisibility>("private");
  const [coverage, setCoverage] = useState<Coverage>({
    ofThem: true,
    aboutThem: true,
    newsClips: true,
    articles: true,
    social: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    keywords: KeywordBundle;
    sources: FeedSource[];
  } | null>(null);

  function patchCand(i: number, p: Partial<CandRow>) {
    setCandidates((prev) => prev.map((c, j) => (j === i ? { ...c, ...p } : c)));
  }
  function patchHandles(
    i: number,
    p: Partial<NonNullable<RaceCandidate["handles"]>>,
  ) {
    setCandidates((prev) =>
      prev.map((c, j) =>
        j === i ? { ...c, handles: { ...c.handles, ...p } } : c,
      ),
    );
  }
  function addCand() {
    setCandidates((prev) => [...prev, freshCand()]);
  }
  function removeCand(i: number) {
    setCandidates((prev) => prev.filter((_, j) => j !== i));
  }

  const filledCandidates = candidates.filter((c) => c.name.trim());

  async function fetchPreview() {
    setError(null);
    if (!raceName.trim()) {
      setError("Give the race a name.");
      return;
    }
    if (filledCandidates.length < 1) {
      setError("Add at least one candidate.");
      return;
    }
    setBusy(true);
    try {
      const body: RaceInput & { mode: "race" } = {
        mode: "race",
        name: raceName.trim(),
        context: raceContext.trim() || undefined,
        candidates: filledCandidates.map((c) => ({
          name: c.name.trim(),
          context: c.context.trim() || undefined,
          handles: Object.fromEntries(
            Object.entries(c.handles).filter(([_, v]) => v && v.trim()),
          ) as RaceCandidate["handles"],
        })),
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
      const subjects: SubjectDef[] = filledCandidates.map((c) => ({
        name: c.name.trim(),
        context: c.context.trim() || undefined,
        handles: Object.fromEntries(
          Object.entries(c.handles).filter(([_, v]) => v && v.trim()),
        ) as SubjectDef["handles"],
      }));
      await onSubmit({
        name: raceName.trim(),
        subject: raceName.trim(),
        mode: "race",
        visibility,
        context: raceContext.trim() || undefined,
        subjects,
        maxAgeDays: maxAgeDays > 0 ? maxAgeDays : undefined,
        keywords: preview.keywords,
        sources: preview.sources,
      });
    } catch (e: any) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  }

  const canNextFromStep1 = raceName.trim().length > 0;
  const canNextFromStep2 = filledCandidates.length >= 1;

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

      <div className="banner" style={{ marginBottom: 16 }}>
        🏁 <b>Race mode</b> — track multiple candidates plus the race
        itself. Results get tagged by candidate so you can filter on
        the fly.
      </div>

      {/* ── STEP 1: race basics ──────────────────────────────────── */}
      {step === 1 ? (
        <div className="panel">
          <h2>Which race?</h2>
          <div className="field">
            <label>Race name</label>
            <input
              type="text"
              value={raceName}
              placeholder="e.g. 2026 Arizona Senate Race"
              onChange={(e) => setRaceName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>
              Context <span className="hint">— optional</span>
            </label>
            <input
              type="text"
              value={raceContext}
              placeholder="e.g. US Senate, Arizona, 2026 cycle"
              onChange={(e) => setRaceContext(e.target.value)}
            />
            <p className="faint" style={{ marginTop: 6, fontSize: 12 }}>
              Used to disambiguate searches and as a score boost on
              relevant items.
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
              disabled={!canNextFromStep1}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 2: candidates ───────────────────────────────────── */}
      {step === 2 ? (
        <div className="panel">
          <h2>Who's running?</h2>
          <p className="subtle" style={{ marginBottom: 14 }}>
            Add each candidate. Their official handles are optional but
            increase result quality — their own posts become high-trust
            sources.
          </p>

          <div className="stack" style={{ gap: 10 }}>
            {candidates.map((c, i) => (
              <div
                key={c.id}
                className="panel"
                style={{ padding: 12, marginBottom: 0 }}
              >
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={c.name}
                    placeholder={`Candidate ${i + 1} name`}
                    onChange={(e) => patchCand(i, { name: e.target.value })}
                    style={{ flex: "2 1 200px" }}
                  />
                  <input
                    type="text"
                    value={c.context}
                    placeholder="party / role (optional)"
                    onChange={(e) => patchCand(i, { context: e.target.value })}
                    style={{ flex: "1 1 160px" }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => patchCand(i, { expanded: !c.expanded })}
                    title="Toggle handles"
                  >
                    {c.expanded ? "− handles" : "+ handles"}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Remove candidate"
                    onClick={() => removeCand(i)}
                  >
                    ✕
                  </button>
                </div>

                {c.expanded ? (
                  <div
                    className="stack"
                    style={{ gap: 6, marginTop: 10, paddingLeft: 4 }}
                  >
                    {(
                      [
                        ["youtube", "@YouTubeHandle"],
                        ["tiktok", "@tiktokhandle"],
                        ["instagram", "@instagramhandle"],
                        ["x", "@XHandle"],
                        ["facebook", "facebook.com/page"],
                      ] as const
                    ).map(([k, ph]) => (
                      <input
                        key={k}
                        type="text"
                        value={c.handles[k] ?? ""}
                        placeholder={ph}
                        onChange={(e) =>
                          patchHandles(i, { [k]: e.target.value } as any)
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={addCand}
            style={{ marginTop: 12 }}
          >
            + Add another candidate
          </button>

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
          <h2>How recent?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            Older content is dropped entirely.
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
            Each toggle applies to every candidate plus the race itself.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            <CovCheck
              checked={!!coverage.ofThem}
              onChange={(v) => setCoverage((p) => ({ ...p, ofThem: v }))}
              label="🎤 Their own posts"
              hint="needs the handles you added in step 2"
            />
            <CovCheck
              checked={!!coverage.aboutThem}
              onChange={(v) => setCoverage((p) => ({ ...p, aboutThem: v }))}
              label="🗣 Videos ABOUT each candidate"
              hint="searches across YouTube / TikTok / Instagram"
            />
            <CovCheck
              checked={!!coverage.newsClips}
              onChange={(v) => setCoverage((p) => ({ ...p, newsClips: v }))}
              label="📺 News clips (race-wide)"
              hint="CNN, Fox, MSNBC, ABC, CBS, NBC, PBS, C-SPAN, Reuters + more"
            />
            <CovCheck
              checked={!!coverage.articles}
              onChange={(v) => setCoverage((p) => ({ ...p, articles: v }))}
              label="📰 News articles"
              hint="Google News, Bing News, Brave News on the race"
            />
            <CovCheck
              checked={!!coverage.social}
              onChange={(v) => setCoverage((p) => ({ ...p, social: v }))}
              label="💬 Race-level social"
              hint="Reddit + Bluesky searches for the race itself"
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

      {/* ── STEP 5: preview ──────────────────────────────────────── */}
      {step === 5 && preview ? (
        <div className="panel">
          <h2>Ready to listen?</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            {filledCandidates.length} candidate
            {filledCandidates.length === 1 ? "" : "s"} ·{" "}
            {preview.sources.filter((s) => s.enabled).length} active
            source{preview.sources.filter((s) => s.enabled).length === 1 ? "" : "s"}
            {maxAgeDays > 0
              ? ` · ${TIME_OPTIONS.find((t) => t.days === maxAgeDays)?.label.toLowerCase()}`
              : " · no time limit"}
          </p>

          <div className="field" style={{ marginBottom: 4 }}>
            <label>Visibility</label>
            <VisibilityPicker value={visibility} onChange={setVisibility} small />
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, margin: "8px 0" }}>Tracking</h3>
            <div className="faint" style={{ fontSize: 13, marginBottom: 4 }}>
              <b>Race:</b> {raceName}
            </div>
            <div className="faint" style={{ fontSize: 13 }}>
              <b>Candidates:</b> {filledCandidates.map((c) => c.name).join(", ")}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, margin: "8px 0" }}>
              {preview.sources.length} sources
            </h3>
            <details>
              <summary
                style={{ cursor: "pointer", fontSize: 12, color: "var(--text-dim)" }}
              >
                Show source list
              </summary>
              <div className="stack" style={{ gap: 4, marginTop: 8 }}>
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
            </details>
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
              disabled={busy}
            >
              {busy ? "Saving…" : "Save & start listening"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CovCheck({
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
