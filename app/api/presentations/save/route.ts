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
    // Defense-in-depth guard against the empty-state-overwrite bug: refuse to
    // replace an existing multi-frame presentation with a single empty frame.
    // This can only be a stray save fired before the client finished loading.
    const isEmptyFrame = (f: any) =>
      !f?.sprites || f.sprites.length === 0;
    const incomingIsEmpty =
      Array.isArray(frames) &&
      frames.length <= 1 &&
      frames.every(isEmptyFrame);

    if (incomingIsEmpty) {
      const existingSnap = await db
        .ref(`presentations/${presentationId}/frames`)
        .get();
      const existing = existingSnap.val();
      const existingHasContent =
        Array.isArray(existing) &&
        (existing.length > 1 || existing.some((f: any) => !isEmptyFrame(f)));

      if (existingHasContent) {
        console.warn(
          `Blocked empty-frame overwrite for presentation ${presentationId} ` +
            `(existing frames: ${existing.length})`,
        );
        return NextResponse.json(
          { error: "Refusing to overwrite existing frames with empty state" },
          { status: 409 },
        );
      }
    }

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
