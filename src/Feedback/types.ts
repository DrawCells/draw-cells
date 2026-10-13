// Shared by the Feedback dialog, app/api/feedback, and the admin page. Values
// must match the check constraints in supabase/migrations/*_feedback.sql.

export const FEEDBACK_TYPES = ["bug", "feature", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = ["new", "in_progress", "done", "wont_fix"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug",
  feature: "Feature request",
  other: "Other",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Done",
  wont_fix: "Won't fix",
};

export const FEEDBACK_MESSAGE_MAX = 5000;

export interface FeedbackItem {
  id: string;
  userId: string | null;
  email: string | null;
  type: FeedbackType;
  message: string;
  status: FeedbackStatus;
  adminNotes: string | null;
  pageUrl: string | null;
  presentationId: string | null;
  userAgent: string | null;
  viewport: string | null;
  screenshotUrl: string | null; // presigned, short-lived
  createdAt: string;
}
