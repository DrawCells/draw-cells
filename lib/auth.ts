import { createSupabaseServerClient } from "./supabaseServer";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const displayName =
    meta.first_name && meta.last_name
      ? `${meta.first_name} ${meta.last_name}`
      : meta.full_name || meta.name || null;

  return {
    uid: user.id,
    email: user.email ?? null,
    displayName,
  };
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
