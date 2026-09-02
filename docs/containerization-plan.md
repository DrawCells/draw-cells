# Containerization / Vercel-Exit Plan

> **Status:** Not started · **Last updated:** 2026-07-16
>
> Living document — update as we progress.

## Goal

Get the Next.js app off Vercel by shipping it as a self-hosted container, without an architecture rewrite. The app is a **client-heavy SPA with a thin server shim** (15/36 components are `"use client"`; the server side is ~9 small route handlers + 3 server-action files), so this is a deployment change, not a re-platform.

**No language split needed.** Standing up a Go backend for the ~5 residual secret/AWS endpoints is negative ROI — especially since Supabase + RLS will shrink the server surface further. See the Supabase plan. If Go ever earns its keep, it's only for the isolated **video-export render** service (already a Lambda), extracted surgically — not a full rewrite.

## Must-fix before it builds/runs

- [ ] **`konva` → `canvas` module resolution.** `next build` traces the server graph and Konva's Node path pulls native `canvas`, commonly throwing `Module not found: Can't resolve 'canvas'`. Fix in `next.config.ts`:
  ```ts
  serverExternalPackages: ["canvas"],
  // or: webpack: (c) => { c.resolve.alias.canvas = false; return c; }
  ```
- [ ] **Enable `output: "standalone"`** in `next.config.ts` (lean image). Footgun: the standalone server does **not** include `.next/static` or `public/` — copy them into the image manually in the Dockerfile.
- [ ] **Bind to all interfaces.** Set `HOSTNAME=0.0.0.0` and `PORT` — the standalone server binds to localhost by default (looks like a broken deploy otherwise). Dev script uses `PORT=3002`; `next start`/standalone defaults to `3000`.

## Security must-do

- [ ] **`.dockerignore` excluding `drawcells-service-account.json`.** It's gitignored, but Docker's build context ignores `.gitignore`, so without this the service-account key gets **baked into the image**. Not needed at runtime (creds come from `FIREBASE_SERVICE_ACCOUNT_KEY` env). Also exclude `.env.local`, `.next`, `node_modules`, the stale CRA `build/` dir.

## Configuration gotchas

- [ ] **`NEXT_PUBLIC_*` are baked at BUILD time, not runtime.** Today: `NEXT_PUBLIC_S3_BUCKET`, `NEXT_PUBLIC_AWS_REGION`. Supabase adds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. One image is locked to the env it was built for — can't promote the same artifact staging→prod by swapping runtime env. Options: build args per environment (simplest), or a runtime `/config` endpoint. **Wait until Supabase vars are finalized, then wire them all at once.**
- [ ] **Server-only secrets stay runtime env** (fine): `FIREBASE_SERVICE_ACCOUNT_KEY`, `AWS_*`, `SUPABASE_SECRET_KEY`, `APP_URL`, `LAMBDA_*`.
- [ ] **Pin the Node base image.** No `engines` pin; local is Node 24. Use `node:22-slim` (verify Next 16 compatibility). **Prefer `-slim` (Debian) over Alpine/musl** — `next/image`'s `sharp` and any `canvas` involvement are native-lib pain on musl.
- [ ] **Set `APP_URL`** to the container's public URL so the video-export callback resolves.
- [ ] `.env.local` is not present in the container — pass all env explicitly.

## Non-issues (confirmed)

- Firebase Admin + AWS SDK are pure JS — no native deps.
- All Konva rendering / `toDataURL` is client-side — no server-side canvas execution at runtime (only the build-graph resolution above).
- No ISR / edge / on-disk-write dependencies — nothing assumes Vercel's filesystem.

## Deliverables

- [ ] `next.config.ts` changes (`serverExternalPackages`, `output: "standalone"`).
- [ ] Multi-stage `Dockerfile` (deps → build → runner; copy `.next/standalone`, `.next/static`, `public/`).
- [ ] `.dockerignore` (secrets + build artifacts).
- [ ] Env wiring (build args for `NEXT_PUBLIC_*`, runtime env for secrets) — **after** Supabase vars are set.
- [ ] Choose host (Fly / Render / ECS / VPS) and deploy.
- [ ] Smoke test: login, load/save a presentation, sprite search, background load, PDF/video export (the export path exercises canvas + S3 + Lambda callback end-to-end).

## Sequencing

1. Finish (or at least stabilize) the Supabase migration so `NEXT_PUBLIC_*` env is final and the server surface is at its smallest.
2. Apply `next.config.ts` + Dockerfile + `.dockerignore`.
3. Build locally, smoke test the container.
4. Deploy to chosen host; cut DNS over from Vercel.

## Optional future portability step

Because the app is client-heavy, a later option is splitting the **frontend** into a static React (Vite) SPA on S3+CloudFront + the handful of endpoints as serverless functions — a frontend/backend split **without changing languages**. Not required to leave Vercel; revisit only if the container route proves limiting.
