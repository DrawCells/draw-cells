import { redirect } from "next/navigation";
import React, { Suspense } from "react";
import { getSessionUser, isAdminEmail } from "../lib/auth";
import { createSupabaseServerClient } from "../lib/supabaseServer";
import Home from "../src/Home/components/Home";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // RLS scopes this to the current user's presentations.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("presentations")
    .select("id, title, preview_image")
    .order("created_at", { ascending: false });

  // Keep the RTDB-era shape (a map keyed by id) so Home/PresentationsList are
  // unchanged.
  const presentations = Object.fromEntries(
    (data ?? []).map((p) => [
      p.id,
      { title: p.title, previewImage: p.preview_image ?? undefined },
    ]),
  );

  return (
    <Suspense>
      <Home
        user={{ ...user, isAdmin: isAdminEmail(user.email) }}
        presentations={presentations}
      />
    </Suspense>
  );
}
