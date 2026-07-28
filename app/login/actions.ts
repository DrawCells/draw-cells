"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { getSessionUser } from "../../lib/auth";

interface AuthResult {
  success: boolean;
  error?: string;
  // True when the failure is "invalid credentials" — the login form uses it to
  // offer a password reset, since migrated users have no password set yet.
  canReset?: boolean;
  user?: { uid: string; email: string | null; displayName: string | null };
}

export async function signupAction(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  if (!email || !password || !firstName || !lastName) {
    return { success: false, error: "All fields are required" };
  }

  const supabase = await createSupabaseServerClient();
  // Email confirmation is disabled, so a successful signUp returns a session and
  // the auth cookies are set on this response. The profiles row is created by the
  // on_auth_user_created trigger, which reads these metadata fields.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });

  if (error) {
    const message = error.message || "Signup failed";
    if (/already registered|already exists/i.test(message)) {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }
    if (/password/i.test(message)) {
      return { success: false, error: "Password should be at least 6 characters" };
    }
    return { success: false, error: message };
  }

  return {
    success: true,
    user: {
      uid: data.user?.id ?? "",
      email,
      displayName: `${firstName} ${lastName}`,
    },
  };
}

export async function loginAction(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message = error.message || "Login failed";
    if (/invalid login credentials/i.test(message)) {
      return {
        success: false,
        error: "Invalid email or password",
        canReset: true,
      };
    }
    if (/email not confirmed/i.test(message)) {
      return { success: false, error: "Please confirm your email first" };
    }
    return { success: false, error: message };
  }

  return {
    success: true,
    user: {
      uid: data.user.id,
      email: data.user.email ?? null,
      displayName:
        (data.user.user_metadata?.first_name &&
          data.user.user_metadata?.last_name &&
          `${data.user.user_metadata.first_name} ${data.user.user_metadata.last_name}`) ||
        null,
    },
  };
}

export async function logoutAction(): Promise<{ success: boolean }> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return { success: true };
}

export async function resetPasswordAction(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  if (!email) {
    return { success: false, error: "Enter your email address first" };
  }

  const h = await headers();
  const origin = h.get("origin") || `https://${h.get("host")}`;

  const supabase = await createSupabaseServerClient();
  // Sends a one-time reset link. The link routes through /auth/callback (which
  // exchanges the code for a recovery session) and on to /auth/reset, where the
  // user sets a new password. This is the only email the app sends.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset`,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getSession() {
  return getSessionUser();
}
