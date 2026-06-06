// Send a test message to a Slack webhook. Used by the "Send test
// message" button in the listener Settings panel — confirms the
// webhook is valid before the user relies on it for real scans.

import { auth } from "@/auth";
import { postTestMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const webhookUrl = typeof body?.webhookUrl === "string" ? body.webhookUrl : "";
  const listenerName =
    typeof body?.listenerName === "string"
      ? body.listenerName.slice(0, 140)
      : "Listener";

  const result = await postTestMessage(webhookUrl, listenerName);
  if (!result.ok) {
    return Response.json(
      { error: result.error || "Slack rejected the message" },
      { status: 400 },
    );
  }
  return Response.json({ ok: true });
}
