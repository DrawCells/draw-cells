import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser, getAdminUser } from "../../lib/auth";
import { auth } from "../../lib/firebaseAdmin";
import UsersList, { AdminUser } from "../../src/Admin/components/UsersList";

// Firebase returns up to 1000 users per page; page through them all so the
// list matches what the Firebase console shows.
async function listAllUsers(): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const u of result.users) {
      users.push({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        photoURL: u.photoURL ?? null,
        disabled: u.disabled,
        emailVerified: u.emailVerified,
        providerIds: u.providerData.map((p) => p.providerId),
        creationTime: u.metadata.creationTime ?? null,
        lastSignInTime: u.metadata.lastSignInTime ?? null,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

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
