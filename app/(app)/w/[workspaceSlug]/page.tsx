import Link from "next/link";
import { ArrowRight, FolderClosed, Layers2 } from "lucide-react";
import { notFound } from "next/navigation";
import { CreateProjectForm } from "@/features/projects/create-project-form";
import { getProjectsForWorkspace } from "@/features/projects/queries";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";
import { StatusBadge } from "@/components/ui/status-badge";
import { CreateDisclosure } from "@/components/ui/create-disclosure";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const projects = await getProjectsForWorkspace(workspace.id);
  return <div className="collection-page workspace-overview">
    <header className="collection-header studio-atmosphere">
      <nav aria-label="Breadcrumb" className="mb-8 text-[13px] text-text-secondary"><Link href="/app" className="hover:text-foreground">Workspaces</Link><span aria-hidden="true" className="mx-2">/</span><span aria-current="page">{workspace.name}</span></nav>
      <div className="workspace-identity"><span aria-hidden="true" className="workspace-emblem"><Layers2 size={24} /></span><div className="min-w-0"><p className="eyebrow text-primary">Workspace</p>
      <h1 className="collection-heading mt-2">{workspace.name}</h1></div></div>
      <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary">A shared space for focused work. Open a project to continue into its missions.</p>
    </header>
    <div className="collection-body page-entry">
      <div className="collection-title"><h2 id="projects-heading" className="text-base font-semibold">Projects <span className="ml-2 text-[13px] font-normal text-text-secondary">{projects.length}</span></h2></div>
      <CreateDisclosure label="Create project"><p className="mb-5 text-sm text-text-secondary">Define a focused space for related missions.</p><CreateProjectForm workspaceSlug={workspace.slug} /></CreateDisclosure>
      <section aria-labelledby="projects-heading">
        {projects.length > 0 ? <ul aria-label="Projects" className="operating-list project-collection">
          {projects.map((project, index) => <li key={project.id}>
            <Link href={`/w/${workspace.slug}/projects/${project.id}`} className="operating-row project-row group flex-wrap sm:flex-nowrap">
              <span aria-hidden="true" className="project-emblem"><FolderClosed size={22} /><span>{String(index + 1).padStart(2, "0")}</span></span>
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto"><h3 className="record-title">{project.name}</h3><p className="mt-3 max-w-xl line-clamp-2 text-[15px] leading-6 text-text-secondary">{project.description || "No description provided."}</p></div>
              <div className="flex items-center gap-5 sm:flex-col sm:items-end"><StatusBadge status={project.status} /><span className="flex items-center gap-2 text-[13px] text-text-secondary group-hover:text-foreground">Open project<ArrowRight aria-hidden="true" size={16} className="row-arrow" /></span></div>
            </Link>
          </li>)}
        </ul> : <div className="empty-surface"><h3 className="text-xl font-semibold">No projects yet</h3><p className="mt-3 max-w-lg text-base leading-7 text-text-secondary">Create a project to organize missions in this workspace.</p></div>}
      </section>
    </div>
  </div>;
}
