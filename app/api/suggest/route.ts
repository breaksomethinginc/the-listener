// The new autofill endpoint. Accepts either:
//   • GET ?subject=...&mode=...      → legacy simple autofill (kept for
//                                      backward compat with old code paths)
//   • POST { ...AutofillInput }      → wizard-driven autofill that takes
//                                      kind/name/context/handles/coverage
//                                      and returns clean keywords +
//                                      sources tuned to the intent.

import { buildListenerFromIntent } from "@/lib/autofill";
import type { AutofillInput, AvailableKeys } from "@/lib/autofill";
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

/** Wizard-driven: full intent → tuned keywords + sources. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as AutofillInput | null;
  if (!body || !body.name || !body.kind || !body.coverage) {
    return Response.json(
      { error: "Provide { kind, name, coverage } in the body" },
      { status: 400 },
    );
  }
  const keys = readKeys();
  const out = buildListenerFromIntent(body, keys);
  return Response.json({ ...out, availableKeys: keys });
}
