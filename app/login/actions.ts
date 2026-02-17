"use server";

import { cookies } from "next/headers";
import { auth } from "../../lib/firebaseAdmin";
import { getSessionUser } from "../../lib/auth";

const FIREBASE_API_KEY = "AIzaSyAr0dcOhdhNjwVe0_wyCQ4xNRDNbxKDV-E";
const SESSION_EXPIRY = 5 * 24 * 60 * 60 * 1000; // 5 days

interface AuthResult {
  success: boolean;
  error?: string;
  user?: { uid: string; email: string | null; displayName: string | null };
}

async function signInWithFirebaseRest(email: string, password: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || "Authentication failed");
  }

  return res.json();
}

async function createSessionCookie(idToken: string) {
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY,
  });

  const cookieStore = await cookies();
  cookieStore.set("session", sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY / 1000,
  });

  return sessionCookie;
}

export async function signupAction(
  _prevState: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  if (!email || !password || !firstName || !lastName) {
    return { success: false, error: "All fields are required" };
  }

  try {
    const displayName = `${firstName} ${lastName}`;
    await auth.createUser({ email, password, displayName });

    const signInResult = await signInWithFirebaseRest(email, password);
    await createSessionCookie(signInResult.idToken);

    return {
      success: true,
      user: {
        uid: signInResult.localId,
        email,
        displayName,
      },
    };
  } catch (e: any) {
    const message = e.message || "Signup failed";
    if (message.includes("EMAIL_EXISTS")) {
      return { success: false, error: "An account with this email already exists" };
    }
    if (message.includes("WEAK_PASSWORD")) {
      return { success: false, error: "Password should be at least 6 characters" };
    }
    return { success: false, error: message };
  }
}

export async function loginAction(
  _prevState: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  try {
    const signInResult = await signInWithFirebaseRest(email, password);
    await createSessionCookie(signInResult.idToken);

    return {
      success: true,
      user: {
        uid: signInResult.localId,
        email: signInResult.email,
        displayName: signInResult.displayName || null,
      },
    };
  } catch (e: any) {
    const message = e.message || "Login failed";
    if (message.includes("INVALID_LOGIN_CREDENTIALS")) {
      return { success: false, error: "Invalid email or password" };
    }
    if (message.includes("USER_DISABLED")) {
      return { success: false, error: "This account has been disabled" };
    }
    return { success: false, error: message };
  }
}

export async function logoutAction(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  return { success: true };
}

export async function googleLoginAction(
  idToken: string
): Promise<AuthResult> {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    await createSessionCookie(idToken);

    return {
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        displayName: decodedToken.name || null,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message || "Google sign-in failed" };
  }
}

export async function getSession() {
  return getSessionUser();
}
