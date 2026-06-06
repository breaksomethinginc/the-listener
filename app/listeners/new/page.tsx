"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import NewsQuickStart, {
  type QuickStartResult,
} from "@/components/NewsQuickStart";
import RaceWizard, { type RaceWizardResult } from "@/components/RaceWizard";
import VideoWizard, { type WizardResult } from "@/components/VideoWizard";
import VoicesWizard, {
  type VoicesWizardResult,
} from "@/components/VoicesWizard";

type Mode = "news" | "video" | "voices" | "race";

export default function NewListenerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("video");

  async function create(
    value:
      | QuickStartResult
      | WizardResult
      | VoicesWizardResult
      | RaceWizardResult,
  ) {
    const res = await fetch("/api/listeners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save listener");
    router.push(`/listeners/${data.listener.id}`);
  }

  const tagline =
    mode === "video"
      ? "Clips OF and ABOUT your subject across the web."
      : mode === "voices"
        ? "Just real people. No press, no outlets, no statements."
        : mode === "race"
          ? "Track every candidate plus race-wide news and chatter."
          : "Broad text + social coverage of a topic.";

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New listener</h1>
          <p className="subtle">Set it up once. Re-run it whenever you like.</p>
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← All listeners
        </Link>
      </div>

      <div
        className="row"
        style={{ gap: 8, marginBottom: 18, flexWrap: "wrap" }}
      >
        <button
          type="button"
          className={`btn ${mode === "video" ? "btn-primary" : ""}`}
          onClick={() => setMode("video")}
          title="Videos of (and about) your subject — news clips, creator posts, search"
        >
          🎥 Video
        </button>
        <button
          type="button"
          className={`btn ${mode === "voices" ? "btn-primary" : ""}`}
          onClick={() => setMode("voices")}
          title="Real people on TikTok / IG / Threads / FB. No news outlets."
        >
          🗣 Voices
        </button>
        <button
          type="button"
          className={`btn ${mode === "race" ? "btn-primary" : ""}`}
          onClick={() => setMode("race")}
          title="Track every candidate in a race plus race-level news and chatter."
        >
          🏁 Race
        </button>
        <button
          type="button"
          className={`btn ${mode === "news" ? "btn-primary" : ""}`}
          onClick={() => setMode("news")}
          title="Articles, social posts, broad news coverage"
        >
          📰 News
        </button>
        <span className="faint" style={{ fontSize: 12, marginLeft: 6 }}>
          {tagline}
        </span>
      </div>

      {mode === "video" ? (
        <VideoWizard onSubmit={create} />
      ) : mode === "voices" ? (
        <VoicesWizard onSubmit={create} />
      ) : mode === "race" ? (
        <RaceWizard onSubmit={create} />
      ) : (
        <NewsQuickStart onSubmit={create} />
      )}
    </div>
  );
}
