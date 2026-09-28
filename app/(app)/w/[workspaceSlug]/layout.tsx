import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/features/workspaces/workspace-shell";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";
import { getProjectsForWorkspace } from "@/features/projects/queries";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const projects = await getProjectsForWorkspace(workspace.id);

  return (
    <WorkspaceShell
      workspace={workspace}
      displayName={profile?.display_name ?? "Account"}
      projects={projects.map(({ id, name }) => ({ id, name }))}
    >
      {children}
    </WorkspaceShell>
  );
}
