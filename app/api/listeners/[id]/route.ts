import { applyEdit } from "@/lib/listener";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const listener = await getStore().get(params.id);
  if (!listener) {
    return Response.json({ error: "Listener not found" }, { status: 404 });
  }
  return Response.json({ listener });
}

export async function PUT(req: Request, { params }: Ctx) {
  const store = getStore();
  const existing = await store.get(params.id);
  if (!existing) {
    return Response.json({ error: "Listener not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const updated = applyEdit(existing, body);
  await store.put(updated);
  return Response.json({ listener: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await getStore().remove(params.id);
  return Response.json({ ok: true });
}
