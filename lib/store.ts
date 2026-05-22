// Persistence for saved listeners.
//
// Two backends, selected automatically:
//   • RedisStore — used when Upstash/Vercel KV REST env vars are present.
//                  Survives redeploys; works across devices. Recommended
//                  for hosting.
//   • FileStore  — JSON file fallback. Great for local `npm run dev`.
//
// Add the free "Upstash for Redis" integration from the Vercel Storage
// tab and RedisStore activates with no code changes.

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Listener } from "./types";

export interface Store {
  all(): Promise<Listener[]>;
  get(id: string): Promise<Listener | null>;
  put(listener: Listener): Promise<void>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = "the-listener:listeners";

function redisEnv(): { url: string; token: string } | null {
  const env = process.env;
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisCmd(command: string[]): Promise<any> {
  const env = redisEnv();
  if (!env) throw new Error("Redis storage is not configured");
  const res = await fetch(env.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json: any = await res.json();
  if (json && json.error) throw new Error(String(json.error));
  return json ? json.result : null;
}

class RedisStore implements Store {
  async all(): Promise<Listener[]> {
    const raw = await redisCmd(["GET", STORAGE_KEY]);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  async get(id: string): Promise<Listener | null> {
    return (await this.all()).find((l) => l.id === id) || null;
  }
  async put(listener: Listener): Promise<void> {
    const list = await this.all();
    const i = list.findIndex((l) => l.id === listener.id);
    if (i >= 0) list[i] = listener;
    else list.push(listener);
    await redisCmd(["SET", STORAGE_KEY, JSON.stringify(list)]);
  }
  async remove(id: string): Promise<void> {
    const list = (await this.all()).filter((l) => l.id !== id);
    await redisCmd(["SET", STORAGE_KEY, JSON.stringify(list)]);
  }
}

class FileStore implements Store {
  private file: string;
  constructor() {
    // Vercel's app filesystem is read-only except /tmp.
    const dir = process.env.VERCEL
      ? path.join(os.tmpdir(), "the-listener")
      : path.join(process.cwd(), ".data");
    this.file = path.join(dir, "listeners.json");
  }
  private async read(): Promise<Listener[]> {
    try {
      const txt = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(txt);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  private async write(list: Listener[]): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(list, null, 2), "utf8");
  }
  async all(): Promise<Listener[]> {
    return this.read();
  }
  async get(id: string): Promise<Listener | null> {
    return (await this.read()).find((l) => l.id === id) || null;
  }
  async put(listener: Listener): Promise<void> {
    const list = await this.read();
    const i = list.findIndex((l) => l.id === listener.id);
    if (i >= 0) list[i] = listener;
    else list.push(listener);
    await this.write(list);
  }
  async remove(id: string): Promise<void> {
    await this.write((await this.read()).filter((l) => l.id !== id));
  }
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  cached = redisEnv() ? new RedisStore() : new FileStore();
  return cached;
}

/** Which backend is active — surfaced in the UI so the user knows. */
export function storeKind(): "redis" | "file" {
  return redisEnv() ? "redis" : "file";
}
