import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="max-w-5xl">
      <div className="border-b border-neutral-800 pb-7">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Mission
        </p>

        <div className="mt-3 flex items-start justify-between gap-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            {mission.title}
          </h2>

          <div className="flex gap-2">
            <Badge variant="outline">{mission.priority}</Badge>
            <Badge variant="outline">{mission.status}</Badge>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-400">
          {mission.description || "No description provided."}
        </p>
      </div>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="border border-neutral-800 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Workspace
          </p>
          <p className="mt-2 font-medium text-neutral-200">
            {workspace.name}
          </p>
        </div>

        <div className="border border-neutral-800 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Project
          </p>
          <p className="mt-2 font-medium text-neutral-200">
            {project.name}
          </p>
        </div>
      </section>
    </div>
  );
}
