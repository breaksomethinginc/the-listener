// Helpers for creating and validating Listener objects from raw input
// (API request bodies, the create/edit form, etc.).

import type {
  FeedSource,
  KeywordBundle,
  Listener,
  ListenerKind,
  ListenerMode,
  ListenerVisibility,
  Platform,
  SubjectDef,
} from "./types";

function normalizeVisibility(v: unknown): ListenerVisibility | undefined {
  if (v === "private") return "private";
  if (v === "shared") return "shared";
  return undefined;
}

function normalizeSubjects(value: unknown): SubjectDef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: SubjectDef[] = [];
  for (const s of value) {
    const name = String(s?.name || "").trim().slice(0, 140);
    if (!name) continue;
    const h: Record<string, unknown> =
      s?.handles && typeof s.handles === "object" ? s.handles : {};
    const handles: NonNullable<SubjectDef["handles"]> = {};
    for (const k of ["youtube", "tiktok", "instagram", "x", "facebook"] as const) {
      const hv = h[k];
      if (typeof hv === "string" && hv.trim()) {
        handles[k] = hv.trim().slice(0, 140);
      }
    }
    out.push({
      name,
      context: s?.context ? String(s.context).slice(0, 200) : undefined,
      handles: Object.keys(handles).length ? handles : undefined,
    });
  }
  return out.length ? out : undefined;
}

function normalizeMode(v: unknown): ListenerMode {
  if (v === "video") return "video";
  if (v === "voices") return "voices";
  if (v === "race") return "race";
  return "news";
}

const KINDS: ListenerKind[] = ["person", "organization", "event", "topic"];
function normalizeKind(v: unknown): ListenerKind | undefined {
  return typeof v === "string" && (KINDS as string[]).includes(v)
    ? (v as ListenerKind)
    : undefined;
}

function normalizeMaxAge(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function normalizeMaxAudience(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

/** Clamp scan interval to a sensible range: 60 min → 30 days. */
function normalizeScanInterval(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const i = Math.floor(n);
  return Math.max(60, Math.min(60 * 24 * 30, i));
}

function normalizeWebhook(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  // Accept only Slack webhook URLs to avoid posting to arbitrary
  // domains the user didn't intend.
  if (!/^https:\/\/hooks\.slack\.com\//i.test(t)) return undefined;
  return t.slice(0, 400);
}

function normalizeMinScore(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const PLATFORMS: Platform[] = [
  "rss", "atom", "json", "youtube", "rumble", "x", "twitter", "truth",
  "truthsocial", "substack", "reddit", "bluesky", "discord", "mastodon",
  "instagram", "tiktok", "facebook", "threads", "apify", "brave",
];

export function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function emptyKeywords(): KeywordBundle {
  return { any: [], boost: [], veto: [] };
}

/** Accept either a string[] or a comma-separated string. */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    return v.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeKeywords(v: any): KeywordBundle {
  const k = v || {};
  return { any: toList(k.any), boost: toList(k.boost), veto: toList(k.veto) };
}

export function normalizeSources(v: any): FeedSource[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s: any, i: number): FeedSource => {
      const platform: Platform = PLATFORMS.includes(s?.platform)
        ? s.platform
        : "rss";
      const trust = Number(s?.trustWeight);
      return {
        id: String(s?.id || `src-${i}-${genId()}`),
        label: String(s?.label || s?.url || "Source").slice(0, 140),
        url: String(s?.url || "").trim(),
        platform,
        enabled: s?.enabled !== false,
        trustWeight: Number.isFinite(trust) ? Math.max(0, Math.min(2, trust)) : 1,
        apifyActor: s?.apifyActor ? String(s.apifyActor) : undefined,
        apifyInput:
          s?.apifyInput && typeof s.apifyInput === "object"
            ? s.apifyInput
            : undefined,
      };
    })
    .filter((s: FeedSource) => s.url.length > 0);
}

/** Build a fresh Listener from a raw request body. */
export function makeListener(body: any, ownerId?: string): Listener {
  const now = new Date().toISOString();
  return {
    id: genId(),
    name: String(body?.name || "Untitled listener").slice(0, 140),
    subject: String(body?.subject || "").slice(0, 200),
    ownerId: ownerId || body?.ownerId || undefined,
    visibility: normalizeVisibility(body?.visibility) ?? "private",
    mode: normalizeMode(body?.mode),
    kind: normalizeKind(body?.kind),
    context: body?.context
      ? String(body.context).slice(0, 280)
      : undefined,
    subjects: normalizeSubjects(body?.subjects),
    maxAgeDays: normalizeMaxAge(body?.maxAgeDays),
    maxAudience: normalizeMaxAudience(body?.maxAudience),
    scanIntervalMinutes: normalizeScanInterval(body?.scanIntervalMinutes),
    slackWebhookUrl: normalizeWebhook(body?.slackWebhookUrl),
    slackMinScore: normalizeMinScore(body?.slackMinScore),
    keywords: normalizeKeywords(body?.keywords),
    sources: normalizeSources(body?.sources),
    createdAt: now,
    updatedAt: now,
  };
}

/** Apply an edit to an existing listener, preserving id / timestamps / results. */
export function applyEdit(existing: Listener, body: any): Listener {
  return {
    ...existing,
    name: String(body?.name ?? existing.name).slice(0, 140),
    subject: String(body?.subject ?? existing.subject).slice(0, 200),
    // ownerId is immutable post-creation — only set if it was undefined
    // before (claiming a legacy listener).
    ownerId: existing.ownerId,
    visibility:
      body?.visibility !== undefined
        ? normalizeVisibility(body.visibility) ?? existing.visibility
        : existing.visibility,
    mode: body?.mode ? normalizeMode(body.mode) : existing.mode ?? "news",
    kind: body?.kind !== undefined ? normalizeKind(body.kind) : existing.kind,
    context:
      body?.context !== undefined
        ? body.context
          ? String(body.context).slice(0, 280)
          : undefined
        : existing.context,
    subjects:
      body?.subjects !== undefined
        ? normalizeSubjects(body.subjects)
        : existing.subjects,
    maxAgeDays:
      body?.maxAgeDays !== undefined
        ? normalizeMaxAge(body.maxAgeDays)
        : existing.maxAgeDays,
    maxAudience:
      body?.maxAudience !== undefined
        ? normalizeMaxAudience(body.maxAudience)
        : existing.maxAudience,
    scanIntervalMinutes:
      body?.scanIntervalMinutes !== undefined
        ? normalizeScanInterval(body.scanIntervalMinutes)
        : existing.scanIntervalMinutes,
    slackWebhookUrl:
      body?.slackWebhookUrl !== undefined
        ? normalizeWebhook(body.slackWebhookUrl)
        : existing.slackWebhookUrl,
    slackMinScore:
      body?.slackMinScore !== undefined
        ? normalizeMinScore(body.slackMinScore)
        : existing.slackMinScore,
    // postedItemIds is server-managed — never accepted from the body.
    postedItemIds: existing.postedItemIds,
    keywords: body?.keywords
      ? normalizeKeywords(body.keywords)
      : existing.keywords,
    sources: body?.sources
      ? normalizeSources(body.sources)
      : existing.sources,
    updatedAt: new Date().toISOString(),
  };
}
