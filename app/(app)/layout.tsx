import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userIdFromClaimsResult } from "@/features/auth/auth-state";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const result = await supabase.auth.getClaims();
  const userId = userIdFromClaimsResult(result);

  if (!userId) {
    redirect("/sign-in");
  }

  return children;
}
