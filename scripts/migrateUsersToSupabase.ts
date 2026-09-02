import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Splits a Firebase displayName ("First Last") into the first/last fields the
// profiles table and signup metadata use.
function splitName(displayName?: string | null) {
  if (!displayName) return { first_name: null as string | null, last_name: null as string | null };
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

async function run() {
  const { auth: firebaseAuth } = await import("./firebaseAdmin");
  const { supabaseAdmin } = await import("../lib/supabaseAdmin");

  const dryRun = process.argv.includes("--dry-run");

  let created = 0;
  let existed = 0;
  let mapped = 0;
  let skipped = 0;
  let total = 0;
  let nextPageToken: string | undefined;

  do {
    const result = await firebaseAuth.listUsers(1000, nextPageToken);

    for (const u of result.users) {
      total++;
      const email = u.email?.toLowerCase();
      if (!email) {
        skipped++;
        // eslint-disable-next-line no-console
        console.warn(`skip ${u.uid}: no email`);
        continue;
      }

      const { first_name, last_name } = splitName(u.displayName);
      const providers = u.providerData.map((p) => p.providerId).join(",");

      if (dryRun) {
        // eslint-disable-next-line no-console
        console.log(`would migrate ${email}  name="${first_name ?? ""} ${last_name ?? ""}"  providers=[${providers}]`);
        continue;
      }

      // Create the Supabase user with NO password, so email/password login fails
      // until the user resets. email_confirm:true marks the email verified
      // WITHOUT sending any email. Google users link to this row by email later.
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

      let supabaseId = data?.user?.id;

      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          existed++; // idempotent re-run
        } else {
          // eslint-disable-next-line no-console
          console.error(`createUser failed for ${email}: ${error.message}`);
          skipped++;
          continue;
        }
      } else {
        created++;
      }

      // Resolve the id via profiles (covers the already-existed case), then
      // stamp the Firebase uid onto the profile for the Phase 5 remap.
      if (!supabaseId) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();
        supabaseId = prof?.id;
      }
      if (!supabaseId) {
        // eslint-disable-next-line no-console
        console.error(`could not resolve supabase id for ${email}`);
        skipped++;
        continue;
      }

      const { error: mapErr } = await supabaseAdmin
        .from("profiles")
        .update({ firebase_uid: u.uid })
        .eq("id", supabaseId);
      if (mapErr) {
        // eslint-disable-next-line no-console
        console.error(`mapping update failed for ${email}: ${mapErr.message}`);
      } else {
        mapped++;
      }
    }

    nextPageToken = result.pageToken;
  } while (nextPageToken);

  // eslint-disable-next-line no-console
  console.log(
    `Done${dryRun ? " (dry run)" : ""}. firebaseUsers=${total} created=${created} alreadyExisted=${existed} mapped=${mapped} skipped=${skipped}`,
  );
  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("User migration failed", error);
  process.exit(1);
});
