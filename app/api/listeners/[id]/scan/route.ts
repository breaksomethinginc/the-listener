import { runScan } from "@/lib/scanner";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
// Scans fan out to many feeds; give them room. Vercel caps this per plan.
export const maxDuration = 60;

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const store = getStore();
  const listener = await store.get(params.id);
  if (!listener) {
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
  await store.put(listener);

  return Response.json({ result });
}
