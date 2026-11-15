# Malapert — Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 · *Lunar Landing Site Navigator*.

Pick a spot near the Moon's south pole and a date. Malapert shows — on real NASA LOLA terrain — when the Sun (solar
power) and Earth (direct-to-Earth radio) are above the **real** horizon, how long until sunset / Earthset, how a launch
slip changes both, and which nearby spots survive a mission. A Student mode turns the same engine into guided lessons
and a landing game.

## How it works

1. **Terrain → skylines (offline).** For every point of a 257 × 257 grid (160 m spacing) in each region, we march along
   180 great-circle directions out to ~300 km over LOLA polar DEMs (20 → 240 m/px) and store the horizon elevation.
   Curated sites get 720-direction horizons at 0 / 2 / 5 / 10 m mast heights.
2. **Sun & Earth positions (live, in the browser).** `astronomy-engine` + the IAU Moon frame, topocentric from the
   surface. Matches JPL Horizons to ≤ 0.004° (`bun test`).
3. **Lit or not = Sun elevation vs horizon in that direction**, with the exact visible fraction of the solar / Earth
   disc. The 3D shader samples the same horizon data, so visuals and numbers cannot disagree.
4. **Validation** against NASA's Mazarico et al. long-run visibility maps: Sun MAE 1.1–2.1 pp, Earth MAE 1.2–1.3 pp
   (`public/validation.json`, shown in the app under *About the data*).

## Run locally

```sh
bun install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local   # only needed for the AI assistant
bun run dev                                          # http://localhost:3000
```

Processed region assets are committed in `public/regions/` (~10 MB per region), so the app runs without the raw data.

### Rebuild the data (optional)

```sh
bun run data:fetch      # ~530 MB of raw NASA files into data/raw/ (gitignored)
bun run data:build all  # skyline grids, terrain, normal maps (~2 min on 8 cores)
bun run data:validate   # JPL Horizons + Mazarico comparison → public/validation.json
bun run test
```

## Deploy (Cloudflare Workers)

Built with `@opennextjs/cloudflare`. The prerendered page and region data are served as Workers static assets; the
Worker itself only handles `/api/chat`.

```sh
bun run preview                          # build + run locally in workerd (reads secrets from .dev.vars)
bun run deploy                           # build + deploy (account from `wrangler whoami`)
bunx wrangler secret put ANTHROPIC_API_KEY   # once per account; optional AI_MODEL (default claude-haiku-5-5)
```

Live: https://malapert.us (also https://malapert.imalfect.workers.dev). Routes for the domain are in `wrangler.jsonc`; the zone
must be in the same Cloudflare account as the Worker.

## Stack

Next.js 16 (App Router) · React 19 · react-three-fiber / three.js · Base UI + Tailwind v4 (own design system, Sora +
Geist Mono) · zustand · Web Worker analysis engine · AI SDK 7 + Anthropic (client-executed tools: the model can only
quote numbers produced by the app's own calculations).

## Data sources

- LRO LOLA polar gridded DEMs (PDS, imbrium.mit.edu) — terrain.
- Mazarico et al. (2011), PGDA product 69 — average Sun / Earth visibility (validation).
- JPL Horizons — ephemeris validation fixtures.
- NASA Lunar Surface Data Book (ACD-50044 Rev A), Gläser et al. (2018) — site coordinates and illumination references.
- NASA Artemis III candidate regions (Oct 2024), CLPS mission pages.

## Use of AI (Space Apps "SI" disclosure)

- The in-app mission assistant and LUNA-Bot answers are generated at runtime by Claude (Anthropic) from this app's own
  calculations; they are labelled "AI" in the UI.
- The source code was written largely with AI coding assistance (Claude), directed and reviewed by the team. The
  product concept and feature design are the team's own.
- No AI-generated images, video or audio are used.
