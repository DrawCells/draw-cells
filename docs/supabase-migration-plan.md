# Firebase Auth + RTDB → Supabase Migration Plan

> **Status:** Not started · **Last updated:** 2026-07-16
>
> Living document — update statuses and check items off as we progress.

## Context

The app currently uses three Firebase services:

- **Realtime Database** (not Firestore) — presentations, per-user index, sprite library, export jobs.
- **Auth** — email/password + Google, session cookies, admin user listing.
- **Storage** — already migrated to S3 (see the storage route + `scripts/migrateStorageToS3.ts`). **Out of scope here.**

Auth and RTDB are **coupled**: the Firebase `uid` is the foreign key tying presentations to users, so this is a **coordinated cutover**, not a drip migration. Postgres also lets us delete several RTDB workarounds (the `user-presentations` index, the client-side sprite-search-by-full-fetch hack).

## Scope

| Firebase piece | Current location | Target |
|---|---|---|
| Auth (email/pw, Google, sessions) | `lib/auth.ts`, `app/login/*`, `firebase-config.js`, `firebaseAdmin.ts` | Supabase Auth (`@supabase/ssr`) |
| Admin user list | `app/admin/page.tsx` | `supabase.auth.admin.listUsers()` |
| `presentations/{id}` | save route, `AnimationCanvas`, `PresentationContainer`, `CanvasHeader` | `presentations` table |
| `user-presentations/{uid}` | `app/page.tsx`, `Header/actions.ts`, save route | **merged into `presentations`** |
| `sprites/{key}` | `SpritesSection`, `scripts/uploadSpritesToDb.ts` | `sprites` table |
| `exportJobs/{jobId}` | export-video `route`/`callback`/`status` | `export_jobs` table |

## Open decisions

- [ ] **Client data-access pattern.** Keep all data behind Next API routes/server actions, or let the browser use `supabase-js` directly with RLS.
  - **Recommendation:** hybrid — `supabase-js` on the client for RLS-safe reads (own presentations, sprite search); service-role on the server for privileged writes (export-job callback, admin).
  - **Chosen:** _TBD_
- [ ] **Password migration.** Import Firebase scrypt hashes (seamless) vs. force a password-reset email (simpler/more reliable, user friction).
  - **Recommendation:** import hashes; reset-email as fallback if import proves unreliable.
  - **Chosen:** _TBD_

## Schema

```sql
-- presentations: frames stay as one JSONB blob (loaded/saved wholesale,
-- deeply nested). preview_image folds in the old user-presentations index.
create table presentations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Presentation',
  frames jsonb not null default '[]',
  preview_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on presentations (user_id);

create table sprites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tags text[] not null default '{}',
  variants text[] not null default '{}',
  base_image_url text not null,
  category text
);
create extension if not exists pg_trgm;
create index on sprites using gin (name gin_trgm_ops);

create table export_jobs (
  id uuid primary key,
  status text not null,
  video_url text,
  error text,
  created_at timestamptz not null default now()
);
```

**RLS**

- `presentations` — owner-only (`auth.uid() = user_id`) for select/insert/update/delete.
- `sprites` — read for any authenticated user; writes service-role only.
- `export_jobs` — service-role only (written by server, polled via a server route).

## Phases

### Phase 0 — Project + deps
- [ ] Create Supabase project.
- [ ] Add `@supabase/supabase-js` + `@supabase/ssr`.
- [ ] Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- [ ] Client factories: `lib/supabase/server.ts`, `lib/supabase/client.ts`.
- [ ] `middleware.ts` for token refresh.

### Phase 1 — Schema + RLS
- [ ] Apply schema SQL as a Supabase migration.
- [ ] Apply RLS policies.

### Phase 2 — Auth (highest risk)
- [ ] Enable Email + Google providers; move Google OAuth client over.
- [ ] **User import script:** Firebase Admin `listUsers()` → Supabase admin create, **preserving Firebase `uid` as the Supabase user id** (or add a `firebase_uid` map column as a safety net).
  - [ ] Password users — import Firebase scrypt hashes (or trigger reset).
  - [ ] Google users — imported row (same id + email) links to Google identity on first sign-in via verified-email match. **Test with one account first.**
- [ ] Rewrite `lib/auth.ts` `getSessionUser` to read the Supabase session from cookies (SSR server client). Keep `isAdminEmail`/`getAdminUser`. Map Supabase user → `{ uid: user.id, email, displayName: user_metadata.full_name }` so downstream code is untouched.
- [ ] `app/login/actions.ts` + `LoginPageClient.tsx` → `signInWithPassword` / `signInWithOAuth` / `signUp` / `signOut`.
- [ ] `app/admin/page.tsx` → `supabase.auth.admin.listUsers()` (shape-map to `AdminUser`).

### Phase 3 — Data backfill
- [ ] `scripts/migrateRtdbToSupabase.ts`: RTDB `presentations` + `user-presentations` → `presentations` rows (merge `previewImage`); RTDB `sprites` → `sprites` rows. `exportJobs` is ephemeral — skip.
- [ ] Repoint `scripts/uploadSpritesToDb.ts` at Supabase for future seeding.

### Phase 4 — Swap data access
- [ ] **Presentations**
  - [ ] `save/route.ts` → Supabase upsert (**keep the empty-frame-overwrite guard**).
  - [ ] `AnimationCanvas` / `PresentationContainer` reads → Supabase (direct or API per decision).
  - [ ] `CanvasHeader` title write → Supabase.
  - [ ] `Header/actions.ts` create/delete → `insert`/`delete`.
  - [ ] `app/page.tsx` home list → `select id,title,preview_image where user_id`.
- [ ] **Sprites** — `SpritesSection`: replace RTDB pagination + fetch-all-and-filter search with a Supabase query (`ilike`/tag match + range pagination). Deletes real complexity.
- [ ] **Export jobs** — three routes → `export_jobs` insert/update/select.

### Phase 5 — Cutover + cleanup
- [ ] Coordinated cutover (small app → short maintenance window; avoids dual-write).
- [ ] Remove `firebase` / `firebase-admin`; delete `firebase-config.js`, `firebaseAdmin.ts`; remove Firebase env.
- [ ] Confirm S3 asset work is unaffected (`sprites.base_image_url` still resolves via `/api/storage`).
- [ ] Confirm no new Vercel-only dependencies were introduced (keeps the door open for the containerization plan).

## Risks

- **UID preservation is load-bearing.** If Supabase user ids ≠ old Firebase uids, every presentation orphans. The import script must guarantee this (or use the `firebase_uid` map column).
- **Google account linking** depends on verified-email matching — test before the full import.
- **Auth + data cut over together** — can't half-migrate, since uid is the FK.
- **Password hash import** is the least certain step; keep the reset-email fallback ready.
