// The new autofill endpoint. Accepts either:
//   • GET ?subject=...&mode=...      → legacy simple autofill (kept for
//                                      backward compat with old code paths)
//   • POST { ...AutofillInput }      → wizard-driven autofill that takes
//                                      kind/name/context/handles/coverage
//                                      and returns clean keywords +
//                                      sources tuned to the intent.

import {
  buildListenerFromIntent,
  buildRaceFromIntent,
  buildVoicesFromIntent,
} from "@/lib/autofill";
import type {
  AutofillInput,
  AvailableKeys,
  RaceInput,
  VoicesInput,
} from "@/lib/autofill";
import { suggestKeywords, suggestSources } from "@/lib/keywords";
import type { ListenerMode } from "@/lib/types";

export const dynamic = "force-dynamic";

function readKeys(): AvailableKeys {
  return {
    apify: !!process.env.APIFY_TOKEN,
    youtube: !!process.env.YOUTUBE_API_KEY,
    brave: !!process.env.BRAVE_API_KEY,
  };
}

/** Legacy: simple subject → keywords + sources. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject")?.trim() || "";
  const mode: ListenerMode =
    url.searchParams.get("mode") === "video" ? "video" : "news";
  if (!subject) {
    return Response.json({ error: "Provide a ?subject=" }, { status: 400 });
  }
  const keys = readKeys();
  return Response.json({
    keywords: suggestKeywords(subject),
    sources: suggestSources(subject, mode, keys),
    mode,
    availableKeys: keys,
  });
}

/**
 * Wizard-driven: full intent → tuned keywords + sources.
 *
 *   POST { kind, name, coverage, ... }  → video listener autofill
 *   POST { mode: "voices", name, ... }  → voices listener autofill
 */
export async function POST(req: Request) {
  // Stay deliberately loose — the body shape varies by `mode`. Each
  // branch narrows via `unknown` to its concrete input type.
  const raw = (await req.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) {
    return Response.json(
      { error: "Provide { name, ... } in the body" },
      { status: 400 },
    );
  }
  const keys = readKeys();
  const mode = typeof raw.mode === "string" ? raw.mode : "video";

  if (mode === "voices") {
    const out = buildVoicesFromIntent(raw as unknown as VoicesInput, keys);
    return Response.json({ ...out, mode: "voices", availableKeys: keys });
  }

  if (mode === "race") {
    const r = raw as unknown as RaceInput;
    if (
      !Array.isArray(r.candidates) ||
      r.candidates.length === 0 ||
      !r.coverage
    ) {
      return Response.json(
        { error: "Race autofill needs { name, candidates[], coverage }" },
        { status: 400 },
      );
    }
    const out = buildRaceFromIntent(r, keys);
    return Response.json({ ...out, mode: "race", availableKeys: keys });
  }

  // Default = video listener wizard.
  const v = raw as unknown as AutofillInput;
  if (!v.kind || !v.coverage) {
    return Response.json(
      { error: "Provide { kind, name, coverage } in the body" },
      { status: 400 },
    );
  }
  const out = buildListenerFromIntent(v, keys);
  return Response.json({ ...out, mode: "video", availableKeys: keys });
}
