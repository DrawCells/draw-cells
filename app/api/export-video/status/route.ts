import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("export_jobs")
    .select("status, video_url, error")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Preserve the RTDB-era response shape (videoUrl, not video_url).
  return NextResponse.json({
    status: data.status,
    videoUrl: data.video_url ?? undefined,
    error: data.error ?? undefined,
  });
}
