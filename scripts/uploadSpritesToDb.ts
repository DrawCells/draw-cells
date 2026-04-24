import dotenv from "dotenv";
import { SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP } from "../src/constants";

dotenv.config({ path: ".env.local" });

type SpriteEntry = {
  name: string;
  tags?: string[];
  variants?: string[];
  baseImageUrl: string;
  category: string;
};

// Firebase Realtime Database keys cannot contain ".", "#", "$", "/", "[", or "]"
function toFirebaseKey(name: string): string {
  return name.replace(/\./g, "_");
}

const sprites: Record<string, SpriteEntry> = {};

Object.entries(SPRITES_BY_CATEGORY_TO_SVG_ELEMENT_MAP).forEach(
  ([category, cells]) => {
    Object.entries(cells).forEach(([key, value]) => {
      const name = value.name || key;
      const firebaseKey = toFirebaseKey(name);
      sprites[firebaseKey] = {
        name,
        tags: value.tags || [],
        variants: value.variants || [],
        category: category,
        baseImageUrl: `sprites/${category}/${name}`,
      };
    });
  },
);

async function run() {
  const { db } = await import("../lib/firebaseAdmin");
  await db.ref("sprites").set(sprites);
  // eslint-disable-next-line no-console
  console.log(`Uploaded ${Object.keys(sprites).length} sprites to /sprites`);
  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to upload sprites", error);
  process.exit(1);
});
