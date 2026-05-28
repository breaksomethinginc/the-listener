// Listener access control. Three rules, by listener.visibility:
//
//   shared   → anyone signed in (i.e. anyone on the allowlist) can see
//              and run scans; only the owner can edit/delete.
//   private  → only the owner can see, scan, edit, delete.
//   legacy   → listeners with no ownerId set (created before OAuth was
//              wired up) are treated as shared and editable by anyone
//              on the allowlist.

import type { Listener } from "./types";

/** Can `userEmail` see this listener at all? */
export function canView(listener: Listener, userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  if (!listener.ownerId) return true; // legacy = shared
  if (listener.visibility === "shared") return true;
  return listener.ownerId.toLowerCase() === userEmail.toLowerCase();
}

/** Can `userEmail` edit/delete this listener? */
export function canEdit(listener: Listener, userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  if (!listener.ownerId) return true; // legacy = anyone signed in can claim/edit
  return listener.ownerId.toLowerCase() === userEmail.toLowerCase();
}

/** Filter a list down to what the user is allowed to see. */
export function visibleTo(
  listeners: Listener[],
  userEmail: string | null | undefined,
): Listener[] {
  return listeners.filter((l) => canView(l, userEmail));
}
