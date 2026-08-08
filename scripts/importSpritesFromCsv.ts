/**
 * Additive sprite import: CSV (name + tags) x S3 (which files actually exist)
 * -> upsert into the Supabase `sprites` table.
 *
 * Unlike generateSpriteMap.ts, this touches neither src/constants.tsx nor any
 * category it wasn't explicitly pointed at. `--categories` is required for that
 * reason: a run scoped to the whole bucket would re-upsert every existing sprite
 * with whatever tags happened to be in the CSV, wiping the curated ones.
 *
 * S3 is the source of truth for which sprites exist and what colour variants
 * they have; the CSV only supplies tags. Tag ORDER is preserved — search_sprites
 * ranks exact tag matches by array_position, so the first tag is the strongest.
 *
 * Usage:
 *   npm run import:sprites -- <csv-path> --categories "Cells,Viruses" [options]
 *
 * Options:
 *   --categories <list>  Comma-separated S3 category folders under sprites/. Required.
 *   --delimiter <char>   CSV field delimiter. Default: auto-detected from the header.
 *   --apply              Perform the upsert. Without it, prints the plan and exits.
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const SPRITES_PREFIX = "sprites/";

// Same colour-suffix convention as generateSpriteMap.ts: "Name - blue.svg".
const VARIANT_RE = /^(.+?) ?- ([a-z]+(?:_[a-z]+)*)$/;

// Canonical colour order, so the sidebar's default variant is stable across runs.
const COLOR_ORDER = [
  "beige",
  "black",
  "blue",
  "green",
  "grey",
  "orange",
  "peach",
  "pink",
  "purple",
  "red",
  "white",
  "yellow",
];

type SpriteRow = {
  name: string;
  category: string;
  base_image_url: string;
  tags: string[];
  variants: string[];
};

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === "apply") {
      flags[key] = true;
      continue;
    }
    flags[key] = argv[++i] ?? "";
  }

  const csvPath = positional[0];
  if (!csvPath) {
    throw new Error("Missing <csv-path>. See the usage comment at the top of this file.");
  }

  const categoriesRaw = flags.categories;
  if (typeof categoriesRaw !== "string" || !categoriesRaw.trim()) {
    throw new Error(
      "--categories is required. Pass the S3 folders under sprites/ to import, " +
        'e.g. --categories "Cells,Viruses". Refusing to scan the whole bucket, ' +
        "which would overwrite tags on existing sprites.",
    );
  }

  return {
    csvPath: path.resolve(csvPath),
    categories: categoriesRaw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    delimiter: typeof flags.delimiter === "string" ? flags.delimiter : null,
    apply: flags.apply === true,
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

// Picks whichever candidate delimiter splits the header into the most fields.
// The Addendum exports are semicolon-separated; the original library CSV is
// comma-separated with the tag list quoted.
function detectDelimiter(headerLine: string): string {
  const candidates = [";", "\t", ","];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

// Splits one CSV line, honouring double-quoted fields (which may contain the
// delimiter). Doubled quotes inside a quoted field are literal quotes.
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// Returns name -> ordered tags. Column 0 is the root name, column 1 the tags
// (always comma-separated, even when the field delimiter is something else).
function parseCsv(filePath: string, delimiterOverride: string | null) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) throw new Error(`CSV is empty: ${filePath}`);

  const delimiter = delimiterOverride ?? detectDelimiter(lines[0]);
  const tagsByName = new Map<string, string[]>();

  for (const line of lines.slice(1)) {
    const fields = splitLine(line, delimiter);
    const name = (fields[0] ?? "").replace(/\\\./g, ".").trim();
    if (!name) continue;

    const tags = (fields[1] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // De-duplicate while preserving order — position is the search weight.
    const seen = new Set<string>();
    const ordered = tags.filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    tagsByName.set(name, ordered);
  }

  return { tagsByName, delimiter };
}

// ---------------------------------------------------------------------------
// S3
// ---------------------------------------------------------------------------

type S3Sprite = { name: string; category: string; variants: string[] };

async function listCategory(category: string): Promise<S3Sprite[]> {
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const { s3, S3_BUCKET } = await import("../lib/s3");

  const prefix = `${SPRITES_PREFIX}${category}/`;
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.Key.endsWith(".svg")) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  // Group "Name - colour.svg" files into one sprite carrying the colour list.
  const variantsByName = new Map<string, Set<string>>();
  for (const key of keys) {
    const fileName = key.slice(prefix.length);
    if (fileName.includes("/")) continue; // ignore any nested folders
    const withoutExt = fileName.slice(0, -4);

    const match = withoutExt.match(VARIANT_RE);
    const name = match ? match[1].trim() : withoutExt.replace(/ ?-\s*$/, "").trim();
    if (!name) continue;

    if (!variantsByName.has(name)) variantsByName.set(name, new Set());
    if (match) variantsByName.get(name)!.add(match[2]);
  }

  return [...variantsByName.entries()]
    .map(([name, variantSet]) => ({
      name,
      category,
      variants: [...variantSet].sort((a, b) => {
        const ai = COLOR_ORDER.indexOf(a);
        const bi = COLOR_ORDER.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { csvPath, categories, delimiter: delimiterOverride, apply } = parseArgs(
    process.argv.slice(2),
  );

  const { tagsByName, delimiter } = parseCsv(csvPath, delimiterOverride);
  console.log(
    `Parsed ${tagsByName.size} rows from ${path.basename(csvPath)} (delimiter ${JSON.stringify(delimiter)})`,
  );

  const rows: SpriteRow[] = [];
  const untagged: string[] = [];
  const matchedCsvNames = new Set<string>();

  for (const category of categories) {
    const sprites = await listCategory(category);
    if (sprites.length === 0) {
      console.warn(`⚠️  No .svg files under ${SPRITES_PREFIX}${category}/`);
      continue;
    }

    for (const sprite of sprites) {
      let tags = tagsByName.get(sprite.name);
      if (!tags) {
        // Fall back to a case-insensitive match before giving up.
        for (const [csvName, csvTags] of tagsByName) {
          if (csvName.toLowerCase() === sprite.name.toLowerCase()) {
            tags = csvTags;
            matchedCsvNames.add(csvName);
            break;
          }
        }
      } else {
        matchedCsvNames.add(sprite.name);
      }

      if (!tags) untagged.push(`${category}/${sprite.name}`);

      rows.push({
        name: sprite.name,
        category,
        // No .svg extension: the client appends it, plus " - <variant>".
        base_image_url: `${SPRITES_PREFIX}${category}/${sprite.name}`,
        tags: tags ?? [],
        variants: sprite.variants,
      });
    }

    const withVariants = sprites.filter((s) => s.variants.length > 0).length;
    console.log(
      `  ${category}: ${sprites.length} sprites (${withVariants} with variants)`,
    );
  }

  for (const name of untagged) {
    console.warn(`⚠️  No CSV row for S3 sprite: "${name}" — importing with empty tags`);
  }
  for (const csvName of tagsByName.keys()) {
    if (!matchedCsvNames.has(csvName)) {
      console.warn(`ℹ️  CSV row has no S3 file in the given categories: "${csvName}"`);
    }
  }

  console.log(`\n${rows.length} rows ready.`);

  if (!apply) {
    console.log("Dry run — re-run with --apply to upsert. Sample:");
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  const { supabaseAdmin } = await import("../lib/supabaseAdmin");
  const { error } = await supabaseAdmin
    .from("sprites")
    .upsert(rows, { onConflict: "category,name" });

  if (error) {
    console.error("Failed to upsert sprites", error);
    process.exit(1);
  }

  console.log(`✅ Upserted ${rows.length} sprites into Supabase`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
