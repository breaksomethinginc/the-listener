import { suggestKeywords, suggestSources } from "@/lib/keywords";
import type { ListenerMode } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Turn a subject into a starting keyword bundle + working sources. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject")?.trim() || "";
  const mode: ListenerMode =
    url.searchParams.get("mode") === "video" ? "video" : "news";
  if (!subject) {
    return Response.json({ error: "Provide a ?subject=" }, { status: 400 });
  }
  return Response.json({
    keywords: suggestKeywords(subject),
    sources: suggestSources(subject, mode),
    mode,
  });
}
