import { auth } from "@/auth";
import { canView } from "@/lib/access";
import { runScan } from "@/lib/scanner";
import { appendPosted, postScanToSlack } from "@/lib/slack";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
// Scans fan out to many feeds; give them room. Vercel caps this per plan.
export const maxDuration = 60;

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  const email = session?.user?.email || null;
  if (!email) {
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  }
  const store = getStore();
  const listener = await store.get(params.id);
  if (!listener || !canView(listener, email)) {
    return Response.json({ error: "Listener not found" }, { status: 404 });
  }

  let result;
  try {
    result = await runScan(listener);
  } catch (e: any) {
    return Response.json(
      { error: `Scan failed: ${String(e?.message || e)}` },
      { status: 500 },
    );
  }

  listener.lastResult = result;
  listener.lastRunAt = result.ranAt;
  listener.updatedAt = result.ranAt;

  // Post new high-scoring items to Slack if a webhook is configured.
  // Failures here don't block the scan response — they show up as a
  // `slack` field on the result so the UI can surface the error.
  let slack: { ok: boolean; posted: number; skipped: number; error?: string } | undefined;
  if (listener.slackWebhookUrl) {
    const r = await postScanToSlack(listener, result.ranked);
    listener.postedItemIds = appendPosted(listener.postedItemIds, r.postedIds);
    slack = {
      ok: r.ok,
      posted: r.postedIds.length,
      skipped: r.skipped,
      error: r.error,
    };
  }

  await store.put(listener);

  return Response.json({ result, slack });
}
