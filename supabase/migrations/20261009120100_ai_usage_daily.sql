-- ---------------------------------------------------------------------------
-- ai_usage_daily: per-user token usage of the AI chat, one row per UTC day.
-- Backs the daily limit enforced in app/api/chat (see lib/aiUsage.ts). Written
-- and read only server-side via the secret-key client: a user able to write
-- here could reset their own limit, so RLS stays deny-by-default.
--
-- `weighted_tokens` is what the limit is enforced on: usage converted to
-- input-token equivalents by price, so it tracks cost. Raw totals would be
-- dominated by cache reads (the whole history is re-sent every tool-loop
-- iteration) while cache reads are the cheapest tokens there are.
-- ---------------------------------------------------------------------------
create table if not exists ai_usage_daily (
  user_id            uuid not null references auth.users (id) on delete cascade,
  day                date not null default (now() at time zone 'utc')::date,
  requests           int not null default 0,
  input_tokens       bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  output_tokens      bigint not null default 0,
  weighted_tokens    bigint not null default 0,
  updated_at         timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger ai_usage_daily_set_updated_at
  before update on ai_usage_daily
  for each row execute function set_updated_at();

alter table ai_usage_daily enable row level security; -- deny-all; secret-key only

-- Adds one request's usage to today's row and returns the new weighted total.
-- An upsert-increment, so concurrent requests from one user cannot lose
-- updates the way read-then-write would.
create or replace function record_ai_usage(
  p_user_id uuid,
  p_input bigint,
  p_cache_read bigint,
  p_cache_write bigint,
  p_output bigint,
  p_weighted bigint
) returns bigint
language sql
as $$
  insert into ai_usage_daily as u (
    user_id, requests, input_tokens, cache_read_tokens,
    cache_write_tokens, output_tokens, weighted_tokens
  )
  values (
    p_user_id, 1, p_input, p_cache_read, p_cache_write, p_output, p_weighted
  )
  on conflict (user_id, day) do update set
    requests           = u.requests + 1,
    input_tokens       = u.input_tokens + excluded.input_tokens,
    cache_read_tokens  = u.cache_read_tokens + excluded.cache_read_tokens,
    cache_write_tokens = u.cache_write_tokens + excluded.cache_write_tokens,
    output_tokens      = u.output_tokens + excluded.output_tokens,
    weighted_tokens    = u.weighted_tokens + excluded.weighted_tokens
  returning weighted_tokens;
$$;

-- Functions are executable by PUBLIC by default, and Supabase exposes them over
-- the REST API to anon/authenticated. This one takes an arbitrary user id and
-- arbitrary (including negative) amounts, so only the secret key may call it.
revoke execute on function record_ai_usage(uuid, bigint, bigint, bigint, bigint, bigint)
  from public, anon, authenticated;
