import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Only used for client-initiated flows that must run in
// the browser — currently the Google OAuth redirect (signInWithOAuth). Uses the
// publishable key (safe to expose) and is RLS-scoped like any anon client.
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set",
    );
  }

  return createBrowserClient(url, publishableKey);
}
