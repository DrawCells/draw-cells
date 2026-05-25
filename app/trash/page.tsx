import { redirect } from "next/navigation";
import React, { Suspense } from "react";
import { getSessionUser } from "../../lib/auth";
import { db } from "../../lib/firebaseAdmin";
import HomeHeader from "../../src/Header/components/HomeHeader";
import TrashList from "../../src/Home/components/TrashList";

export default async function TrashPage() {
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
    Object.entries(all).filter(([, val]) => !!val?.deletedAt),
  ) as Record<
    string,
    { title: string; previewImage?: string; deletedAt: number }
  >;

  return (
    <Suspense>
      <HomeHeader />
      <TrashList initialPresentations={presentations} />
    </Suspense>
  );
}
