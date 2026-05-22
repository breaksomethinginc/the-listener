import { makeListener } from "@/lib/listener";
import { getStore, storeKind } from "@/lib/store";
import type { Listener } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Strip the heavy lastResult down to a small summary for list views. */
function toCard(l: Listener) {
  const { lastResult, ...rest } = l;
  return {
    ...rest,
    summary: lastResult
      ? {
          ranked: lastResult.ranked.length,
          errors: lastResult.errors.length,
          ranAt: lastResult.ranAt,
        }
      : null,
  };
}

export async function GET() {
  const listeners = await getStore().all();
  listeners.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  return Response.json({
    listeners: listeners.map(toCard),
    storage: storeKind(),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body || !String(body.name || "").trim()) {
    return Response.json({ error: "A name is required" }, { status: 400 });
  }
  const listener = makeListener(body);
  await getStore().put(listener);
  return Response.json({ listener });
}
