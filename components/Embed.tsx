"use client";

import { useEffect } from "react";
import type { CandidateItem } from "@/lib/types";

// Loads TikTok/Instagram embed scripts once. They scan the DOM for their
// blockquote markers and rewrite them into the real embed.
function loadOnce(id: string, src: string) {
  if (typeof window === "undefined") return;
  if (document.getElementById(id)) {
    // Re-process if already loaded — both libs expose a global for this.
    const w = window as any;
    if (id === "instagram-embed" && w.instgrm?.Embeds?.process) {
      w.instgrm.Embeds.process();
    }
    return;
  }
  const s = document.createElement("script");
  s.id = id;
  s.src = src;
  s.async = true;
  document.body.appendChild(s);
}

function youtubeId(item: CandidateItem): string | undefined {
  if (item.videoId && item.platform === "youtube") return item.videoId;
  const u = item.url || "";
  return (
    u.match(/[?&]v=([\w-]{6,})/)?.[1] ||
    u.match(/youtu\.be\/([\w-]{6,})/)?.[1] ||
    u.match(/\/shorts\/([\w-]{6,})/)?.[1]
  );
}

export default function Embed({ item }: { item: CandidateItem }) {
  const platform = item.platform;
  const url = item.url;

  useEffect(() => {
    if (platform === "tiktok") {
      loadOnce("tiktok-embed", "https://www.tiktok.com/embed.js");
    } else if (platform === "instagram") {
      loadOnce("instagram-embed", "https://www.instagram.com/embed.js");
    }
  }, [platform]);

  // YouTube — direct iframe, no SDK needed.
  const ytid = youtubeId(item);
  if (ytid) {
    return (
      <div style={{ position: "relative", paddingTop: "56.25%", marginTop: 10 }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytid}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            borderRadius: 8,
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={item.title}
        />
      </div>
    );
  }

  // TikTok — official blockquote, picked up by embed.js
  if (platform === "tiktok" && url) {
    const idMatch = url.match(/\/video\/(\d+)/);
    return (
      <div style={{ marginTop: 10 }}>
        {/* eslint-disable-next-line react/no-danger */}
        <blockquote
          className="tiktok-embed"
          cite={url}
          data-video-id={idMatch?.[1]}
          style={{ maxWidth: 605, minWidth: 325 }}
        >
          <a href={url} target="_blank" rel="noreferrer">
            View on TikTok
          </a>
        </blockquote>
      </div>
    );
  }

  // Instagram — official blockquote
  if (platform === "instagram" && url) {
    return (
      <div style={{ marginTop: 10 }}>
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={url}
          data-instgrm-version="14"
          style={{ background: "#000", border: 0, margin: 0, maxWidth: 540 }}
        >
          <a href={url} target="_blank" rel="noreferrer">
            View on Instagram
          </a>
        </blockquote>
      </div>
    );
  }

  // Facebook — plugins.facebook.com/plugin renders public posts/videos
  // without an app id. Fallback only — not always reliable.
  if (platform === "facebook" && url) {
    const src = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(
      url,
    )}&show_text=true&width=500`;
    return (
      <div style={{ marginTop: 10 }}>
        <iframe
          src={src}
          width={500}
          height={520}
          style={{ border: 0, borderRadius: 8, background: "#111" }}
          scrolling="no"
          allow="encrypted-media"
          title={item.title}
        />
      </div>
    );
  }

  // Anything else — just a deep link.
  return (
    <p className="faint" style={{ marginTop: 10 }}>
      No inline embed for this source.{" "}
      <a href={url} target="_blank" rel="noreferrer">
        Open in new tab →
      </a>
    </p>
  );
}
