import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSessionUser } from "../../../lib/auth";

const PAGE_SIZE = 20;
const SEARCH_LIMIT = 200;

// Maps a sprites row to the shape the sidebar expects (baseImageUrl camelCase).
// Image URLs themselves are resolved client-side via /api/storage (S3 presign).
function mapSprite(s: {
  id: string;
  name: string;
  tags: string[] | null;
  base_image_url: string;
  variants: string[] | null;
}) {
  return {
    id: s.id,
    name: s.name,
    tags: s.tags ?? [],
    baseImageUrl: s.base_image_url,
    variants: s.variants ?? [],
  };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();

  // Search mode: substring on name/tags, ranked name-first then tags (see the
  // search_sprites SQL function). Returns the full result set (capped).
  if (search) {
    const { data, error } = await supabaseAdmin.rpc("search_sprites", {
      search,
      result_limit: SEARCH_LIMIT,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ sprites: (data ?? []).map(mapSprite) });
  }

  // Pagination mode: stable order by (name, id) with offset/limit.
  const limit = Number(searchParams.get("limit")) || PAGE_SIZE;
  const offset = Number(searchParams.get("offset")) || 0;

  const { data, error } = await supabaseAdmin
    .from("sprites")
    .select("id, name, tags, base_image_url, variants")
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sprites = (data ?? []).map(mapSprite);
  return NextResponse.json({ sprites, hasEnded: sprites.length < limit });
}
