// Generic feed parsing + small helpers shared by every adapter.
// Zero npm dependencies — works in Node and the browser.

import type { CandidateItem } from "./types";

/** Raw item shape adapters produce before scoring. */
export interface RawItem {
  title: string;
  url: string;
  guid?: string;
  summary?: string;
  publishedAt: string;
  imageUrl?: string;
  source: string;
}

/** Stable, short, deterministic id derived from a string. */
export function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return "i" + (h >>> 0).toString(36);
}

/** Coerce anything date-ish into an ISO string; defaults to "now". */
export function toIso(value?: string | number | Date | null): string {
  if (value === undefined || value === null || value === "") {
    return new Date().toISOString();
  }
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code: string) => {
    if (code[0] === "#") {
      const num =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      if (isNaN(num)) return m;
      try {
        return String.fromCodePoint(num);
      } catch {
        return m;
      }
    }
    return NAMED_ENTITIES[code] ?? m;
  });
}

export function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert a RawItem into an unscored CandidateItem. */
export function toCandidate(r: RawItem): CandidateItem {
  return {
    id: hash(r.url || r.guid || r.title),
    title: r.title,
    url: r.url,
    source: r.source,
    publishedAt: r.publishedAt,
    summary: r.summary,
    imageUrl: r.imageUrl,
    score: 0,
    matchedTerms: [],
  };
}

interface FetchOpts {
  headers?: Record<string, string>;
  timeoutMs?: number;
  proxy?: string;
}

/** GET a URL as text, with timeout, a sensible User-Agent and optional proxy. */
export async function httpGet(url: string, opts: FetchOpts = {}): Promise<string> {
  const target = opts.proxy ? opts.proxy + encodeURIComponent(url) : url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 9000);
  try {
    const res = await fetch(target, {
      headers: {
        "user-agent": "TheListener/1.0 (+https://github.com/the-listener)",
        accept: "*/*",
        ...opts.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGetJson<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const text = await httpGet(url, {
    ...opts,
    headers: { accept: "application/json", ...opts.headers },
  });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("response was not valid JSON");
  }
}

// ── XML helpers ───────────────────────────────────────────────

function unwrapCdata(s: string): string {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}

function firstTag(block: string, name: string): string | undefined {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? unwrapCdata(m[1]).trim() : undefined;
}

function tagAttr(block: string, tag: string, attr: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*?\\b${attr}=["']([^"']+)["'][^>]*?/?>`, "i");
  const m = block.match(re);
  return m ? m[1] : undefined;
}

// ── Feed parsing ──────────────────────────────────────────────

/**
 * Parse RSS, Atom, or JSON Feed content into RawItems.
 * Deliberately forgiving — feeds in the wild are messy.
 */
export function parseFeed(raw: string, fallbackSource: string): RawItem[] {
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("{")) return parseJsonFeed(text, fallbackSource);

  const isAtom = /<entry\b/i.test(text) && !/<item\b/i.test(text);
  const blocks =
    text.match(/<item\b[\s\S]*?<\/item>/gi) ||
    text.match(/<entry\b[\s\S]*?<\/entry>/gi) ||
    [];

  const items: RawItem[] = [];
  for (const block of blocks) {
    const title = firstTag(block, "title") || "";

    let link = firstTag(block, "link") || "";
    if (isAtom || !link || /^\s*$/.test(link)) {
      link = tagAttr(block, "link", "href") || link;
    }
    link = decodeEntities(link.trim());

    const guid =
      firstTag(block, "guid") || firstTag(block, "id") || link || title;

    const desc =
      firstTag(block, "content:encoded") ||
      firstTag(block, "description") ||
      firstTag(block, "summary") ||
      firstTag(block, "content") ||
      "";

    const date =
      firstTag(block, "pubDate") ||
      firstTag(block, "published") ||
      firstTag(block, "updated") ||
      firstTag(block, "dc:date");

    const img =
      tagAttr(block, "media:content", "url") ||
      tagAttr(block, "media:thumbnail", "url") ||
      tagAttr(block, "enclosure", "url");

    if (!title && !link) continue;

    items.push({
      title: stripHtml(title) || "(untitled)",
      url: link,
      guid,
      summary: stripHtml(desc).slice(0, 600),
      publishedAt: toIso(date),
      imageUrl: img,
      source: fallbackSource,
    });
  }
  return items;
}

function parseJsonFeed(text: string, fallbackSource: string): RawItem[] {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const items: any[] = Array.isArray(data) ? data : data.items || [];
  return items.map((it: any): RawItem => {
    const body =
      it.content_text || stripHtml(it.content_html || "") || it.summary || "";
    return {
      title: stripHtml(String(it.title || body || "(untitled)")).slice(0, 200),
      url: String(it.url || it.external_url || it.id || ""),
      guid: String(it.id || it.url || ""),
      summary: String(body).slice(0, 600),
      publishedAt: toIso(it.date_published || it.date_modified),
      imageUrl: it.image || it.banner_image,
      source: it.author?.name || fallbackSource,
    };
  });
}
