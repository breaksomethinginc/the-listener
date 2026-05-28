// /login — single Google sign-in button. Server component that calls
// the server action which initiates the OAuth redirect.

import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: { next?: string; error?: string };
}

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await auth();
  // Already signed in? Send them where they were headed.
  if (session?.user) {
    redirect(searchParams.next || "/");
  }

  async function doSignIn() {
    "use server";
    await signIn("google", { redirectTo: searchParams.next || "/" });
  }

  const errorMessage =
    searchParams.error === "AccessDenied"
      ? "That email isn't on the allowlist for this app. Ask the owner to add you."
      : searchParams.error
        ? `Sign-in error: ${searchParams.error}`
        : null;

  return (
    <div
      style={{
        minHeight: "calc(100vh - 200px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="panel"
        style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
      >
        <h1 style={{ marginBottom: 6 }}>👂 Sign in</h1>
        <p className="subtle" style={{ marginBottom: 24 }}>
          The Listener is invite-only. Sign in with the Google account
          you were added with.
        </p>

        {errorMessage ? (
          <div className="banner error" style={{ marginBottom: 16 }}>
            ⚠ {errorMessage}
          </div>
        ) : null}

        <form action={doSignIn}>
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 15,
              gap: 10,
              justifyContent: "center",
            }}
          >
            <span aria-hidden style={{ fontSize: 18 }}>
              🔑
            </span>
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
