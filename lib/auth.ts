import { cookies } from "next/headers";
import { auth } from "./firebaseAdmin";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
    };
  } catch {
    return null;
  }
}

// Comma-separated allowlist of admin emails, e.g. "a@x.com, b@y.com".
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

// Returns the current session user only if they are an admin, otherwise null.
export async function getAdminUser() {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
