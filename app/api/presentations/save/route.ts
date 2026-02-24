import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  const { presentationId, frames, userId, previewImage } = await req.json();

  if (!presentationId || !frames) {
    return NextResponse.json(
      { error: "presentationId and frames are required" },
      { status: 400 },
    );
  }

  try {
    const updates: Record<string, any> = {
      [`presentations/${presentationId}/frames`]: frames,
    };

    if (userId && previewImage) {
      updates[`user-presentations/${userId}/${presentationId}/previewImage`] =
        previewImage;
    }

    await db.ref().update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save presentation", error);
    return NextResponse.json(
      { error: "Failed to save presentation" },
      { status: 500 },
    );
  }
}
