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
  // Server-side knowledge of which paid APIs are wired up — autofill
  // uses this to enable sources by default vs leaving them as
  // "(needs X)" stubs.
  const keys = {
    apify: !!process.env.APIFY_TOKEN,
    youtube: !!process.env.YOUTUBE_API_KEY,
    brave: !!process.env.BRAVE_API_KEY,
  };
  return Response.json({
    keywords: suggestKeywords(subject),
    sources: suggestSources(subject, mode, keys),
    mode,
    availableKeys: keys,
  });
}
