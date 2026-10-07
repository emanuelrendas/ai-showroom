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
  return <div className="collection-page">
    <header className="collection-header">
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-[13px] text-text-secondary"><Link href={`/w/${workspace.slug}`} className="hover:text-foreground">{workspace.name}</Link><span aria-hidden="true">/</span><span aria-current="page" className="min-w-0 break-words">{project.name}</span></nav>
      <p className="eyebrow text-primary">Project</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><h1 className="collection-heading min-w-0 max-w-full">{project.name}</h1><StatusBadge status={project.status} /></div>
      <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">{project.description || "No description provided."}</p>
    </header>
    <div key={project.id} className="collection-body page-entry">
      <div className="collection-title"><h2 id="missions-heading" className="text-base font-semibold">Missions <span className="ml-2 text-[13px] font-normal text-text-secondary">{missions.length}</span></h2></div>
      <CreateDisclosure label="Create mission"><p className="mb-5 text-sm text-text-secondary">Set the objective and priority for the next piece of work.</p><CreateMissionForm workspaceSlug={workspace.slug} projectId={project.id} /></CreateDisclosure>
      <section aria-labelledby="missions-heading">
        {missions.length > 0 ? <ul aria-label="Missions" className="operating-list">
          {missions.map((mission) => <li key={mission.id}>
            <Link href={`/w/${workspace.slug}/projects/${project.id}/missions/${mission.id}`} className="operating-row group flex-wrap sm:flex-nowrap">
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto"><h3 className="record-title">{mission.title}</h3><p className="mt-2 line-clamp-2 text-[15px] leading-6 text-text-secondary">{mission.description || "No description provided."}</p></div>
              <div className="flex shrink-0 items-center gap-4 sm:w-56 sm:justify-between"><PriorityLabel priority={mission.priority} /><StatusBadge status={mission.status} /></div>
              <ArrowRight aria-hidden="true" size={16} className="row-arrow ml-auto" />
            </Link>
          </li>)}
        </ul> : <div className="empty-surface"><h3 className="text-xl font-semibold">No missions yet</h3><p className="mt-3 text-base leading-7 text-text-secondary">Create the first mission to begin operational work inside this project.</p></div>}
      </section>
    </div>
  </div>;
}
