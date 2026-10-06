import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateProjectForm } from "@/features/projects/create-project-form";
import { getProjectsForWorkspace } from "@/features/projects/queries";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";
import { Badge } from "@/components/ui/badge";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const projects = await getProjectsForWorkspace(workspace.id);

  return (
    <div className="max-w-6xl">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Workspace / Overview</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {workspace.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
          Projects in this workspace.
        </p>
      </header>

      <div className="mt-8">
        <section aria-labelledby="projects-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Projects</p>
              <h2 id="projects-heading" className="mt-2 text-xl font-medium">Project space</h2>
            </div>
            <span className="text-sm text-text-tertiary">
              {projects.length} total
            </span>
          </div>

          {projects.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/w/${workspace.slug}/projects/${project.id}`}
                  className="block px-5 py-5 transition-colors duration-[var(--motion-nav)] hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] sm:px-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground">
                        {project.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">
                        {project.description || "No description provided."}
                      </p>
                    </div>
                    <Badge variant="outline" className={project.status === "active" ? "border-success/40 text-success" : "text-text-secondary"}>{project.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12">
              <p className="font-medium text-foreground">No projects yet</p>
              <p className="mt-2 text-sm text-text-secondary">
                Create a project to organize missions in this workspace.
              </p>
            </div>
          )}
        </section>

        <details className="group mt-6 rounded-xl border border-border bg-surface p-5">
          <summary className="cursor-pointer rounded-md text-sm font-medium text-primary marker:text-primary focus-visible:outline-2 focus-visible:outline-ring">Create project</summary>
          <div className="mt-5 max-w-xl border-t border-border pt-5">
            <p className="mb-5 text-sm text-text-secondary">Projects contain the missions that make up the operating work.</p>
            <CreateProjectForm workspaceSlug={workspace.slug} />
          </div>
        </details>
      </div>
    </div>
  );
}
