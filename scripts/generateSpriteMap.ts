/**
 * Generates SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP in src/constants.tsx
 * by scanning SVG files in public/assets/cells and matching them to
 * tags from the CSV file.
 *
 * Usage: npx tsx scripts/generateSpriteMap.ts
 */

import fs from "fs";
import path from "path";

const CELLS_DIR = path.resolve("public/assets/cells");
const CSV_FILE = path.join(
  CELLS_DIR,
  "Illustrated Library renamed tags - V1.xlsx - Sheet1 (1).csv",
);
const CONSTANTS_FILE = path.resolve("src/constants.tsx");

// These top-level folders are skipped entirely
const SKIP_FOLDERS = new Set<string>();

// Maps top-level folder names to display category names.
// Key must match the actual folder name on disk (including any trailing spaces).
const FOLDER_TO_CATEGORY: Record<string, string> = {
  Backgrounds: "Backgrounds",
  Brain: "Brain",
  "Cancer cells ": "Cancer Cells", // trailing space in actual folder name
  "DNA and RNA": "DNA and RNA",
  "Immune cells": "Immune Cells",
  "Ioana_s illustrations": "Molecules",
  "Lab animals": "Lab Animals",
  "Lab icons": "Lab Icons",
  "Laboratory Instruments": "Laboratory Instruments",
  "Laboratory materials": "Laboratory Materials",
  "Membrane receptors": "Membrane Receptors",
  Organs: "Organs",
  Pathogens: "Pathogens",
  "Structural cells": "Structural Cells",
};

// When a file's base name doesn't match any CSV row name, look up here.
// Key = actual file base name, Value = CSV "Root name" column value.
const FILE_TO_CSV_OVERRIDES: Record<string, string> = {
  "dsDNA (long)": "DNA (long)",
  "dsDNA (short)": "DNA (short)",
  "Apoptotic cell": "Apoptotic cell 1",
  "Apoptotic cancer cell": "Apoptotic cell 2",
  "B cell receptor (IgA)": "B cell receptor (IgA)",   // CSV has trailing space — handled by trim
  "B cell receptor (IgE)": "B cell receptor (IgE)",   // CSV has trailing space — handled by trim
  "B cell receptor (IgG, upright)": "B cell receptor (IgG, straight)",
  "B cell receptor (IgM, pentamer)": "Immunoglobulin (IgM, pentamer)",
  "B cell receptor (IgM, pentamer 2)": "Immunoglobulin (IgM, pentamer variant)",
  "B cell receptor (IgA, dimer)": "Immunoglobulin (IgA, dimer)",
  // "T cell receptor - purple" parsed as baseName "T cell receptor"; map to simple groove
  "T cell receptor": "T cell receptor (simple groove)",
  // Files are named PD-1 / PD-L1; CSV uses full "Immune receptor (...)" names
  "PD-1": "Immune receptor (PD-1)",
  "PD-L1": "Immune receptor (PD-L1)",
  // CSV has a typo ("circluar"); file name is correct ("circular")
  "Cell membrane (circular)": "Cell membrane (circluar)",
};

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCSV(filePath: string): Map<string, string[]> {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).slice(1); // drop header row
  const map = new Map<string, string[]>();

  for (const line of lines) {
    if (!line.trim()) continue;

    // Each line is either:
    //   Name,"tag1, tag2, ..."
    //   "Name with, comma","tag1, tag2, ..."
    // We need to split at the boundary between name column and tags column.

    let name: string;
    let tagsPart: string;

    if (line.startsWith('"')) {
      // Quoted name field — find closing quote that is followed by ","
      const closeQuote = line.indexOf('",');
      if (closeQuote === -1) continue;
      name = line.slice(1, closeQuote);
      tagsPart = line.slice(closeQuote + 2);
    } else {
      const firstComma = line.indexOf(",");
      if (firstComma === -1) continue;
      name = line.slice(0, firstComma);
      tagsPart = line.slice(firstComma + 1);
    }

    // Remove backslash-escaped periods (e.g. "1\.5ml" → "1.5ml")
    name = name.replace(/\\\./g, ".");
    // Trim surrounding whitespace (some CSV rows have trailing spaces)
    name = name.trim();

    // Strip surrounding quotes from tags field
    if (tagsPart.startsWith('"') && tagsPart.endsWith('"')) {
      tagsPart = tagsPart.slice(1, -1);
    }

    const tags = tagsPart
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    map.set(name, tags);
  }

  return map;
}

