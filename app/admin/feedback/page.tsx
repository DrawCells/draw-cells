import { redirect } from "next/navigation";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSessionUser, getAdminUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { s3, S3_BUCKET } from "../../../lib/s3";
import AdminNav from "../../../src/Admin/components/AdminNav";
import FeedbackList from "../../../src/Admin/components/FeedbackList";
import { FeedbackItem } from "../../../src/Feedback/types";

// Plenty for a triage list; older items can be fetched in pages if this grows.
const LIMIT = 500;
const SCREENSHOT_URL_TTL = 60 * 60; // seconds

export default async function AdminFeedbackPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const adminUser = await getAdminUser();
  // Signed in but not an admin: don't reveal the page exists.
  if (!adminUser) redirect("/");

  const { data, error } = await supabaseAdmin
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw error;

  const items: FeedbackItem[] = await Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      type: row.type,
      message: row.message,
      status: row.status,
      adminNotes: row.admin_notes,
      pageUrl: row.page_url,
      presentationId: row.presentation_id,
      userAgent: row.user_agent,
      viewport: row.viewport,
      screenshotUrl: row.screenshot_key
        ? await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: S3_BUCKET, Key: row.screenshot_key }),
            { expiresIn: SCREENSHOT_URL_TTL },
          )
        : null,
      createdAt: row.created_at,
    })),
  );

  return (
    <>
      <AdminNav />
      <FeedbackList items={items} />
    </>
  );
}
