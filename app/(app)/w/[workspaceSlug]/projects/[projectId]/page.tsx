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
      <header className="border-b border-border pb-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
          <Link href={`/w/${workspace.slug}`} className="rounded-sm text-text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">{workspace.name}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{project.name}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Project</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {project.name}
            </h1>
          </div>
          <Badge variant="outline" className={project.status === "active" ? "border-success/40 text-success" : "text-text-secondary"}>{project.status}</Badge>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">
          {project.description || "No description provided."}
        </p>
      </header>

      <div className="mt-8">
        <section aria-labelledby="missions-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Missions</p>
              <h2 id="missions-heading" className="mt-2 text-xl font-medium">Operational work</h2>
            </div>
            <span className="text-sm text-text-tertiary">
              {missions.length} total
            </span>
          </div>

          {missions.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {missions.map((mission) => (
                <Link
                  key={mission.id}
                  href={`/w/${workspace.slug}/projects/${project.id}/missions/${mission.id}`}
                  className="block px-5 py-5 transition-colors duration-[var(--motion-nav)] hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground">
                        {mission.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">
                        {mission.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge variant="outline" className={mission.priority === "critical" || mission.priority === "high" ? "border-warning/40 text-warning" : "text-text-secondary"}>Priority: {mission.priority}</Badge>
                      <Badge variant="outline" className={mission.status === "blocked" ? "border-error/40 text-error" : mission.status === "done" ? "border-success/40 text-success" : mission.status === "in_progress" ? "border-primary/40 text-primary" : "text-text-secondary"}>Status: {mission.status.replaceAll("_", " ")}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12">
              <p className="font-medium text-foreground">No missions yet</p>
              <p className="mt-2 text-sm text-text-secondary">
                Create the first mission to begin operational work inside this project.
              </p>
            </div>
          )}
        </section>

        <details className="mt-6 rounded-xl border border-border bg-surface p-5">
          <summary className="cursor-pointer rounded-md text-sm font-medium text-primary marker:text-primary focus-visible:outline-2 focus-visible:outline-ring">Create mission</summary>
          <div className="mt-5 max-w-xl border-t border-border pt-5">
            <p className="mb-5 text-sm text-text-secondary">Missions are the executable units of work inside a project.</p>
            <CreateMissionForm workspaceSlug={workspace.slug} projectId={project.id} />
          </div>
        </details>
      </div>
    </div>
  );
}
