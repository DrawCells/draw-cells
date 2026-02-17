"use server";

import { db } from "../../lib/firebaseAdmin";
import { getSessionUser } from "../../lib/auth";

export async function deletePresentation(presId: string) {
  const user = await getSessionUser();
  if (!user) return { success: false };

  await db.ref(`/presentations/${presId}`).remove();
  await db.ref(`/user-presentations/${user.uid}/${presId}`).remove();

  return { success: true };
}

export async function createNewPresentation() {
  const user = await getSessionUser();
  if (!user) return;

  const newPresentation = await db.ref().child("presentations").push({
    user_id: user.uid,
    title: "New Presentation",
  });
  if (!newPresentation?.key) {
    console.error("Failed to create new presentation");
    return;
  }

  await db
    .ref()
    .child("user-presentations")
    .child(user.uid)
    .child(newPresentation.key)
    .set({
      title: "New Presentation",
    });

  return { key: newPresentation.key };
}
