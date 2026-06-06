import Link from "next/link";

export default function NotFound() {
  return (
    <div className="notfound">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/poses/search.svg" alt="" aria-hidden />
      <h1>Nothing to hear here</h1>
      <p className="subtle">
        This page went quiet. The Listener couldn&rsquo;t pick anything up at
        this address.
      </p>
      <Link href="/" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
        Back to listeners
      </Link>
    </div>
  );
}
