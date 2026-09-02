/**
 * Copies presentations from one user to another inside the same Supabase
 * project.
 *
 * A presentation row is self-contained: `frames` references sprites by their
 * global storage path (sprites/…), and `preview_image` is an inlined data URL.
 * Nothing in the row is scoped to the owner, so handing a copy to another user
 * needs no asset work — only a row insert under the new user_id.
 *
 * Copies are NEW rows: a fresh id, and firebase_id left null (it is unique and
 * belongs to the original). `created_at` is copied verbatim so the target's
 * list (ordered created_at desc) keeps the source's ordering.
 *
 * Re-runs are safe by default: a source presentation whose title the target
 * already has is skipped. Pass --allow-duplicates to copy regardless — useful
 * when the target legitimately wants a second copy under the same title.
 *
 * Both users are resolved through `profiles`, by email or by uuid. Uses the
 * secret-key client (bypasses RLS), so it must be run server-side only.
 *
 * Usage:
 *   npm run copy:presentations -- --from <email|uuid> --to <email|uuid> [options]
 *
 * Options:
 *   --from <ref>       Source user: email or Supabase uuid. Required.
 *   --to <ref>         Target user: email or Supabase uuid. Required.
 *   --ids <a,b,c>      Copy only these presentation ids. Default: all the
 *                      source owns.
 *   --allow-duplicates Copy even when the target already has that title.
 *   --env-file <path>  Env file to load. Default: .env.local
 *   --batch <n>        Rows per read page / insert chunk. Default: 500
 *   --apply            Perform the insert. Without it, prints the plan and exits.
 */

import dotenv from "dotenv";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "presentations";
const COLUMNS = "id, title, preview_image, frames, created_at";
const DEFAULT_BATCH = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PresentationRow = {
  id: string;
  title: string;
  preview_image: string | null;
  frames: unknown[];
  created_at: string;
};

