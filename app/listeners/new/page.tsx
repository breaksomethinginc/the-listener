"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ListenerForm, { type ListenerFormValue } from "@/components/ListenerForm";

export default function NewListenerPage() {
  const router = useRouter();

  async function create(value: ListenerFormValue) {
    const res = await fetch("/api/listeners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save listener");
    router.push(`/listeners/${data.listener.id}`);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New listener</h1>
          <p className="subtle">Set it up once. Re-run it whenever you like.</p>
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← All listeners
        </Link>
      </div>
      <ListenerForm submitLabel="Save listener" onSubmit={create} />
    </div>
  );
}
