import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

export async function POST(req: NextRequest) {
  const { presentationId, frames, previewImage } = await req.json();

  if (!presentationId || !frames) {
    return NextResponse.json(
      { error: "presentationId and frames are required" },
      { status: 400 },
    );
  }

  // Authenticated client — RLS ensures only the owner can update this row.
  const supabase = await createSupabaseServerClient();

  try {
    // Defense-in-depth guard against the empty-state-overwrite bug: refuse to
    // replace an existing multi-frame presentation with a single empty frame.
    // This can only be a stray save fired before the client finished loading.
    const isEmptyFrame = (f: any) => !f?.sprites || f.sprites.length === 0;
    const incomingIsEmpty =
      Array.isArray(frames) &&
      frames.length <= 1 &&
      frames.every(isEmptyFrame);

    if (incomingIsEmpty) {
      const { data: existing } = await supabase
        .from("presentations")
        .select("frames")
        .eq("id", presentationId)
        .single();
      const existingFrames = existing?.frames;
      const existingHasContent =
        Array.isArray(existingFrames) &&
        (existingFrames.length > 1 ||
          existingFrames.some((f: any) => !isEmptyFrame(f)));

      if (existingHasContent) {
        console.warn(
          `Blocked empty-frame overwrite for presentation ${presentationId} ` +
            `(existing frames: ${existingFrames.length})`,
        );
        return NextResponse.json(
          { error: "Refusing to overwrite existing frames with empty state" },
          { status: 409 },
        );
      }
    }

    const update: Record<string, any> = { frames };
    if (previewImage) update.preview_image = previewImage;

    const { error } = await supabase
      .from("presentations")
      .update(update)
      .eq("id", presentationId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save presentation", error);
    return NextResponse.json(
      { error: "Failed to save presentation" },
      { status: 500 },
    );
  }
}