// ---------------------------------------------------------------------------
// File system scanning
// ---------------------------------------------------------------------------

interface SpriteFile {
  category: string;
  baseName: string; // file name without " - color.svg"
  variant: string | null; // e.g. "blue", or null if no variant
}

function scanSVGFiles(dir: string): SpriteFile[] {
  const results: SpriteFile[] = [];
  const topLevelEntries = fs.readdirSync(dir);

  for (const topFolder of topLevelEntries) {
    if (SKIP_FOLDERS.has(topFolder)) continue;

    const category = FOLDER_TO_CATEGORY[topFolder];
    if (!category) continue; // unknown folder, skip

    const topPath = path.join(dir, topFolder);
    const stat = fs.statSync(topPath);
    if (!stat.isDirectory()) continue;

    // Recurse into this category folder (may have sub-folders)
    collectSVGs(topPath, category, results);
  }

  return results;
}

function collectSVGs(dir: string, category: string, out: SpriteFile[]) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(".")) continue;

    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      collectSVGs(fullPath, category, out);
      continue;
    }

    if (!entry.endsWith(".svg")) continue;

    // Parse file name: "Cell name - color.svg" or "Cell name.svg"
    const withoutExt = entry.slice(0, -4); // strip .svg

    // Detect " - color" suffix: look for " - " or "- " followed by a lowercase
    // color word (or compound "color_color") at the end of the string.
    const variantMatch = withoutExt.match(/^(.+?) ?- ([a-z]+(?:_[a-z]+)*)$/);

    let baseName: string;
    let variant: string | null;

    if (variantMatch) {
      baseName = variantMatch[1];
      variant = variantMatch[2];
    } else {
      // Strip any trailing " - " separator left by malformed filenames (e.g. "PD-L1 - .svg")
      baseName = withoutExt.replace(/ ?-\s*$/, "").trim();
      variant = null;
    }


    out.push({ category, baseName, variant });
  }
}

// ---------------------------------------------------------------------------
// Build the sprite map
// ---------------------------------------------------------------------------

interface SpriteEntry {
  name: string;
  tags: string[];
  variants: string[];
}

type CategoryMap = Map<string, Map<string, SpriteEntry>>;

