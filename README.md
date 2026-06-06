# The Listener

A small web app for social listening. You set up a **listener** for a
subject, it pulls posts and articles from across the web, scores them, and
shows you the ones that matter. Save the listener and re-run it any time —
or let it run itself on a schedule.

It started as the engine spec in `LISTENER.md`; this is that engine plus a
real, hostable app wrapped around it.

---

## What you can do

- **Create a listener** — give it a name and a subject. The app turns the
  subject into starter keywords and a set of working sources automatically.
- **Run a scan** — one click pulls every source, scores each item against
  your keywords, and ranks the results.
- **Save and re-run** — listeners are stored. Open one any time and scan
  again, or edit its keywords and sources.
- **Schedule it** — a built-in cron endpoint re-scans every listener daily.

Out of the box it uses four **zero-key, zero-cost** sources — Google News,
Bing News, Reddit, and Bluesky — so a brand-new listener works on the first
run with nothing to configure. Paid platforms (X/Twitter, Truth Social,
Apify, Brave, Discord, YouTube Data API) light up when you add their keys.

---

## Run it on your computer first (optional, ~2 minutes)

You need [Node.js](https://nodejs.org) 18.18 or newer.

```bash
cd "The Listener"   # or whatever you named the folder
npm install
npm run dev
```

Open <http://localhost:3000>. Listeners save to a local file (`.data/`).
This is the fastest way to try it before deploying.

---

## Deploy it to the web (Vercel)

This is the "make it feel like a real app" path — a public URL you and
others can use.

### Step 1 — Put the code on GitHub

1. Create a free account at <https://github.com> if you don't have one.
2. Make a new **empty** repository (e.g. `the-listener`).
3. From inside the project folder, push the code:

   ```bash
   git init
   git add .
   git commit -m "The Listener"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/the-listener.git
   git push -u origin main
   ```

### Step 2 — Import it into Vercel

1. Create a free account at <https://vercel.com> (sign in with GitHub).
2. Click **Add New… → Project**, pick your `the-listener` repo, and click
   **Deploy**. Vercel detects Next.js automatically — no settings to change.
3. After a minute you'll get a live URL like
   `https://the-listener-xxxx.vercel.app`. The app already works.

### Step 3 — Turn on permanent saved listeners (important)

By default a hosted app has no permanent storage, so saved listeners would
reset whenever you redeploy. Fixing this takes about 5 clicks and is free:

1. In your Vercel project, open the **Storage** tab.
2. Choose **Upstash for Redis** (the free "Marketplace Database" option) and
   create a database. Accept the defaults.
3. When prompted, **connect it to this project**. Vercel injects the
   credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
   automatically.
4. Open the **Deployments** tab and **Redeploy** the latest deployment.

That's it. The Listener detects the database on its own — no code change.
Saved listeners now persist across redeploys and across devices. The
dashboard shows `storage: redis` once it's active (`storage: file` means
it's still on temporary storage).

### Step 4 — (optional) the daily auto-scan

`vercel.json` already registers a cron job that re-scans every listener
once a day. It works on Vercel automatically. To make it more frequent
(Vercel's Pro plan allows it), edit the `schedule` in `vercel.json` — it's
a standard cron expression. To keep the endpoint private, set a `CRON_SECRET`
environment variable to any random string; Vercel Cron will use it.

---

## Optional source keys

Everything below is optional. Add any of these as **Environment Variables**
in Vercel (Project → Settings → Environment Variables), then redeploy. See
`.env.example` for the full list.

| You want… | Add this | Where to get it |
|---|---|---|
| X / Twitter | `TWITTER_BEARER` **or** `APIFY_TOKEN` | developer.x.com (paid) / console.apify.com |
| Truth Social (non-Trump) | `APIFY_TOKEN` | console.apify.com |
| Instagram / TikTok / Facebook | `APIFY_TOKEN` | console.apify.com |
| Broad news discovery | `BRAVE_API_KEY` | api.search.brave.com/app/keys (free: 2k/mo) |
| Discord channels | `DISCORD_BOT_TOKEN` | discord.com/developers |
| Richer YouTube data | `YOUTUBE_API_KEY` | Google Cloud console |

The cheapest useful upgrade is **`APIFY_TOKEN` + `BRAVE_API_KEY`** — together
they cover X, Truth Social, Instagram, TikTok, Facebook and broad news
without paying for the X API.

---

## How a scan works

```
your sources ─▶ fetch each one (in parallel)
             ─▶ score every item against your keywords
                  +10  per "must include" word that matches
                  +5   per "boost" word
                  veto word  ─▶ item dropped
                  +6 / +3 recency bonus (last 24h / 72h)
                  × the source's trust weight
             ─▶ de-dupe, rank, return
```

Each result shows its score, the matched terms ("why this surfaced"), the
source, and how recently it was published. The keyword lists *are* the
editorial filter — broaden the "must include" list to catch more, tighten
it to catch less.

---

## Project layout

```
the-listener/
├── app/                 the Next.js app (pages + API routes)
│   ├── page.tsx              dashboard — all your listeners
│   ├── listeners/new/        create a listener
│   ├── listeners/[id]/       open one: run scans, see results, edit
│   └── api/                  listeners CRUD, /scan, /suggest, /cron
├── components/          the create/edit form + results view
├── lib/                 the listening engine (no app dependency)
│   ├── scanner.ts            scoring + runScan()
│   ├── feeds.ts              feed parser + helpers
│   ├── keywords.ts           subject → starter keywords & sources
│   ├── store.ts              saved-listener storage (Redis or file)
│   └── sources/              11 platform adapters + dispatcher
├── vercel.json          the daily cron schedule
└── .env.example         every optional setting, documented
```

The `lib/` folder is the standalone engine — it has zero npm dependencies
and no dependency on the app, exactly as the original spec intended.

---

## A note on limits

- **Discord** can't be read anonymously — it needs a bot invited to the
  server.
- **X/Twitter** without a key falls back to Nitter, which is often blocked;
  use `APIFY_TOKEN` for reliable results.
- Scans hit live sites, so keep them to every 30–60 minutes to stay within
  rate limits. The free Vercel plan also caps how long a scan can run and
  how often cron fires (once daily) — fine for a handful of listeners.



