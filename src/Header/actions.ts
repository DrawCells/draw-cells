"use server";

import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { getSessionUser } from "../../lib/auth";

export async function deletePresentation(presId: string) {
  const user = await getSessionUser();
  if (!user) return { success: false };

  // RLS restricts the delete to rows owned by the current user.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("presentations")
    .delete()
    .eq("id", presId);

  if (error) {
    console.error("Failed to delete presentation", error);
    return { success: false };
  }
  return { success: true };
}

export async function createNewPresentation() {
  const user = await getSessionUser();
  if (!user) return;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("presentations")
    .insert({ user_id: user.uid, title: "New Presentation" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create new presentation", error);
    return;
  }

  return { key: data.id };
}

export async function renamePresentation(presId: string, title: string) {
  const user = await getSessionUser();
  if (!user) return { success: false };

  // RLS restricts the update to rows owned by the current user.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("presentations")
    .update({ title })
    .eq("id", presId);

  if (error) {
    console.error("Failed to rename presentation", error);
    return { success: false };
  }
  return { success: true };
}
