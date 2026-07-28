# Firebase Auth + RTDB → Supabase Migration Plan

> **Status:** Phases 0–4 complete · Phase 5 in progress · **Last updated:** 2026-07-28
>
> Living document — update statuses and check items off as we progress.
>
> **Where things stand:** the application no longer touches Firebase at all —
> `firebase` (client SDK) is uninstalled and `src/firebase-config.js` is gone.
> `firebase-admin` survives as a **devDependency** purely so the one-shot
> migration scripts in `scripts/` can still read the old RTDB/Auth data; it is
> not reachable from app code. **The production data cutover has not run yet.**
> Once it has and the results are verified, delete `scripts/firebaseAdmin.ts`
> plus the `migrate*` scripts, drop the `firebase-admin` devDependency, remove
> the `FIREBASE_*` env vars, and decommission the GCP service account.

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

- [x] **Client data-access pattern.**
  - **Chosen:** everything behind Next API routes (`app/api/*`). User-scoped work
    goes through the `@supabase/ssr` server client so RLS is enforced; privileged
    work (sprite catalog, export-job callback, admin user list) uses the
    secret-key client in `lib/supabaseAdmin.ts`, which bypasses RLS.
- [x] **Password migration.**
  - **Chosen:** reset, not hash import. `migrateUsersToSupabase.ts` creates each
    user with **no password** and `email_confirm: true` — the email is marked
    verified without sending anything, but password login fails until the user
    resets. Google users link to the imported row by verified email on first
    sign-in.
  - ⚠️ **Consequence:** every existing email/password user must reset their
    password at cutover. Plan the comms.
- [x] **UID preservation.**
  - **Chosen:** *not* preserved. Supabase mints fresh uuids and
    `profiles.firebase_uid` maps back to the old Firebase uid;
    `migratePresentationsToSupabase.ts` joins through it to resolve
    `presentations.user_id`. This removes the original "uid preservation is
    load-bearing" risk, and replaces it with a dependency on the mapping column
    being correctly populated *before* the presentations migration runs.

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

### Phase 5 — Dependency removal (done)
- [x] Remove the `firebase` client SDK; delete `src/firebase-config.js` (it had no importers left).
- [x] `app/admin/page.tsx` → `supabaseAdmin.auth.admin.listUsers()`, paged at 1000/page. Shape-mapped to the existing `AdminUser` interface so `UsersList` is untouched: `banned_until` → `disabled`, `email_confirmed_at` → `emailVerified`, `app_metadata.providers` (falling back to `identities`) → `providerIds`.
- [x] Move `lib/firebaseAdmin.ts` → `scripts/firebaseAdmin.ts` and demote `firebase-admin` to a devDependency, so Firebase is structurally unreachable from app code.
- [x] Confirm S3 asset work is unaffected — `/api/storage` is pure S3; `sprites.base_image_url` still resolves.
- [x] Confirm no new Vercel-only dependencies were introduced (keeps the door open for the containerization plan).

### Phase 6 — Cutover + final teardown (pending)
- [ ] Coordinated cutover (small app → short maintenance window; avoids dual-write).
- [ ] Run the migration scripts against production, in order: `migrate:users-to-supabase` → `migrate:presentations-to-supabase` (presentations depend on `profiles.firebase_uid` being populated first). Both support `--dry-run`.
- [ ] Notify email/password users that they must reset their password.
- [ ] Verify row counts and spot-check presentations before tearing anything down.
- [ ] Delete `scripts/firebaseAdmin.ts` + the `migrate*` scripts and their `package.json` entries; drop the `firebase-admin` devDependency.
- [ ] Remove `FIREBASE_SERVICE_ACCOUNT_KEY` / `FIREBASE_DATABASE_URL` from `.env`, `.env.local`, and the Vercel project.
- [ ] Delete the local `drawcells-service-account.json` and revoke the `firebase-adminsdk-68w68@drawcells` service account in GCP.
- [ ] Optionally drop the `profiles.firebase_uid` / `presentations.firebase_id` mapping columns once tracing is no longer needed.

## Risks

- **Script ordering is load-bearing.** `migratePresentationsToSupabase` resolves owners through `profiles.firebase_uid`, so the user migration must complete first. Run it out of order and presentations silently fail to map. Dry-run both.
- **Google account linking** depends on verified-email matching — test with one account before the full import.
- **Auth + data cut over together** — can't half-migrate, since uid is the FK.
- **All password users must reset.** No hashes are imported (see Open decisions), so this is a known, deliberate cost that needs user comms rather than a technical fix.
- **Users with no email are skipped** by the import script. Any such Firebase accounts, and the presentations attached to them, will not come across.
