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
      <div className="border-b border-neutral-800 pb-7">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Workspace
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          {workspace.name}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          Shared operating environment for projects, missions, and future AI systems.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                Projects
              </p>
              <h3 className="mt-2 text-xl font-medium">Active project space</h3>
            </div>
            <span className="text-sm text-neutral-500">
              {projects.length} total
            </span>
          </div>

          {projects.length > 0 ? (
            <div className="divide-y divide-neutral-800 border-y border-neutral-800">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/w/${workspace.slug}/projects/${project.id}`}
                  className="block px-1 py-5 transition hover:bg-neutral-900/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="font-medium text-neutral-100">
                        {project.name}
                      </h4>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
                        {project.description || "No description provided."}
                      </p>
                    </div>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border-y border-neutral-800 py-10">
              <p className="font-medium text-neutral-300">No projects yet</p>
              <p className="mt-2 text-sm text-neutral-500">
                Create the first project to establish the next layer of the RAIOC hierarchy.
              </p>
            </div>
          )}
        </section>

        <aside className="border-l border-neutral-800 pl-8">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            New Project
          </p>
          <h3 className="mt-2 text-lg font-medium">Create project</h3>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-500">
            Projects contain the missions that make up the operating work.
          </p>
          <CreateProjectForm workspaceSlug={workspace.slug} />
        </aside>
      </div>
    </div>
  );
}
