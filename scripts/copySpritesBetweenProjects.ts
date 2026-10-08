/**
 * Copies the `sprites` catalog from one Supabase project into another.
 *
 * Uses two secret-key clients rather than pg_dump, so it needs no database
 * password and no matching local Postgres version — just the two sb_secret_…
 * keys. Rows are upserted on the (category, name) unique key, which makes the
 * copy idempotent and safe to re-run against a target that already has data.
 *
 * `id` and `created_at` are copied verbatim so the two projects mirror each
 * other. Tag ORDER survives the round trip (text[] <-> JS array), which matters
 * because search_sprites ranks exact tag matches by array_position.
 *
 * The target table must already exist — run supabase/schema.sql there first.
 *
 * Source credentials default to the project's own NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SECRET_KEY. The target must always be set explicitly, so a stray run
 * can never write to the project .env.local points at:
 *
 *   TARGET_SUPABASE_URL=https://<ref>.supabase.co
 *   TARGET_SUPABASE_SECRET_KEY=sb_secret_…
 *   # optional, to read from somewhere other than the default project:
 *   SOURCE_SUPABASE_URL=…
 *   SOURCE_SUPABASE_SECRET_KEY=…
 *
 * Usage:
 *   npm run copy:sprites -- [options]
 *
 * Options:
 *   --env-file <path>  Env file to load. Default: .env.local
 *   --batch <n>        Rows per read page / write chunk. Default: 500
 *   --apply            Perform the upsert. Without it, prints the plan and exits.
 */

import dotenv from "dotenv";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "sprites";
const COLUMNS = "id, name, category, base_image_url, tags, variants, created_at";
const CONFLICT_TARGET = "category,name";
const DEFAULT_BATCH = 500;

type SpriteRow = {
  id: string;
  name: string;
  category: string;
  base_image_url: string;
  tags: string[];
  variants: string[];
  created_at: string;
};

// ---------------------------------------------------------------------------
// Args + env
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "apply") {
      flags[key] = true;
      continue;
    }
    flags[key] = argv[++i] ?? "";
  }

  const batchRaw = typeof flags.batch === "string" ? Number(flags.batch) : DEFAULT_BATCH;
  if (!Number.isInteger(batchRaw) || batchRaw < 1) {
    throw new Error(`--batch must be a positive integer, got ${JSON.stringify(flags.batch)}`);
  }

  return {
    envFile: typeof flags["env-file"] === "string" && flags["env-file"]
      ? flags["env-file"]
      : ".env.local",
    batch: batchRaw,
    apply: flags.apply === true,
  };
}

function resolveEndpoints() {
  const sourceUrl = process.env.SOURCE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sourceKey = process.env.SOURCE_SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;
  const targetUrl = process.env.TARGET_SUPABASE_URL;
  const targetKey = process.env.TARGET_SUPABASE_SECRET_KEY;

  if (!sourceUrl || !sourceKey) {
    throw new Error(
      "No source project. Set SOURCE_SUPABASE_URL + SOURCE_SUPABASE_SECRET_KEY, " +
        "or leave them unset to use NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY.",
    );
  }
  if (!targetUrl || !targetKey) {
    throw new Error(
      "TARGET_SUPABASE_URL and TARGET_SUPABASE_SECRET_KEY are required. The target " +
        "is never inferred — naming it explicitly is what stops an accidental run " +
        "from writing to the default project.",
    );
  }
  if (new URL(sourceUrl).host === new URL(targetUrl).host) {
    throw new Error(
      `Source and target are the same project (${new URL(sourceUrl).host}). Refusing to copy a table onto itself.`,
    );
  }

  return { sourceUrl, sourceKey, targetUrl, targetKey };
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

// PostgREST caps a single response (1000 rows by default), so every read walks
// pages ordered by id — stable because id is the primary key.
async function paginate<T>(
  client: SupabaseClient,
  columns: string,
  batch: number,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += batch) {
    const { data, error } = await client
      .from(TABLE)
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + batch - 1);

    if (error) {
      throw new Error(`Failed to read ${label} ${TABLE}: ${error.message}`);
    }

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < batch) return rows;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const keyOf = (row: { category: string; name: string }) => `${row.category}/${row.name}`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { envFile, batch, apply } = parseArgs(process.argv.slice(2));
  dotenv.config({ path: path.resolve(envFile) });

  const { sourceUrl, sourceKey, targetUrl, targetKey } = resolveEndpoints();
  const { createClient } = await import("@supabase/supabase-js");
  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

  const source = createClient(sourceUrl, sourceKey, clientOptions);
  const target = createClient(targetUrl, targetKey, clientOptions);

  console.log(`Source: ${new URL(sourceUrl).host}`);
  console.log(`Target: ${new URL(targetUrl).host}\n`);

  const rows = await paginate<SpriteRow>(source, COLUMNS, batch, "source");
  if (rows.length === 0) {
    console.warn(`⚠️  Source ${TABLE} is empty — nothing to copy.`);
    return;
  }

  // Existing target keys, so the plan can distinguish new rows from overwrites.
  const existing = await paginate<{ category: string; name: string }>(
    target,
    "category, name",
    batch,
    "target",
  );
  const existingKeys = new Set(existing.map(keyOf));
  const overwrites = rows.filter((row) => existingKeys.has(keyOf(row)));

  console.log(`${rows.length} sprites in source.`);
  console.log(`  ${rows.length - overwrites.length} new in target`);
  console.log(`  ${overwrites.length} already present (will be overwritten)`);

  const orphaned = existing.filter((row) => !rows.some((r) => keyOf(r) === keyOf(row)));
  if (orphaned.length > 0) {
    console.warn(
      `ℹ️  ${orphaned.length} sprites exist only in the target and are left untouched ` +
        `(e.g. "${keyOf(orphaned[0])}") — this copy is additive, not a mirror-delete.`,
    );
  }

  if (!apply) {
    console.log("\nDry run — re-run with --apply to upsert. Sample:");
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  const batches = chunk(rows, batch);
  let written = 0;

  for (const [i, group] of batches.entries()) {
    const { error } = await target
      .from(TABLE)
      .upsert(group, { onConflict: CONFLICT_TARGET });

    if (error) {
      const hint = /does not exist|schema cache/i.test(error.message)
        ? ` — does ${TABLE} exist in the target? Run supabase/schema.sql there first.`
        : "";
      console.error(`Failed to upsert batch ${i + 1}/${batches.length}: ${error.message}${hint}`);
      process.exit(1);
    }

    written += group.length;
    console.log(`  batch ${i + 1}/${batches.length} — ${written}/${rows.length} rows`);
  }

  console.log(`\n✅ Copied ${written} sprites to ${new URL(targetUrl).host}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
