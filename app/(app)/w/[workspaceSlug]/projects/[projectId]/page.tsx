import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CreateMissionForm } from "@/features/missions/create-mission-form";
import { getMissionsForProject } from "@/features/missions/queries";
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

  const missions = await getMissionsForProject(project.id);

  return (
    <div className="max-w-6xl">
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

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                Missions
              </p>
              <h3 className="mt-2 text-xl font-medium">Operational work</h3>
            </div>
            <span className="text-sm text-neutral-500">
              {missions.length} total
            </span>
          </div>

          {missions.length > 0 ? (
            <div className="divide-y divide-neutral-800 border-y border-neutral-800">
              {missions.map((mission) => (
                <Link
                  key={mission.id}
                  href={`/w/${workspace.slug}/projects/${project.id}/missions/${mission.id}`}
                  className="block py-5 transition hover:bg-neutral-900/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="font-medium text-neutral-100">
                        {mission.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-neutral-500">
                        {mission.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Badge variant="outline">{mission.priority}</Badge>
                      <Badge variant="outline">{mission.status}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border-y border-neutral-800 py-10">
              <p className="font-medium text-neutral-300">No missions yet</p>
              <p className="mt-2 text-sm text-neutral-500">
                Create the first mission to begin operational work inside this project.
              </p>
            </div>
          )}
        </section>

        <aside className="border-l border-neutral-800 pl-8">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            New Mission
          </p>
          <h3 className="mt-2 text-lg font-medium">Create mission</h3>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-500">
            Missions are the executable units of work inside a project.
          </p>

          <CreateMissionForm
            workspaceSlug={workspace.slug}
            projectId={project.id}
          />
        </aside>
      </div>
    </div>
  );
}
