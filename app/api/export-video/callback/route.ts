import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

// Called by Lambda when the export is complete
export async function POST(req: NextRequest) {
  try {
    const { jobId, videoUrl, error } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    if (error) {
      await supabaseAdmin
        .from("export_jobs")
        .upsert({ id: jobId, status: "failed", error });
    } else {
      await supabaseAdmin
        .from("export_jobs")
        .upsert({ id: jobId, status: "completed", video_url: videoUrl });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[export-callback-error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
