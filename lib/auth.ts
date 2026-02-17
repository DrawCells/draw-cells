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
