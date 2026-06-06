import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";

export const metadata: Metadata = {
  title: "The Listener",
  description:
    "Set up a listener for a subject, surface reliable results, save it, re-run it.",
  icons: {
    // Browsers that support SVG favicons render the crisp vector first.
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    // iOS "add to home screen" + macOS pinned-tab.
    apple: [
      { url: "/apple-touch-icon.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

/**
 * Cheeky ear mark — a tilted, cartoony ear with little sound waves
 * arcing toward it (the app is leaning in, eavesdropping). Uses
 * `currentColor` so it follows whatever color the parent sets.
 */
function EarMark() {
  return (
    <span className="ear-mark" aria-hidden>
      <img src="/listener-icon.svg" alt="" width={36} height={40} />
    </span>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Ambient background — two tin-can telephones with chattering teeth.
            Looped, muted, behind a dark teal gradient overlay so cards and
            text stay readable. The visual gag matches "professionally nosy". */}
        <video
          className="bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/bg.jpg"
          aria-hidden
        >
          {/* WebM/VP9 first — open codec, smaller file, plays in every
              modern browser including Chromium variants without H.264. */}
          <source src="/bg.webm" type="video/webm" />
          <source src="/bg.mp4" type="video/mp4" />
        </video>
        <div className="bg-overlay" aria-hidden />

        <header className="topbar">
          <Link href="/" className="brand">
            <EarMark />
            The Listener <small>· professionally nosy</small>
          </Link>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <UserMenu />
            <Link href="/listeners/new" className="btn btn-primary btn-sm">
              + New listener
            </Link>
          </div>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
