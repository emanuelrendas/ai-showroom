import { getWorkspaceBySlug } from "@/features/workspaces/queries";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) return null;

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        Workspace
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">
        {workspace.name}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
        Shared operating environment for projects, missions, and future AI systems.
      </p>

      <section className="mt-12 border-t border-neutral-800 pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Projects
        </p>
        <h3 className="mt-2 text-xl font-medium">No projects yet</h3>
        <p className="mt-2 text-sm text-neutral-500">
          Project creation is the next foundation step.
        </p>
      </section>
    </div>
  );
}
