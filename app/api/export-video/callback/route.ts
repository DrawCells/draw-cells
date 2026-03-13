import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/firebaseAdmin";

// Called by Lambda when the export is complete
export async function POST(req: NextRequest) {
  try {
    const { jobId, videoUrl, error } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    if (error) {
      await db.ref(`exportJobs/${jobId}`).set({ status: "failed", error });
    } else {
      await db.ref(`exportJobs/${jobId}`).set({ status: "completed", videoUrl });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[export-callback-error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