function buildSpriteMap(
  files: SpriteFile[],
  csvTags: Map<string, string[]>,
): CategoryMap {
  // Step 1: group files by category → baseName → variants[]
  const grouped = new Map<string, Map<string, Set<string>>>();

  for (const file of files) {
    if (!grouped.has(file.category)) {
      grouped.set(file.category, new Map());
    }
    const byName = grouped.get(file.category)!;
    if (!byName.has(file.baseName)) {
      byName.set(file.baseName, new Set());
    }
    if (file.variant) {
      byName.get(file.baseName)!.add(file.variant);
    }
  }

  const warned = new Set<string>();

  // Step 2: for each baseName, look up tags
  const result: CategoryMap = new Map();

  for (const [category, byName] of grouped) {
    const categoryMap = new Map<string, SpriteEntry>();

    for (const [baseName, variantSet] of byName) {
      // Try exact match in CSV first
      let tags = csvTags.get(baseName);
      let csvKey = baseName;

      // Try override map
      if (!tags && FILE_TO_CSV_OVERRIDES[baseName]) {
        csvKey = FILE_TO_CSV_OVERRIDES[baseName];
        tags = csvTags.get(csvKey);
      }

      // Try case-insensitive match
      if (!tags) {
        for (const [k, v] of csvTags) {
          if (k.toLowerCase() === baseName.toLowerCase()) {
            tags = v;
            csvKey = k;
            break;
          }
        }
      }

      if (!tags && !warned.has(baseName)) {
        console.warn(`⚠️  No CSV match for file: "${baseName}" (${category})`);
        warned.add(baseName);
        tags = [];
      }

      // Canonical color order for variants
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
      const sortedVariants = [...variantSet].sort((a, b) => {
        const ai = COLOR_ORDER.indexOf(a);
        const bi = COLOR_ORDER.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      });

      // De-duplicate tags
      const uniqueTags = [...new Set(tags || [])].sort();

      categoryMap.set(baseName, {
        name: baseName,
        tags: uniqueTags,
        variants: sortedVariants,
      });
    }

    result.set(category, categoryMap);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function renderSpriteMap(spriteMap: CategoryMap): string {
  // Sort categories alphabetically
  const categories = [...spriteMap.keys()].sort();

  const lines: string[] = [];
  lines.push(
    "export const SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP = {",
  );

  for (const category of categories) {
    const entries = spriteMap.get(category)!;
    // Sort entries alphabetically by name
    const sortedEntries = [...entries.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    lines.push(`  ${JSON.stringify(category)}: {`);

    for (const [, entry] of sortedEntries) {
      lines.push(`    ${JSON.stringify(entry.name)}: {`);
      lines.push(`      name: ${JSON.stringify(entry.name)},`);

      if (entry.tags.length === 0) {
        lines.push(`      tags: [],`);
      } else {
        lines.push(`      tags: [`);
        for (const tag of entry.tags) {
          lines.push(`        ${JSON.stringify(tag)},`);
        }
        lines.push(`      ],`);
      }

      if (entry.variants.length > 0) {
        const variantsStr = entry.variants
          .map((v) => JSON.stringify(v))
          .join(", ");
        lines.push(`      variants: [${variantsStr}],`);
      }

      lines.push(`    },`);
    }

    lines.push(`  },`);
  }

  lines.push("} as const;");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Patch constants.tsx
// ---------------------------------------------------------------------------

function updateConstantsFile(newMapCode: string) {
  const original = fs.readFileSync(CONSTANTS_FILE, "utf-8");

  // Replace from "export const SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP = {"
  // to the closing "} as const;"
  const startMarker = "export const SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP =";
  const startIdx = original.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error("Could not find SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP in constants.tsx");
  }

  // Find "} as const;" after the start marker
  const endMarker = "} as const;";
  const endIdx = original.indexOf(endMarker, startIdx);
  if (endIdx === -1) {
    throw new Error("Could not find end marker '} as const;' in constants.tsx");
  }
  const endPos = endIdx + endMarker.length;

  const newContent =
    original.slice(0, startIdx) + newMapCode + original.slice(endPos);

  fs.writeFileSync(CONSTANTS_FILE, newContent, "utf-8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("📂 Scanning SVG files...");
  const files = scanSVGFiles(CELLS_DIR);
  console.log(`   Found ${files.length} SVG files`);

  console.log("📄 Parsing CSV...");
  const csvTags = parseCSV(CSV_FILE);
  console.log(`   Loaded ${csvTags.size} entries`);

  // Warn about CSV entries that have no matching file
  const fileBaseNames = new Set(files.map((f) => f.baseName));
  const reverseOverrides = new Map(
    Object.entries(FILE_TO_CSV_OVERRIDES).map(([file, csv]) => [csv, file]),
  );
  for (const csvName of csvTags.keys()) {
    const isDirectMatch = fileBaseNames.has(csvName);
    const hasOverride = reverseOverrides.has(csvName);
    if (!isDirectMatch && !hasOverride) {
      // Check case-insensitive
      const hasCI = [...fileBaseNames].some(
        (n) => n.toLowerCase() === csvName.toLowerCase(),
      );
      if (!hasCI) {
        console.warn(`ℹ️  CSV entry has no matching file: "${csvName}"`);
      }
    }
  }

  console.log("🔧 Building sprite map...");
  const spriteMap = buildSpriteMap(files, csvTags);

  let totalSprites = 0;
  for (const entries of spriteMap.values()) totalSprites += entries.size;
  console.log(
    `   ${spriteMap.size} categories, ${totalSprites} sprites total`,
  );

  console.log("✍️  Generating TypeScript...");
  const code = renderSpriteMap(spriteMap);

  console.log("💾 Writing constants.tsx...");
  updateConstantsFile(code);

  console.log("✅ Done!");
}

main();
