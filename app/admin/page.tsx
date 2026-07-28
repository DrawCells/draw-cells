import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser, getAdminUser } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import UsersList, { AdminUser } from "../../src/Admin/components/UsersList";

const PER_PAGE = 1000;

function displayNameOf(meta: Record<string, unknown>): string | null {
  const first = meta.first_name as string | undefined;
  const last = meta.last_name as string | undefined;
  if (first && last) return `${first} ${last}`;
  return (meta.full_name as string) || (meta.name as string) || null;
}

// Supabase caps a page at 1000 users; page through them all so the list matches
// what the Supabase dashboard shows.
async function listAllUsers(): Promise<AdminUser[]> {
  const users: AdminUser[] = [];

  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) throw error;

    for (const u of data.users) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      // app_metadata.providers is the aggregated list; fall back to identities
      // for users created before it was populated (e.g. the migration import).
      const providerIds =
        (u.app_metadata?.providers as string[] | undefined) ??
        u.identities?.map((i) => i.provider) ??
        [];

      users.push({
        uid: u.id,
        email: u.email ?? null,
        displayName: displayNameOf(meta),
        photoURL:
          (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
        // Supabase bans rather than disables; treat a future ban as disabled.
        disabled: Boolean(
          u.banned_until && new Date(u.banned_until).getTime() > Date.now(),
        ),
        emailVerified: Boolean(u.email_confirmed_at),
        providerIds,
        creationTime: u.created_at ?? null,
        lastSignInTime: u.last_sign_in_at ?? null,
      });
    }

    if (data.users.length < PER_PAGE) break;
  }

  return users;
}

export default async function AdminPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const adminUser = await getAdminUser();
  // Signed in but not an admin: don't reveal the page exists.
  if (!adminUser) redirect("/");

  const users = await listAllUsers();

  return (
    <Suspense>
      <UsersList users={users} />
    </Suspense>
  );
}
