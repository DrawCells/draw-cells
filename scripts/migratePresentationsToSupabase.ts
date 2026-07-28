import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// RTDB stores arrays as real arrays when keys are contiguous, but as objects
// with numeric string keys when sparse. Normalize to an ordered array.
function toArray(value: any): any[] {
  if (Array.isArray(value)) return value.filter((v) => v != null);
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

async function run() {
  const { db } = await import("./firebaseAdmin");
  const { supabaseAdmin } = await import("../lib/supabaseAdmin");

  const dryRun = process.argv.includes("--dry-run");

  // firebase uid -> supabase uid (from the Phase 3 user migration).
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, firebase_uid")
    .not("firebase_uid", "is", null);
  if (profErr) throw profErr;
  const uidMap = new Map<string, string>(
    (profiles ?? []).map((p) => [p.firebase_uid as string, p.id as string]),
  );
  // Presentations created during the Phase 2-4 window already carry a Supabase
  // user id (auth had moved but presentations still wrote to RTDB). Recognize
  // those so they aren't dropped as "unknown user".
  const { data: allProfiles } = await supabaseAdmin.from("profiles").select("id");
  const supabaseIds = new Set((allProfiles ?? []).map((p) => p.id as string));

  const [presSnap, userPresSnap] = await Promise.all([
    db.ref("presentations").get(),
    db.ref("user-presentations").get(),
  ]);
  const presentations = (presSnap.val() || {}) as Record<string, any>;
  const userPresentations = (userPresSnap.val() || {}) as Record<
    string,
    Record<string, any>
  >;

  let migrated = 0;
  let skippedNoUser = 0;
  let total = 0;
  const rows: any[] = [];

  for (const [presId, pres] of Object.entries(presentations)) {
    total++;
    const ownerId = pres?.user_id as string | undefined;
    // Either an old Firebase uid (map it) or an already-Supabase id (use as-is).
    const supabaseUid = ownerId
      ? uidMap.get(ownerId) ?? (supabaseIds.has(ownerId) ? ownerId : undefined)
      : undefined;

    if (!supabaseUid) {
      skippedNoUser++;
      // eslint-disable-next-line no-console
      console.warn(
        `skip presentation ${presId}: no Supabase user for owner ${ownerId}`,
      );
      continue;
    }

    // previewImage lived on the user-presentations side in RTDB, keyed by
    // whatever owner id the presentation used.
    const previewImage =
      ownerId && userPresentations[ownerId]?.[presId]?.previewImage;

    rows.push({
      firebase_id: presId,
      user_id: supabaseUid,
      title: pres?.title ?? "New Presentation",
      preview_image: previewImage ?? null,
      frames: toArray(pres?.frames),
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `presentations=${total} toMigrate=${rows.length} skippedNoUser=${skippedNoUser}`,
  );

  if (dryRun) {
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(
        `would migrate "${r.title}" (fb ${r.firebase_id}) frames=${r.frames.length} preview=${r.preview_image ? "yes" : "no"}`,
      );
    }
    console.log("Done (dry run).");
    process.exit(0);
  }

  // Upsert on firebase_id so re-runs don't duplicate.
  const { error } = await supabaseAdmin
    .from("presentations")
    .upsert(rows, { onConflict: "firebase_id" });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to upsert presentations", error);
    process.exit(1);
  }
  migrated = rows.length;

  // eslint-disable-next-line no-console
  console.log(`Done. migrated=${migrated} skippedNoUser=${skippedNoUser}`);
  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Presentation migration failed", error);
  process.exit(1);
});
