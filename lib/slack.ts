// Slack Incoming Webhook poster + Block Kit formatter.
//
// Per-listener — each listener stores its own webhook URL. After a
// scan, we filter ranked items to those with viral score >= minScore
// and id not in postedItemIds, post up to 5 to Slack as a single
// rich message, then append the posted IDs to the dedupe ledger so
// the next scan doesn't repost the same items.
//
// We deliberately accept only https://hooks.slack.com/... URLs
// (validated in listener.ts) so we can't be tricked into POSTing
// payloads to attacker-controlled endpoints.

import type { CandidateItem, Listener } from "./types";

const MAX_ITEMS_PER_POST = 5;
const POSTED_LEDGER_CAP = 500;

function tier(score: number): string {
  if (score >= 70) return "🔥";
  if (score >= 40) return "📈";
  if (score >= 20) return "✨";
  return "•";
}

function fmtNum(n: number | undefined): string | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined;
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  if (n < 10_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return Math.round(n / 1_000_000) + "M";
}

function platformLabel(p: string | undefined): string {
  if (!p) return "";
  if (p === "rss" || p === "atom" || p === "json") return "RSS";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// Slack mrkdwn link: <url|text>. Escape special chars in text.
function mrkdwnLink(url: string, text: string): string {
  const safe = text.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
  return `<${url}|${safe}>`;
}

interface Block {
  type: string;
  [key: string]: unknown;
}

function itemBlocks(item: CandidateItem, listenerName: string): Block[] {
  const title = item.title.slice(0, 140);
  const titleText = item.url
    ? mrkdwnLink(item.url, title)
    : title;

  const metaParts: string[] = [];
  const plat = platformLabel(item.platform);
  if (plat) metaParts.push(plat);
  if (item.creator) {
    if (item.creatorUrl) {
      metaParts.push(mrkdwnLink(item.creatorUrl, item.creator));
    } else {
      metaParts.push(item.creator);
    }
  }
  const views = fmtNum(item.views);
  const likes = fmtNum(item.likes);
  const followers = fmtNum(item.creatorFollowers);
  if (views) metaParts.push(`👁 ${views}`);
  if (likes) metaParts.push(`❤ ${likes}`);
  if (followers) metaParts.push(`🫂 ${followers}`);

  const meta = metaParts.length ? `_${metaParts.join(" · ")}_` : "";
  const text = [
    `*${tier(item.score)} ${item.score}*  ${titleText}`,
    meta,
    item.summary ? item.summary.slice(0, 280) : "",
  ]
    .filter(Boolean)
    .join("\n");

  const section: Block = {
    type: "section",
    text: { type: "mrkdwn", text },
  };
  if (item.imageUrl) {
    section.accessory = {
      type: "image",
      image_url: item.imageUrl,
      alt_text: `thumbnail for ${listenerName}`,
    };
  }
  return [section];
}

interface SlackResult {
  ok: boolean;
  postedIds: string[];
  skipped: number;
  error?: string;
}

/**
 * Post the top new items (above minScore, not already in
 * postedItemIds) to the listener's Slack webhook. Returns which IDs
 * were posted so the caller can extend the dedupe ledger.
 */
export async function postScanToSlack(
  listener: Listener,
  ranked: ReadonlyArray<CandidateItem>,
): Promise<SlackResult> {
  const url = listener.slackWebhookUrl;
  if (!url) return { ok: true, postedIds: [], skipped: 0 };

  const minScore = listener.slackMinScore ?? 50;
  const already = new Set(listener.postedItemIds || []);
  const eligible = ranked.filter(
    (it) => it.score >= minScore && !already.has(it.id),
  );
  if (eligible.length === 0) {
    return { ok: true, postedIds: [], skipped: 0 };
  }

  const toPost = eligible.slice(0, MAX_ITEMS_PER_POST);

  const header: Block = {
    type: "header",
    text: {
      type: "plain_text",
      text: `👂 ${listener.name}`,
      emoji: true,
    },
  };
  const context: Block = {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text:
          `*${toPost.length}* new item${toPost.length === 1 ? "" : "s"}` +
          (eligible.length > toPost.length
            ? ` (showing top ${MAX_ITEMS_PER_POST} of ${eligible.length})`
            : "") +
          ` · score ≥ ${minScore}`,
      },
    ],
  };

  const blocks: Block[] = [header, context, { type: "divider" }];
  toPost.forEach((it, i) => {
    blocks.push(...itemBlocks(it, listener.name));
    if (i < toPost.length - 1) blocks.push({ type: "divider" });
  });

  const body = {
    text: `👂 ${listener.name}: ${toPost.length} new item${toPost.length === 1 ? "" : "s"} above score ${minScore}`, // fallback for notifications
    blocks,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return {
        ok: false,
        postedIds: [],
        skipped: eligible.length,
        error: `Slack HTTP ${res.status}${err ? ` — ${err.slice(0, 120)}` : ""}`,
      };
    }
    return {
      ok: true,
      postedIds: toPost.map((it) => it.id),
      skipped: eligible.length - toPost.length,
    };
  } catch (e: any) {
    return {
      ok: false,
      postedIds: [],
      skipped: eligible.length,
      error: String(e?.message || e),
    };
  }
}

/** Send a test message — used by the "Send test message" button in the UI. */
export async function postTestMessage(
  webhookUrl: string,
  listenerName: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^https:\/\/hooks\.slack\.com\//i.test(webhookUrl)) {
    return { ok: false, error: "Only Slack webhook URLs are accepted." };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `👂 *The Listener* test — \`${listenerName}\` is wired up. You'll get the top new clips here after each scan.`,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Slack HTTP ${res.status}${err ? ` — ${err.slice(0, 120)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Extend the ledger of posted IDs, capped FIFO so it doesn't grow forever. */
export function appendPosted(
  existing: string[] | undefined,
  newlyPosted: string[],
): string[] {
  if (newlyPosted.length === 0) return existing || [];
  const merged = [...(existing || []), ...newlyPosted];
  if (merged.length <= POSTED_LEDGER_CAP) return merged;
  return merged.slice(merged.length - POSTED_LEDGER_CAP);
}
