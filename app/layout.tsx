import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";

export const metadata: Metadata = {
  title: "The Listener",
  description:
    "Set up a listener for a subject, surface reliable results, save it, re-run it.",
  icons: {
    icon: "/favicon.svg",
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
      <svg viewBox="0 0 40 40" width="32" height="32">
        {/* Listening sound waves — arc into the ear from the right.
            Animated separately in CSS so they pulse one after the other. */}
        <g className="ear-waves">
          <path
            className="ear-wave ear-wave-1"
            d="M30 14 Q33 20 30 26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            className="ear-wave ear-wave-2"
            d="M34 10 Q39 20 34 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>

        {/* Ear, tilted forward like it's leaning in. */}
        <g className="ear-body" transform="rotate(-10 18 20)">
          {/* Outer helix */}
          <path
            d="M11 8
               C 18 4, 27 7, 27 16
               C 27 20, 24 22, 23 25
               C 22 28, 24 32, 19 33
               C 15 33, 13 30, 15 26
               C 16 23, 12 22, 11 19
               C 8 19, 7 15, 10 13
               C 7 10, 8 7, 11 8 Z"
            fill="currentColor"
          />
          {/* Inner whorl / antitragus curve */}
          <path
            d="M15 13 C 20 11, 24 14, 23 18 C 22 21, 20 21, 19 20"
            fill="none"
            stroke="rgba(8, 12, 18, 0.55)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Ear canal */}
          <circle cx="18" cy="22" r="1.4" fill="rgba(8, 12, 18, 0.6)" />
        </g>
      </svg>
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
