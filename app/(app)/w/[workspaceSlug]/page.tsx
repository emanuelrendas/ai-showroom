import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
  return <div className="max-w-6xl">
    <header className="border-b border-border pb-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-secondary"><Link href="/app" className="hover:text-foreground">Workspaces</Link><span aria-hidden="true" className="mx-2">/</span><span aria-current="page">{workspace.name}</span></nav>
      <p className="eyebrow text-primary">Workspace</p>
      <h1 className="mt-2 break-words text-[32px] font-semibold tracking-tight">{workspace.name}</h1>
      <p className="mt-3 text-sm text-text-secondary">Your projects, organized for focused work.</p>
    </header>
    <div className="page-entry pt-8">
      <section aria-labelledby="projects-heading">
        <div className="mb-4 flex items-center justify-between gap-4"><h2 id="projects-heading" className="text-lg font-medium">Projects</h2><span className="text-xs text-text-secondary">{projects.length} {projects.length === 1 ? "project" : "projects"}</span></div>
        {projects.length > 0 ? <ul aria-label="Projects" className="operating-list">
          {projects.map((project) => <li key={project.id}>
            <Link href={`/w/${workspace.slug}/projects/${project.id}`} className="operating-row group">
              <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-medium">{project.name}</h3><p className="mt-1.5 line-clamp-2 text-sm leading-6 text-text-secondary">{project.description || "No description provided."}</p></div>
              <StatusBadge status={project.status} /><ArrowRight aria-hidden="true" size={16} className="row-arrow" />
            </Link>
          </li>)}
        </ul> : <div className="empty-surface"><h3 className="text-sm font-medium">No projects yet</h3><p className="mt-2 text-sm text-text-secondary">Create a project to organize missions in this workspace.</p></div>}
      </section>
      <CreateDisclosure label="Create project"><p className="mb-5 text-sm text-text-secondary">Define a focused space for related missions.</p><CreateProjectForm workspaceSlug={workspace.slug} /></CreateDisclosure>
    </div>
  </div>;
}
