# Database schema

The schema lives in `migrations/`, one timestamped SQL file per change, applied
in order. `supabase db push` applies the ones a database has not seen yet and
records them in `supabase_migrations.schema_migrations`, so each project's
state can be checked with `supabase migration list`.

There are two remote projects, staging and prod. Every change goes to staging
first.

## Making a change

```sh
supabase migration new add_something     # creates migrations/<timestamp>_add_something.sql
# write the SQL — alter/create, never edit a migration that has been pushed
supabase link --project-ref <staging-ref>
supabase db push --dry-run               # shows what would be applied
supabase db push
# then the same against prod
```

Write migrations that run once, in order, against the previous state: an
`alter table` for a change, not an edited `create table`. A migration that has
reached any remote database is history — fix mistakes with a new one.

## One-time setup (moving off schema.sql)

Until October 2026 the schema was a single `schema.sql`, applied by hand.
`20261009120000_baseline.sql` is that file unchanged. Staging and prod already
have it, so it must be **recorded as applied, not run** — running it again fails
on the first `create trigger` / `create policy`.

For each project:

```sh
supabase link --project-ref <project-ref>
supabase migration list                  # baseline shows as local-only
supabase migration repair 20261009120000 --status applied
supabase db push --dry-run               # should list only 20261009120100_ai_usage_daily
supabase db push
```

Before the `repair`, check the project actually matches the baseline — the
manual process left no record of what was applied where. The tables, policies,
`search_sprites`, and the `on_auth_user_created` trigger should all exist.
