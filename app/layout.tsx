import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Listener",
  description: "Set up a listener for a subject, surface reliable results, save it, re-run it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="dot" />
            The Listener <small>· social listening</small>
          </Link>
          <Link href="/listeners/new" className="btn btn-primary btn-sm">
            + New listener
          </Link>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
