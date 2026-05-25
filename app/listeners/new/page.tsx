"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import NewsQuickStart, {
  type QuickStartResult,
} from "@/components/NewsQuickStart";
import VideoWizard, { type WizardResult } from "@/components/VideoWizard";

export default function NewListenerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"news" | "video">("video");

  async function create(value: QuickStartResult | WizardResult) {
    const res = await fetch("/api/listeners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save listener");
    router.push(`/listeners/${data.listener.id}`);
  }

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
          title="Videos of people talking about your subject"
        >
          🎥 Video
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
          {mode === "video"
            ? "Find clips of people talking about (or being) your subject."
            : "Broad text + social coverage of a topic."}
        </span>
      </div>

      {mode === "video" ? (
        <VideoWizard onSubmit={create} />
      ) : (
        <NewsQuickStart onSubmit={create} />
      )}
    </div>
  );
}
