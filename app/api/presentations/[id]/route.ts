import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSessionUser } from "../../../../lib/auth";

// Read a presentation by id. Uses the admin client (bypasses RLS) so shared
// "/present" links work for any signed-in viewer, not just the owner — the
// capability is knowing the (unguessable) uuid. Still requires a session, which
// matches the middleware gate on /presentations/*.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("presentations")
    .select("id, title, frames")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    title: data.title,
    frames: data.frames ?? [],
  });
}
