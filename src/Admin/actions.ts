"use server";

import { getAdminUser } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { FEEDBACK_STATUSES, FeedbackStatus } from "../Feedback/types";

// The feedback table is RLS deny-all, so these go through the secret-key
// client — the admin check here is the only thing guarding them.
export async function updateFeedback(
  id: string,
  changes: { status?: FeedbackStatus; adminNotes?: string },
) {
  const admin = await getAdminUser();
  if (!admin) return { success: false };

  const update: Record<string, string | null> = {};
  if (changes.status !== undefined) {
    if (!FEEDBACK_STATUSES.includes(changes.status)) return { success: false };
    update.status = changes.status;
  }
  if (changes.adminNotes !== undefined) {
    update.admin_notes = changes.adminNotes.trim() || null;
  }
  if (Object.keys(update).length === 0) return { success: true };

  const { error } = await supabaseAdmin.from("feedback").update(update).eq("id", id);
  if (error) {
    console.error("Failed to update feedback", error);
    return { success: false };
  }
  return { success: true };
}
