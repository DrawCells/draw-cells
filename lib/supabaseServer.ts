import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  }

  return { url, publishableKey };
}

// Build an @supabase/ssr server client with a caller-supplied cookie adapter.
// The cookie store differs by context and cannot be shared: Server Components,
// route handlers, and server actions use next/headers (createSupabaseServerClient
// below); middleware uses the NextRequest/NextResponse cookie stores (proxy.ts).
// This factory centralizes only the env validation + client construction. It has
// no static next/headers dependency, so it is safe to import from middleware.
export function createSupabaseServerClientWithCookies(
  cookies: CookieMethodsServer,
) {
  const { url, publishableKey } = getSupabaseEnv();
  return createServerClient(url, publishableKey, { cookies });
}

// Authenticated, RLS-scoped client for Server Components, route handlers, and
// server actions. Reads the user's session from next/headers cookies, so every
// query runs as that user and RLS (auth.uid() = user_id) is enforced. Default
// client for user-scoped work; use supabaseAdmin only to deliberately bypass RLS.
// next/headers is imported dynamically so this module stays middleware-safe.
export async function createSupabaseServerClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createSupabaseServerClientWithCookies({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      // In a Server Component the cookie store is read-only and this throws;
      // that's fine because proxy.ts refreshes the session on every request.
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      } catch {
        // no-op: session refresh handled by middleware
      }
    },
  });
}
