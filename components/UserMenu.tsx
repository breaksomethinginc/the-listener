// Header user menu — avatar + email + sign out. Server component.
// Calls `auth()` so it renders nothing when there's no session.

import { auth, signOut } from "@/auth";

export default async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const email = session.user.email || "";
  const name = session.user.name || email;
  const image = session.user.image;

  return (
    <div className="row" style={{ gap: 8, alignItems: "center" }}>
      <div
        className="row"
        style={{
          gap: 8,
          alignItems: "center",
          padding: "4px 10px 4px 4px",
          borderRadius: 999,
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid var(--border-soft)",
        }}
        title={email}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            width={24}
            height={24}
            style={{ borderRadius: "50%" }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#0a0e14",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {email.split("@")[0]}
        </span>
      </div>
      <form action={doSignOut}>
        <button
          type="submit"
          className="btn btn-ghost btn-sm"
          title={`Sign out ${email}`}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