type User = { id: string; email: string | null };

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "apply" || key === "allow-duplicates") {
      flags[key] = true;
      continue;
    }
    flags[key] = argv[++i] ?? "";
  }

  const from = typeof flags.from === "string" ? flags.from.trim() : "";
  const to = typeof flags.to === "string" ? flags.to.trim() : "";
  if (!from || !to) {
    throw new Error(
      "--from and --to are required (email or uuid).\n" +
        "  npm run copy:presentations -- --from a@example.com --to b@example.com",
    );
  }

  const batchRaw = typeof flags.batch === "string" ? Number(flags.batch) : DEFAULT_BATCH;
  if (!Number.isInteger(batchRaw) || batchRaw < 1) {
    throw new Error(`--batch must be a positive integer, got ${JSON.stringify(flags.batch)}`);
  }

  const ids =
    typeof flags.ids === "string" && flags.ids
      ? flags.ids.split(",").map((id) => id.trim()).filter(Boolean)
      : null;
  const badId = ids?.find((id) => !UUID_RE.test(id));
  if (badId) {
    throw new Error(`--ids expects presentation uuids, got "${badId}"`);
  }

  return {
    from,
    to,
    ids,
    allowDuplicates: flags["allow-duplicates"] === true,
    envFile:
      typeof flags["env-file"] === "string" && flags["env-file"]
        ? flags["env-file"]
        : ".env.local",
    batch: batchRaw,
    apply: flags.apply === true,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// Accepts a uuid or an email. Email match is case-insensitive because auth
// lowercases addresses but older migrated profiles may not be normalized.
async function resolveUser(
  client: SupabaseClient,
  ref: string,
  label: string,
): Promise<User> {
  const query = client.from("profiles").select("id, email");
  const { data, error } = UUID_RE.test(ref)
    ? await query.eq("id", ref)
    : await query.ilike("email", ref);

  if (error) {
    throw new Error(`Failed to look up ${label} user "${ref}": ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`No ${label} user matches "${ref}".`);
  }
  if (data.length > 1) {
    throw new Error(
      `"${ref}" matches ${data.length} ${label} profiles (${data
        .map((u) => u.id)
        .join(", ")}). Pass the uuid instead.`,
    );
  }

  return data[0] as User;
}

const describe = (user: User) => `${user.email ?? "(no email)"} [${user.id}]`;

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

// PostgREST caps a single response (1000 rows by default), so reads walk pages
// ordered by id — stable because id is the primary key.
async function paginate<T>(
  client: SupabaseClient,
  columns: string,
  userId: string,
  batch: number,
): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += batch) {
    const { data, error } = await client
      .from(TABLE)
      .select(columns)
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(offset, offset + batch - 1);

    if (error) {
      throw new Error(`Failed to read ${TABLE} for ${userId}: ${error.message}`);
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

const frameCount = (row: PresentationRow) =>
  Array.isArray(row.frames) ? row.frames.length : 0;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { from, to, ids, allowDuplicates, envFile, batch, apply } = parseArgs(
    process.argv.slice(2),
  );
  dotenv.config({ path: path.resolve(envFile) });

  // Imported after dotenv so --env-file still decides which project is used.
  const { supabaseAdmin } = await import("../lib/supabaseAdmin");

  const [source, target] = await Promise.all([
    resolveUser(supabaseAdmin, from, "source"),
    resolveUser(supabaseAdmin, to, "target"),
  ]);

  if (source.id === target.id) {
    throw new Error(
      `Source and target are the same user (${describe(source)}). Refusing to copy a user's presentations onto themselves.`,
    );
  }

  console.log(`From: ${describe(source)}`);
  console.log(`To:   ${describe(target)}\n`);

  const owned = await paginate<PresentationRow>(
    supabaseAdmin,
    COLUMNS,
    source.id,
    batch,
  );

  let rows = owned;
  if (ids) {
    const ownedIds = new Set(owned.map((row) => row.id));
    const missing = ids.filter((id) => !ownedIds.has(id));
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} of the --ids are not owned by ${describe(source)}: ${missing.join(", ")}`,
      );
    }
    rows = owned.filter((row) => ids.includes(row.id));
  }

  if (rows.length === 0) {
    console.warn(`⚠️  ${describe(source)} has no presentations — nothing to copy.`);
    return;
  }

  const targetRows = await paginate<{ id: string; title: string }>(
    supabaseAdmin,
    "id, title",
    target.id,
    batch,
  );
  const targetTitles = new Set(targetRows.map((row) => row.title));

  const duplicates = rows.filter((row) => targetTitles.has(row.title));
  const toCopy = allowDuplicates
    ? rows
    : rows.filter((row) => !targetTitles.has(row.title));

  console.log(`${rows.length} presentation(s) selected from the source.`);
  if (duplicates.length > 0) {
    console.log(
      allowDuplicates
        ? `  ${duplicates.length} title(s) already exist in the target — copying anyway (--allow-duplicates)`
        : `  ${duplicates.length} skipped: the target already has that title (--allow-duplicates to copy anyway)`,
    );
    for (const row of duplicates) console.log(`    - "${row.title}"`);
  }

  if (toCopy.length === 0) {
    console.log("\nNothing left to copy.");
    return;
  }

  console.log(`  ${toCopy.length} to copy:`);
  for (const row of toCopy) {
    console.log(
      `    - "${row.title}" (${row.id}) frames=${frameCount(row)} preview=${row.preview_image ? "yes" : "no"}`,
    );
  }

  // New id and firebase_id (unique, belongs to the original) are left to the
  // column defaults; everything else rides along unchanged.
  const inserts = toCopy.map((row) => ({
    user_id: target.id,
    title: row.title,
    preview_image: row.preview_image,
    frames: row.frames,
    created_at: row.created_at,
  }));

  if (!apply) {
    console.log("\nDry run — re-run with --apply to copy.");
    return;
  }

  const batches = chunk(inserts, batch);
  let written = 0;

  for (const [i, group] of batches.entries()) {
    const { error } = await supabaseAdmin.from(TABLE).insert(group);

    if (error) {
      console.error(
        `Failed to insert batch ${i + 1}/${batches.length}: ${error.message}`,
      );
      process.exit(1);
    }

    written += group.length;
    console.log(`  batch ${i + 1}/${batches.length} — ${written}/${inserts.length} rows`);
  }

  console.log(`\n✅ Copied ${written} presentation(s) to ${describe(target)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
