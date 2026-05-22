import { suggestKeywords, suggestSources } from "@/lib/keywords";

export const dynamic = "force-dynamic";

/** Turn a subject into a starting keyword bundle + working sources. */
export async function GET(req: Request) {
  const subject = new URL(req.url).searchParams.get("subject")?.trim() || "";
  if (!subject) {
    return Response.json({ error: "Provide a ?subject=" }, { status: 400 });
  }
  return Response.json({
    keywords: suggestKeywords(subject),
    sources: suggestSources(subject),
  });
}
