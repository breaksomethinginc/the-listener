import { auth } from "@/auth";
import { canEdit, canView } from "@/lib/access";
import { applyEdit } from "@/lib/listener";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function emailFromSession(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email || null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const email = await emailFromSession();
  if (!email) {
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  }
  const listener = await getStore().get(params.id);
  if (!listener || !canView(listener, email)) {
    return Response.json({ error: "Listener not found" }, { status: 404 });
  }
  return Response.json({ listener });
}

export async function PUT(req: Request, { params }: Ctx) {
  const email = await emailFromSession();
  if (!email) {
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  }
  const store = getStore();
  const existing = await store.get(params.id);
  if (!existing || !canView(existing, email)) {
    return Response.json({ error: "Listener not found" }, { status: 404 });
  }
  if (!canEdit(existing, email)) {
    return Response.json(
      { error: "Only the owner can edit this listener" },
      { status: 403 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const updated = applyEdit(existing, body);
  // Legacy listeners (no ownerId) get claimed by the first editor.
  if (!updated.ownerId) updated.ownerId = email;
  await store.put(updated);
  return Response.json({ listener: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const email = await emailFromSession();
  if (!email) {
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  }
  const existing = await getStore().get(params.id);
  if (!existing || !canView(existing, email)) {
    return Response.json({ ok: true });
  }
  if (!canEdit(existing, email)) {
    return Response.json(
      { error: "Only the owner can delete this listener" },
      { status: 403 },
    );
  }
  await getStore().remove(params.id);
  return Response.json({ ok: true });
}
