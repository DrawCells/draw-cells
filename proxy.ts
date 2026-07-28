import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClientWithCookies } from "./lib/supabaseServer";

export async function proxy(request: NextRequest) {
  // Base response we can attach refreshed auth cookies to.
  let response = NextResponse.next({ request });

  const supabase = createSupabaseServerClientWithCookies({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value),
      );
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
    },
  });

  // Refreshes the session cookie when needed and tells us who's signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes.
  if (pathname.startsWith("/presentations/") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from /login.
  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets, so the session
  // is refreshed across the app (not just on the gated routes).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
