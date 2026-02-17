import { redirect } from "next/navigation";
import React, { Suspense } from "react";
import { getSessionUser } from "../lib/auth";
import Home from "../src/Home/components/Home";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
