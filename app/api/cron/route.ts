import { runScan } from "@/lib/scanner";
import { appendPosted, postScanToSlack } from "@/lib/slack";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs every saved listener and stores its results. Wired to Vercel Cron
 * via vercel.json. If CRON_SECRET is set, the request must carry
 *   Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron sends this automatically once the env var exists).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const store = getStore();
  const listeners = await store.all();
  const ran: any[] = [];
  const now = Date.now();
  const DEFAULT_INTERVAL_MIN = 1440; // once a day

  for (const listener of listeners) {
    // Respect per-listener interval. If lastRunAt is younger than the
    // interval, skip this round. (First-time listeners with no
    // lastRunAt always run.)
    const intervalMs =
      (listener.scanIntervalMinutes ?? DEFAULT_INTERVAL_MIN) * 60_000;
    if (listener.lastRunAt) {
      const since = now - new Date(listener.lastRunAt).getTime();
      // Allow a 60s slop so an "every hour" listener doesn't get
      // skipped because the cron fires a few seconds early.
      if (since + 60_000 < intervalMs) {
        ran.push({
          id: listener.id,
          name: listener.name,
          skipped: "not due",
          nextInMin: Math.round((intervalMs - since) / 60_000),
        });
        continue;
      }
    }
    try {
      const result = await runScan(listener);
      listener.lastResult = result;
      listener.lastRunAt = result.ranAt;
      listener.updatedAt = result.ranAt;
      let slackPosted = 0;
      let slackError: string | undefined;
      if (listener.slackWebhookUrl) {
        const r = await postScanToSlack(listener, result.ranked);
        listener.postedItemIds = appendPosted(
          listener.postedItemIds,
          r.postedIds,
        );
        slackPosted = r.postedIds.length;
        slackError = r.error;
      }
      await store.put(listener);
      ran.push({
        id: listener.id,
        name: listener.name,
        ranked: result.ranked.length,
        slackPosted,
        ...(slackError ? { slackError } : {}),
      });
    } catch (e: any) {
      ran.push({ id: listener.id, name: listener.name, error: String(e?.message || e) });
    }
  }

  return Response.json({ ok: true, ranAt: new Date().toISOString(), ran });
}
