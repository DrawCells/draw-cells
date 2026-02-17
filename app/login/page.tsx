import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/auth";
import LoginPageClient from "./LoginPageClient";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return <LoginPageClient />;
}
