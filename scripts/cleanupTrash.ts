import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function run() {
  const { db } = await import("../lib/firebaseAdmin");

  const cutoff = Date.now() - RETENTION_MS;
  const snapshot = await db.ref("user-presentations").once("value");
  const byUser = snapshot.val() as Record<
    string,
    Record<string, { deletedAt?: number }>
  > | null;

  if (!byUser) {
    console.log("No user-presentations found.");
    process.exit(0);
  }

  const updates: Record<string, null> = {};
  let toDelete = 0;

  for (const [uid, presentations] of Object.entries(byUser)) {
    for (const [presId, val] of Object.entries(presentations || {})) {
      if (val?.deletedAt && val.deletedAt < cutoff) {
        updates[`user-presentations/${uid}/${presId}`] = null;
        updates[`presentations/${presId}`] = null;
        toDelete++;
        console.log(
          `  [${uid}] ${presId} deletedAt=${new Date(val.deletedAt).toISOString()} → purge`,
        );
      }
    }
  }

  if (toDelete === 0) {
    console.log("Nothing to purge.");
    process.exit(0);
  }

  console.log(`\nPurging ${toDelete} presentation(s) older than 30 days...`);
  await db.ref().update(updates);
  console.log("Done.");
  process.exit(0);
}

run().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
