import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Extracts the Firebase Storage path from a GCS signed URL.
// e.g. https://storage.googleapis.com/drawcells.appspot.com/sprites/Brain/Neuron.svg?X-Goog-...
// → sprites/Brain/Neuron.svg
function extractStoragePath(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "storage.googleapis.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      return parts.slice(1).join("/"); // strip bucket name
    }
  } catch {}
  return null;
}

async function run() {
  const { db } = await import("../lib/firebaseAdmin");

  const snapshot = await db.ref("presentations").once("value");
  const presentations = snapshot.val() as Record<string, any> | null;

  if (!presentations) {
    console.log("No presentations found.");
    process.exit(0);
  }

  const updates: Record<string, any> = {};
  let migratedCount = 0;

  for (const [presentationId, presentation] of Object.entries(presentations)) {
    const frames: any[] = presentation.frames || [];

    let presentationChanged = false;
    const newFrames = frames.map((frame: any) => {
      const sprites: any[] = frame.sprites || [];
      let frameChanged = false;

      const newSprites = sprites.map((sprite: any) => {
        const storagePath = extractStoragePath(sprite.backgroundUrl);
        if (storagePath) {
          frameChanged = true;
          presentationChanged = true;
          migratedCount++;
          console.log(
            `  [${presentationId}] sprite ${sprite.id}: ${sprite.backgroundUrl.slice(0, 80)}... → ${storagePath}`,
          );
          return { ...sprite, backgroundUrl: storagePath };
        }
        return sprite;
      });

      return frameChanged ? { ...frame, sprites: newSprites } : frame;
    });

    if (presentationChanged) {
      updates[`presentations/${presentationId}/frames`] = newFrames;
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log("No signed URLs found — nothing to migrate.");
    process.exit(0);
  }

  console.log(
    `\nMigrating ${migratedCount} sprite(s) across ${Object.keys(updates).length} presentation(s)...`,
  );
  await db.ref().update(updates);
  console.log("Done.");
  process.exit(0);
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
