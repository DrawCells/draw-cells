import dotenv from "dotenv";
import { SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP } from "../src/constants";

dotenv.config({ path: ".env.local" });

type SpriteRow = {
  name: string;
  category: string;
  base_image_url: string;
  tags: string[];
  variants: string[];
};

// Build the catalog rows from src/constants (same source as the old
// uploadSpritesToDb.ts). Object keys are no longer sanitized — Postgres has no
// key-character restrictions, and (category, name) is the natural key.
const rows: SpriteRow[] = [];
Object.entries(SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP).forEach(
  ([category, cells]) => {
    Object.entries(cells as Record<string, any>).forEach(([key, value]) => {
      const name = value.name || key;
      rows.push({
        name,
        category,
        base_image_url: `sprites/${category}/${name}`,
        tags: value.tags || [],
        variants: value.variants || [],
      });
    });
  },
);

async function run() {
  const { supabaseAdmin } = await import("../lib/supabaseAdmin");

  // Upsert on the (category, name) unique key so re-runs are idempotent and
  // preserve tag order (which is the search weight).
  const { error } = await supabaseAdmin
    .from("sprites")
    .upsert(rows, { onConflict: "category,name" });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to upsert sprites", error);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Upserted ${rows.length} sprites into Supabase`);
  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to migrate sprites", error);
  process.exit(1);
});
