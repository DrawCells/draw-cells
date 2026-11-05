"use server";

import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { getSessionUser } from "../../lib/auth";
import { CANVAS_MAX_SIZE, CANVAS_MIN_SIZE } from "../constants";

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

export async function resizePresentationCanvas(
  presId: string,
  width: number,
  height: number,
) {
  const user = await getSessionUser();
  if (!user) return { success: false };

  const isValid = (n: number) =>
    Number.isInteger(n) && n >= CANVAS_MIN_SIZE && n <= CANVAS_MAX_SIZE;
  if (!isValid(width) || !isValid(height)) return { success: false };

  // RLS restricts the update to rows owned by the current user.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("presentations")
    .update({ canvas_width: width, canvas_height: height })
    .eq("id", presId);

  if (error) {
    console.error("Failed to resize presentation canvas", error);
    return { success: false };
  }
  return { success: true };
}
