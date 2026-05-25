import { redirect } from "next/navigation";
import React, { Suspense } from "react";
import { getSessionUser } from "../lib/auth";
import { db } from "../lib/firebaseAdmin";
import Home from "../src/Home/components/Home";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const snapshot = await db
    .ref(`/user-presentations/${user.uid}`)
    .once("value");
  const all =
    (snapshot.val() as Record<
      string,
      { title: string; previewImage?: string; deletedAt?: number }
    > | null) || {};
  const presentations = Object.fromEntries(
    Object.entries(all).filter(([, val]) => !val?.deletedAt),
  );

  return (
    <Suspense>
      <Home user={user} presentations={presentations} />
    </Suspense>
  );
}
