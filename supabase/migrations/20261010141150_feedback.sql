-- ---------------------------------------------------------------------------
-- feedback: bug reports and feature requests sent from the in-app Feedback
-- dialog, triaged on /admin/feedback. Written by app/api/feedback (which also
-- rate-limits and stores the optional screenshot in S3) and read/updated by the
-- admin page, both via the secret-key client, so RLS stays deny-by-default: a
-- user able to read here would see everyone's reports and emails.
--
-- The context columns (page_url, presentation_id, user_agent, viewport) are
-- captured automatically by the client. `email` is copied at submit time so a
-- report stays readable after the account is gone.
-- ---------------------------------------------------------------------------
create table if not exists feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete set null,
  email           text,
  type            text not null check (type in ('bug', 'feature', 'other')),
  message         text not null check (char_length(message) between 1 and 5000),
  status          text not null default 'new'
                    check (status in ('new', 'in_progress', 'done', 'wont_fix')),
  admin_notes     text,
  page_url        text,
  presentation_id uuid, -- no FK: the report outlives a deleted presentation
  user_agent      text,
  viewport        text,
  screenshot_key  text, -- S3 object key, e.g. feedback/<id>.jpg
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists feedback_created_at_idx on feedback (created_at desc);
create index if not exists feedback_user_id_idx on feedback (user_id, created_at desc);

create trigger feedback_set_updated_at
  before update on feedback
  for each row execute function set_updated_at();

alter table feedback enable row level security; -- deny-all; secret-key only
