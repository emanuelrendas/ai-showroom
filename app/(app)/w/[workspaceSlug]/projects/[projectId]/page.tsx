import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge, PriorityLabel } from "@/components/ui/status-badge";
import { CreateDisclosure } from "@/components/ui/create-disclosure";
import { CreateMissionForm } from "@/features/missions/create-mission-form";
import { getMissionsForProject } from "@/features/missions/queries";
import { getProjectById } from "@/features/projects/queries";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";

export default async function ProjectPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const project = await getProjectById(projectId);
  if (!workspace || !project || project.workspace_id !== workspace.id) notFound();
  const missions = await getMissionsForProject(project.id);
  return <div className="max-w-6xl">
    <header className="border-b border-border pb-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-text-secondary"><Link href={`/w/${workspace.slug}`} className="hover:text-foreground">{workspace.name}</Link><span aria-hidden="true">/</span><span aria-current="page" className="min-w-0 break-words">{project.name}</span></nav>
      <p className="eyebrow text-primary">Project</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4"><h1 className="min-w-0 max-w-full break-words text-[32px] font-semibold tracking-tight">{project.name}</h1><StatusBadge status={project.status} /></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">{project.description || "No description provided."}</p>
    </header>
    <div key={project.id} className="page-entry pt-8">
      <section aria-labelledby="missions-heading">
        <div className="mb-4 flex items-center justify-between gap-4"><h2 id="missions-heading" className="text-lg font-medium">Missions</h2><span className="text-xs text-text-secondary">{missions.length} {missions.length === 1 ? "mission" : "missions"}</span></div>
        {missions.length > 0 ? <ul aria-label="Missions" className="operating-list">
          {missions.map((mission) => <li key={mission.id}>
            <Link href={`/w/${workspace.slug}/projects/${project.id}/missions/${mission.id}`} className="operating-row group flex-wrap sm:flex-nowrap">
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto"><h3 className="break-words text-sm font-medium">{mission.title}</h3><p className="mt-1.5 line-clamp-2 text-sm leading-6 text-text-secondary">{mission.description || "No description provided."}</p></div>
              <div className="flex shrink-0 items-center gap-4 sm:w-56 sm:justify-between"><PriorityLabel priority={mission.priority} /><StatusBadge status={mission.status} /></div>
              <ArrowRight aria-hidden="true" size={16} className="row-arrow ml-auto" />
            </Link>
          </li>)}
        </ul> : <div className="empty-surface"><h3 className="text-sm font-medium">No missions yet</h3><p className="mt-2 text-sm text-text-secondary">Create the first mission to begin operational work inside this project.</p></div>}
      </section>
      <CreateDisclosure label="Create mission"><p className="mb-5 text-sm text-text-secondary">Set the objective and priority for the next piece of work.</p><CreateMissionForm workspaceSlug={workspace.slug} projectId={project.id} /></CreateDisclosure>
    </div>
  </div>;
}
