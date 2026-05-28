// The new autofill endpoint. Accepts either:
//   • GET ?subject=...&mode=...      → legacy simple autofill (kept for
//                                      backward compat with old code paths)
//   • POST { ...AutofillInput }      → wizard-driven autofill that takes
//                                      kind/name/context/handles/coverage
//                                      and returns clean keywords +
//                                      sources tuned to the intent.

import {
  buildListenerFromIntent,
  buildVoicesFromIntent,
} from "@/lib/autofill";
import type {
  AutofillInput,
  AvailableKeys,
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
  const body = (await req.json().catch(() => null)) as
    | (AutofillInput & { mode?: string })
    | (VoicesInput & { mode: "voices" })
    | null;
  if (!body || !(body as any).name) {
    return Response.json(
      { error: "Provide { name, ... } in the body" },
      { status: 400 },
    );
  }
  const keys = readKeys();

  if ((body as any).mode === "voices") {
    const out = buildVoicesFromIntent(body as VoicesInput, keys);
    return Response.json({ ...out, mode: "voices", availableKeys: keys });
  }

  const v = body as AutofillInput;
  if (!v.kind || !v.coverage) {
    return Response.json(
      { error: "Provide { kind, name, coverage } in the body" },
      { status: 400 },
    );
  }
  const out = buildListenerFromIntent(v, keys);
  return Response.json({ ...out, mode: "video", availableKeys: keys });
}
