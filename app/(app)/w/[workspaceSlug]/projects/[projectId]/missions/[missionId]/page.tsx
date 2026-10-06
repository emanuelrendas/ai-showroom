import { notFound } from "next/navigation";
import { getMissionAiDrafts } from "@/features/ai/draft-queries";
import { MissionAiDraftsPanel } from "@/features/ai/mission-ai-drafts-panel";
import { getMissionById } from "@/features/missions/queries";
import { getProjectById } from "@/features/projects/queries";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";

export default async function MissionPage({
  params,
}: {
  params: Promise<{
    workspaceSlug: string;
    projectId: string;
    missionId: string;
  }>;
}) {
  const { workspaceSlug, projectId, missionId } = await params;

  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const project = await getProjectById(projectId);

  if (!project || project.workspace_id !== workspace.id) {
    notFound();
  }

  const mission = await getMissionById(missionId);

  if (!mission || mission.project_id !== project.id) {
    notFound();
  }

  const drafts = await getMissionAiDrafts(missionId);

  return <MissionAiDraftsPanel workspace={workspace} project={project} mission={mission} drafts={drafts} />;
}
