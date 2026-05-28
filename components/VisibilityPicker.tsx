"use client";

import type { ListenerVisibility } from "@/lib/types";

interface Props {
  value: ListenerVisibility;
  onChange: (v: ListenerVisibility) => void;
  small?: boolean;
}

/**
 * Tiny two-button toggle for who can see this listener.
 *   private → only you (the owner)
 *   shared  → anyone signed in (allowlisted teammates)
 */
export default function VisibilityPicker({ value, onChange, small }: Props) {
  const size = small ? "btn-sm" : "";
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <button
        type="button"
        className={`btn ${size} ${value === "private" ? "btn-primary" : ""}`}
        onClick={() => onChange("private")}
        title="Only you can see and edit this"
      >
        🔒 Just me
      </button>
      <button
        type="button"
        className={`btn ${size} ${value === "shared" ? "btn-primary" : ""}`}
        onClick={() => onChange("shared")}
        title="Anyone on the team can see and run scans; only you can edit/delete"
      >
        👥 Shared with team
      </button>
    </div>
  );
}
