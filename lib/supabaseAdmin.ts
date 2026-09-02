import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SECRET API key (sb_secret_…), Supabase's
// recommended replacement for the legacy service_role key. Like service_role it
// BYPASSES RLS, so use it only for work that legitimately runs outside a user's
// own rows: catalog seeding, the RTDB->Supabase migration, admin views, and the
// video-export Lambda callback. For anything scoped to the logged-in user, use
// the authenticated client in lib/supabaseServer.ts so RLS is enforced.
//
// Never import this into a client component — it would leak the secret key.
if (typeof window !== "undefined") {
  throw new Error("lib/supabaseAdmin.ts is server-only and must not run in the browser");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}
if (!secretKey) {
  throw new Error("SUPABASE_SECRET_KEY is not set");
}

export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
