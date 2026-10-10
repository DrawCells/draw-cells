import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSessionUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { s3, S3_BUCKET } from "../../../lib/s3";
import {
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  FeedbackType,
} from "../../../src/Feedback/types";

// Per-user cap, counted from the table itself so it holds across instances.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clip(value: unknown, max: number): string | null {
  return typeof value === "string" && value ? value.slice(0, max) : null;
}

// Optional ping so new feedback isn't only visible when someone opens the
// admin page. FEEDBACK_WEBHOOK_URL may be a Slack or Discord incoming webhook:
// Slack reads `text`, Discord reads `content`, each ignores the other.
async function notify(type: FeedbackType, email: string | null, message: string) {
  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (!webhook) return;

  const adminUrl = process.env.APP_URL
    ? `${process.env.APP_URL.replace(/\/$/, "")}/admin/feedback`
    : "/admin/feedback";
  const preview = message.length > 300 ? `${message.slice(0, 300)}…` : message;
  const text = `New ${FEEDBACK_TYPE_LABELS[type].toLowerCase()} from ${
    email ?? "unknown user"
  }:\n${preview}\n${adminUrl}`;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
    });
  } catch (err) {
    // The feedback is already saved; a failed ping must not fail the request.
    console.error("Feedback webhook failed", err);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body?.type as FeedbackType;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!FEEDBACK_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!message || message.length > FEEDBACK_MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Message must be 1–${FEEDBACK_MESSAGE_MAX} characters` },
      { status: 400 },
    );
  }

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.uid)
    .gte("created_at", since);
  if (countError) {
    console.error(countError);
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: "You've sent a lot of feedback recently. Please try again later." },
      { status: 429 },
    );
  }

  const id = crypto.randomUUID();

  // Screenshot arrives as a JPEG data URL. It's best-effort: a bad or failed
  // upload drops the screenshot, not the report.
  let screenshotKey: string | null = null;
  const screenshot = body?.screenshot;
  if (typeof screenshot === "string") {
    const match = /^data:image\/jpeg;base64,(.+)$/.exec(screenshot);
    const bytes = match ? Buffer.from(match[1], "base64") : null;
    if (bytes && bytes.length > 0 && bytes.length <= MAX_SCREENSHOT_BYTES) {
      const key = `feedback/${id}.jpg`;
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: bytes,
            ContentType: "image/jpeg",
          }),
        );
        screenshotKey = key;
      } catch (err) {
        console.error("Feedback screenshot upload failed", err);
      }
    }
  }

  const presentationId =
    typeof body?.presentationId === "string" && UUID_RE.test(body.presentationId)
      ? body.presentationId
      : null;

  const { error } = await supabaseAdmin.from("feedback").insert({
    id,
    user_id: user.uid,
    email: user.email,
    type,
    message,
    page_url: clip(body?.pageUrl, 2000),
    presentation_id: presentationId,
    user_agent: clip(req.headers.get("user-agent"), 500),
    viewport: clip(body?.viewport, 50),
    screenshot_key: screenshotKey,
  });
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }

  await notify(type, user.email, message);

  return NextResponse.json({ id });
}
