"use client";

import { useState } from "react";

// Standard cadence presets, expressed in minutes.
const PRESETS: { label: string; minutes: number }[] = [
  { label: "Hourly", minutes: 60 },
  { label: "Every 2 hours", minutes: 120 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Twice a day", minutes: 720 },
  { label: "Once a day", minutes: 1440 },
  { label: "Every other day", minutes: 2880 },
  { label: "Weekly", minutes: 10080 },
];

type Unit = "hour" | "day" | "week";

interface Props {
  value: number | undefined;
  /** Always called with a positive number of minutes (≥60). */
  onChange: (minutes: number) => void;
}

/**
 * Per-listener auto-scan frequency picker. Presets row + an "X times per
 * [hour|day|week]" composer for anything in between.
 *
 * Minimum is 60 minutes — Vercel Cron fires at minute :00 every hour,
 * so we can't go faster than that anyway.
 */
export default function ScanFrequencyPicker({ value, onChange }: Props) {
  const current = value && value > 0 ? value : 1440;

  // Custom composer state — only used when no preset matches.
  const matchedPreset = PRESETS.find((p) => p.minutes === current);
  const [customTimes, setCustomTimes] = useState<number>(() => {
    if (matchedPreset) return 1;
    return guessTimesForInterval(current);
  });
  const [customUnit, setCustomUnit] = useState<Unit>(() => {
    if (matchedPreset) return "day";
    return guessUnitForInterval(current);
  });

  function applyCustom(times: number, unit: Unit) {
    const t = Math.max(1, Math.floor(times));
    const unitMin = unit === "hour" ? 60 : unit === "day" ? 1440 : 10080;
    const minutes = Math.max(60, Math.floor(unitMin / t));
    onChange(minutes);
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {PRESETS.map((p) => {
          const active = current === p.minutes;
          return (
            <button
              key={p.minutes}
              type="button"
              className={`btn btn-sm ${active ? "btn-primary" : ""}`}
              onClick={() => onChange(p.minutes)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <span className="faint" style={{ fontSize: 12 }}>
          or
        </span>
        <input
          type="number"
          min={1}
          max={24}
          value={customTimes}
          onChange={(e) => {
            const n = Number(e.target.value);
            setCustomTimes(Number.isFinite(n) ? n : 1);
            applyCustom(Number.isFinite(n) ? n : 1, customUnit);
          }}
          style={{ width: 72 }}
        />
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
          time{customTimes === 1 ? "" : "s"} per
        </span>
        <select
          value={customUnit}
          onChange={(e) => {
            const u = e.target.value as Unit;
            setCustomUnit(u);
            applyCustom(customTimes, u);
          }}
          style={{ width: 100 }}
        >
          <option value="hour">hour</option>
          <option value="day">day</option>
          <option value="week">week</option>
        </select>
      </div>

      <p className="faint" style={{ fontSize: 12, margin: 0 }}>
        Currently auto-scanning {describe(current)}. The cron runs at the
        top of each hour and skips listeners that aren&apos;t due yet.
      </p>
    </div>
  );
}

function describe(min: number): string {
  if (min < 60) return `every ${min} minutes`;
  if (min === 60) return "every hour";
  if (min < 1440) {
    const h = Math.round(min / 60);
    return `every ${h} hour${h === 1 ? "" : "s"}`;
  }
  if (min === 1440) return "once a day";
  if (min < 10080) {
    const d = Math.round(min / 1440);
    return `every ${d} day${d === 1 ? "" : "s"}`;
  }
  const w = Math.round(min / 10080);
  return `every ${w} week${w === 1 ? "" : "s"}`;
}

function guessTimesForInterval(min: number): number {
  // Walk the most likely "X times per day" interpretation.
  const perDay = Math.round(1440 / min);
  if (perDay >= 1 && perDay <= 24) return perDay;
  return 1;
}

function guessUnitForInterval(min: number): Unit {
  if (min < 60) return "hour";
  if (min < 1440) return "day";
  if (min < 10080) return "day";
  return "week";
}
