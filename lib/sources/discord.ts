// Discord — reads a channel's recent messages. `url` is a channel id or
// a channel URL. Requires DISCORD_BOT_TOKEN and the bot must be a member
// of the server (Discord has no anonymous read tier).

import type { ListenerConfig } from "../config";
import { stripHtml, toCandidate, toIso } from "../feeds";
import type { CandidateItem, FeedSource } from "../types";

export async function fetchDiscord(
  source: FeedSource,
  config: ListenerConfig,
): Promise<CandidateItem[]> {
  if (!config.discordBotToken) {
    throw new Error("DISCORD_BOT_TOKEN is not set");
  }
  const channelId =
    source.url.trim().match(/(\d{17,21})\/?$/)?.[1] || source.url.trim();

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`,
    {
      headers: { authorization: `Bot ${config.discordBotToken}` },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
  const messages: any[] = await res.json();

  return (Array.isArray(messages) ? messages : [])
    .filter((m: any) => m && m.content)
    .map((m: any) =>
      toCandidate({
        title: stripHtml(String(m.content)).slice(0, 180) || "(message)",
        url: `https://discord.com/channels/${
          m.guild_id || "@me"
        }/${channelId}/${m.id}`,
        guid: String(m.id),
        summary: String(m.content).slice(0, 600),
        publishedAt: toIso(m.timestamp),
        source: m.author?.username
          ? `${m.author.username} (Discord)`
          : "Discord",
      }),
    );
}
