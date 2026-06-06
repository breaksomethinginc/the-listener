# The Listener — brand assets & integration notes

Handoff doc for finishing the brand rollout. Everything below already exists in
the repo unless marked **TODO**. Source/working files live in `brand/`; the
files the app actually serves live in `public/`.

## Mascot

A retro rubber-hose cartoon **ear** character (the "guy") + the lowercase
wordmark "the listener". Vectorized from AI renders via Adobe Illustrator's
vectorizer, then split into clean, individually editable SVG paths.

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| Navy (bg) | `#16244A` | Primary dark background / favicon tile |
| Logo teal | `#75CFBB` | Mascot body + wordmark fill |
| App accent (existing) | `#3DD7C6` | `--accent` in `globals.css` — brighter UI teal, leave as-is |
| Cream | `#F3EEDC` | Mascot outline, gloves, sneakers |
| Ink | `#14181E` | Linework / outlines |

The mascot's own colors are baked into its SVGs — don't recolor per-instance.

## File inventory

### `public/` (served by the app)
- `favicon.svg` — mascot on a rounded navy tile (browser tab). **Replaced.**
- `listener-icon.svg` — transparent character only (used in the header).
- `poses/` — role-named pose SVGs used in the UI:
  - `wave.svg`, `empty.svg`, `search.svg`, `loading.svg`, `error.svg`, `success.svg`

### `brand/` (source / deliverables, not served)
- `the-listener-horizontal.svg` / `.png` — icon left, "the / listener" stacked right
- `the-listener-vertical.svg` / `.png` — icon top, wordmark below
- `the-listener-icon.svg` / `.png` — character only
- `the-listener-icon-square.svg`, `icon-512.png`, `icon-192.png`, `app-icon-512.png`
- `*-navy.png` — versions composited on the navy background
- `_adobe-source-vertical.svg` — raw Adobe trace the lockups were built from
- `poses/` — full set `pose-00..10` (SVG + transparent PNG), `_contact-sheet.png` (labeled), `README.txt` (pose→role map)

### Pose → role map
| Pose | Description | Role | Served as |
|------|-------------|------|-----------|
| 00 | wave | "No scans yet" empty state | `public/poses/wave.svg` |
| 01 | thumbs-up | success | (exported, **TODO** wire) |
| 02 | running | loading / scanning | `public/poses/loading.svg` (**TODO** wire) |
| 03 | celebrate | success / done | (exported) |
| 04 | hand-to-ear listening | hero accent | (exported) |
| 05 | neutral standing | general | (exported) |
| 06 | arms-crossed | error | `public/poses/error.svg` (**TODO** wire) |
| 07 | peace | sticker | (exported) |
| 08 | sitting | "Nothing scored above zero" empty state | `public/poses/empty.svg` |
| 09 | walking / pointing | "No matches" + 404 | `public/poses/search.svg` |
| 10 | OK sign | success / confirm | (exported) |

## Already wired

- **`app/layout.tsx`** — header `EarMark` now renders
  `<img src="/listener-icon.svg" width={36} height={40} />`; `metadata.icons.icon`
  points at the new `/favicon.svg`.
- **`app/globals.css`** — added `.empty .empty-mascot` and `.notfound` styles
  (appended at end).
- **`components/ScanResults.tsx`** — mascots added to all three `.empty` blocks:
  `wave.svg` (no scans), `empty.svg` (nothing scored), `search.svg` (no filter
  matches).
- **`app/not-found.tsx`** — new 404 page using `search.svg`.

### Usage convention
Poses are decorative, so render with an empty `alt` + `aria-hidden`, and add the
eslint disable line above the `<img>`:
```tsx
{/* eslint-disable-next-line @next/next/no-img-element */}
<img className="empty-mascot" src="/poses/empty.svg" alt="" aria-hidden />
```

## TODO

1. **Scan-run flow mascots.** Wire `loading.svg` (running) into the
   scan-in-progress state and `success.svg` (thumbs-up) into the just-finished
   moment. The "Run scan" action lives around `app/listeners/[id]/page.tsx` /
   the scan trigger — surface the running guy while the scan is pending and a
   brief success guy on completion.
2. **Error state.** Use `error.svg` (arms-crossed) wherever a scan/source
   failure is surfaced to the user (the `errors` block in `ScanResults.tsx` is a
   candidate, or a top-level fetch failure).
3. **Decorative accents (light touch).** Optional subtle mascots on
   `app/login/page.tsx` and the new-listener wizard
   (`app/listeners/new/page.tsx` + `components/*Wizard.tsx`). Keep them small,
   low-opacity, and out of the way — easy to overdo.
4. **Raster favicons (optional).** Currently only `favicon.svg` is served.
   If broad browser/PWA support is needed, generate `favicon.ico` and PNG
   touch icons from `brand/app-icon-512.png` and add them to `metadata.icons`.

## Notes
- The two lockups and all poses are built from the same Adobe vector source, so
  the character and the "the listener" letterforms are consistent everywhere.
- `tsc --noEmit` passes with the current changes.
