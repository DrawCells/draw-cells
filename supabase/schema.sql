-- Supabase schema for the Firebase -> Supabase migration (data + auth together).
-- Run in the Supabase SQL editor, or with `supabase db push`.
--
-- Access model: Auth is Supabase Auth, so RLS is keyed on auth.uid(). User-scoped
-- reads/writes go through the authenticated @supabase/ssr client (RLS enforces
-- ownership). The secret-key client (lib/supabaseAdmin.ts) bypasses RLS and is
-- used only for admin/seed/migration/Lambda-callback work.

create extension if not exists "pgcrypto"; -- provides gen_random_uuid()

-- Keep updated_at fresh on any UPDATE.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- profiles: app-level user data keyed to the Supabase auth user. Holds the
-- first/last name (today only in Firebase displayName) and the admin flag
-- (today the ADMIN_EMAILS env allowlist). Populated by a signup trigger.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  first_name text,
  last_name  text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create a profile row whenever a new auth user signs up. Reads first/last name
-- from the signup metadata (user_metadata.first_name / last_name).
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- sprites: read-only catalog, seeded from src/constants. Served through the
-- /api/sprites route (weighted tag search needs raw SQL), so it stays RLS
-- deny-by-default and is read via the secret-key client. `tags` is an ORDERED
-- array: a tag's position is its search weight (array_position(tags, 'x')).
-- ---------------------------------------------------------------------------
create table if not exists sprites (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null,
  base_image_url text not null,
  tags           text[] not null default '{}',
  variants       text[] not null default '{}',
  created_at     timestamptz not null default now(),
  unique (category, name)
);
create index if not exists sprites_name_idx on sprites (name);
create index if not exists sprites_tags_idx on sprites using gin (tags);

alter table sprites enable row level security; -- deny-all; secret-key only

-- Sprite search. Filters by substring on name OR any tag (matching the old
-- client-side Firebase filter), and orders results by tag WEIGHT: rows where a
-- tag exactly equals the term come first, ranked by that tag's position in the
-- ordered `tags` array (array_position); the rest follow by name. Called via the
-- secret-key client (supabaseAdmin.rpc), so it doesn't need security definer.
create or replace function search_sprites(search text, result_limit int default 200)
returns setof sprites
language sql
stable
as $$
  select s.*
  from sprites s
  where s.name ilike '%' || search || '%'
     or exists (
       select 1 from unnest(s.tags) as tag where tag ilike '%' || search || '%'
     )
  order by
    (
      select min(ord)
      from unnest(s.tags) with ordinality as t(tag, ord)
      where lower(t.tag) = lower(search)
    ) asc nulls last,
    s.name asc
  limit result_limit;
$$;

-- ---------------------------------------------------------------------------
-- presentations: `frames` kept as a JSON document (app loads/saves the whole
-- array), so Frame/Sprite TS types carry over unchanged. Replaces both
-- /presentations and /user-presentations from RTDB. RLS scopes rows to owner.
-- ---------------------------------------------------------------------------
create table if not exists presentations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null default 'New Presentation',
  preview_image text,
  frames        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists presentations_user_id_idx on presentations (user_id);

create trigger presentations_set_updated_at
  before update on presentations
  for each row execute function set_updated_at();

alter table presentations enable row level security;

create policy "presentations: read own" on presentations
  for select using (auth.uid() = user_id);
create policy "presentations: insert own" on presentations
  for insert with check (auth.uid() = user_id);
create policy "presentations: update own" on presentations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "presentations: delete own" on presentations
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- export_jobs: ephemeral; id generated app-side and echoed by the video-export
-- Lambda callback. Written/read only server-side via the secret-key client,
-- so RLS stays deny-by-default.
-- ---------------------------------------------------------------------------
create table if not exists export_jobs (
  id         text primary key,
  status     text not null default 'pending',
  video_url  text,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger export_jobs_set_updated_at
  before update on export_jobs
  for each row execute function set_updated_at();

alter table export_jobs enable row level security; -- deny-all; secret-key only
