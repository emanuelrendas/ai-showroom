import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getProjectById } from "@/features/projects/queries";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}) {
  const { workspaceSlug, projectId } = await params;

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const project = await getProjectById(projectId);

  if (!workspace || !project || project.workspace_id !== workspace.id) {
    notFound();
  }

  return (
    <div className="max-w-5xl">
      <div className="border-b border-neutral-800 pb-7">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Project
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {project.name}
            </h2>
          </div>
          <Badge variant="outline">{project.status}</Badge>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-400">
          {project.description || "No description provided."}
        </p>
      </div>

      <section className="mt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Missions
        </p>
        <h3 className="mt-2 text-xl font-medium">No missions yet</h3>
        <p className="mt-2 text-sm text-neutral-500">
          Mission creation is the next layer of the RAIOC hierarchy.
        </p>
      </section>
    </div>
  );
}
