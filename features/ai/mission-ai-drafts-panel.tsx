"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { StatusBadge, PriorityLabel } from "@/components/ui/status-badge";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { formatDraftTimestamp, getDraftStatusPresentation } from "@/features/ai/draft-presentation";
import { GenerateDraftForm } from "@/features/ai/generate-draft-form";
import { MissionAiDraftCard } from "@/features/ai/mission-ai-draft-card";
import type { MissionAiDraft } from "@/features/ai/types";
import type { getMissionById } from "@/features/missions/queries";
import type { getProjectById } from "@/features/projects/queries";
import type { getWorkspaceBySlug } from "@/features/workspaces/queries";

type MissionAiDraftsPanelProps = {
  workspace: NonNullable<Awaited<ReturnType<typeof getWorkspaceBySlug>>>;
  project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>;
  mission: NonNullable<Awaited<ReturnType<typeof getMissionById>>>;
  drafts: MissionAiDraft[];
};
const modes = ["context", "ai", "activity"] as const;
type WorkingMode = (typeof modes)[number];

// Mounted records stay still across revalidation and mode changes. Only records
// arriving after this workspace opened receive the causal entry treatment.
function DraftEntry({ isNew, children, subtle = false, reducedMotion }: { isNew: boolean; children: React.ReactNode; subtle?: boolean; reducedMotion: boolean }) {
  const [revealing, setRevealing] = useState(isNew && !reducedMotion);
  // Changing the preference ends only the visual enhancement, never data work.
  if (reducedMotion && revealing) setRevealing(false);
  return <li data-reveal={revealing} onAnimationEnd={(event) => { if (event.target === event.currentTarget) setRevealing(false); }} className={revealing ? subtle ? "state-entry" : "draft-entry" : undefined}>{children}</li>;
}

export function MissionAiDraftsPanel({ workspace, project, mission, drafts }: MissionAiDraftsPanelProps) {
  const [mode, setMode] = useState<WorkingMode>("ai");
  const reducedMotion = useReducedMotion();
  const [initialDraftIds] = useState(() => new Set(drafts.map((draft) => draft.id)));
  const modeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const ids = { workspaceSlug: workspace.slug, projectId: project.id, missionId: mission.id };
  function onModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
    if (next === null) return;
    event.preventDefault();
    setMode(modes[next]);
    modeRefs.current[next]?.focus();
  }

  return <div className="mission-page">
    <header className="mission-header">
      <nav aria-label="Mission hierarchy" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-secondary">
        <Link href={`/w/${workspace.slug}`} className="hover:text-foreground">{workspace.name}</Link><span aria-hidden="true">/</span>
        <Link href={`/w/${workspace.slug}/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link><span aria-hidden="true">/</span>
        <span aria-current="page" className="break-words text-foreground">{mission.title}</span>
      </nav>
      <div className="mission-identity">
        <div className="min-w-0"><p className="eyebrow text-primary">Mission workspace</p><h1 className="collection-heading mt-2">{mission.title}</h1></div>
        <div className="flex flex-wrap items-center gap-4" aria-label="Mission state"><PriorityLabel priority={mission.priority} /><StatusBadge status={mission.status} /></div>
      </div>
    </header>

    <div role="group" aria-label="Mission working modes" className="mission-modes grid grid-cols-3">
      {modes.map((workingMode, index) => <button key={workingMode} ref={(node) => { modeRefs.current[index] = node; }} type="button" aria-pressed={mode === workingMode} aria-controls={`mission-${workingMode}`} onClick={() => setMode(workingMode)} onKeyDown={(event) => onModeKeyDown(event, index)} className="mission-mode min-h-11 rounded-md px-2 text-sm font-medium">
        {workingMode === "ai" ? "AI" : workingMode === "context" ? "Context" : "Activity"}
      </button>)}
    </div>

    <div className="mission-surface page-entry">
      <section id="mission-context" aria-label="Mission Context" data-active={mode === "context"} className="mission-zone mission-context">
        <div className="mission-zone-heading"><h2>Mission brief</h2><span className="zone-label">Context</span></div>
        <p className="mission-brief">{mission.description || "No description provided."}</p>
        <dl className="mission-facts">
          <div><dt>Project</dt><dd><Link href={`/w/${workspace.slug}/projects/${project.id}`}>{project.name}</Link></dd></div>
          <div><dt>Workspace</dt><dd><Link href={`/w/${workspace.slug}`}>{workspace.name}</Link></dd></div>
          <div className="border-t border-border pt-5"><dt>Created</dt><dd>{formatDraftTimestamp(mission.created_at)}</dd></div>
          <div><dt>Updated</dt><dd>{formatDraftTimestamp(mission.updated_at)}</dd></div>
        </dl>
      </section>

      <section id="mission-ai" aria-label="AI Workspace" data-active={mode === "ai"} className="mission-zone mission-ai">
        <div className="mission-zone-heading"><h2>{drafts.length ? "Results & review" : "AI Workspace"}</h2><span className="pt-1 text-[13px] text-text-secondary">{drafts.length ? `${drafts.length} ${drafts.length === 1 ? "draft" : "drafts"}` : "Create a draft"}</span></div>
        <div className="mission-records" aria-label="Mission AI drafts">
          {drafts.length > 0 && <ul className="space-y-6">
            {drafts.map((draft) => <DraftEntry key={draft.id} isNew={!initialDraftIds.has(draft.id)} reducedMotion={reducedMotion}><MissionAiDraftCard draft={draft} {...ids} /></DraftEntry>)}
          </ul>}
        </div>
        <GenerateDraftForm {...ids} hasDrafts={drafts.length > 0} />
        {drafts.length === 0 && <p className="mt-6 border-t border-border-strong pt-4 text-[13px] leading-6 text-text-secondary">No AI drafts yet for this mission.</p>}
      </section>

      <section id="mission-activity" aria-label="Activity and review history" data-active={mode === "activity"} className="mission-zone mission-activity">
        <div className="mission-zone-heading"><h2>Activity</h2><span className="zone-label">History</span></div>
        {drafts.length === 0 ? <div className="border-l border-border-strong pl-4"><p className="text-sm leading-6 text-text-secondary">No draft activity yet.</p><p className="mt-2 text-[13px] leading-6 text-text-secondary">Saved drafts and human decisions appear here.</p></div> : <ol className="space-y-7">
          {drafts.map((draft) => {
            const status = getDraftStatusPresentation(draft.status);
            return <DraftEntry key={draft.id} isNew={!initialDraftIds.has(draft.id)} reducedMotion={reducedMotion} subtle><div data-status={draft.status} className="activity-record relative border-l border-border-strong pl-4">
              <p className="break-words text-sm font-medium leading-6">{draft.summary}</p>
              <p className="mt-2 text-[13px] leading-6 text-text-secondary">Draft created {formatDraftTimestamp(draft.created_at)}</p>
              <p className={`mt-3 text-[13px] font-medium ${draft.status === "applied" ? "text-success" : draft.status === "pending_review" ? "text-warning" : "text-text-secondary"}`}>{status.label}</p>
              {draft.status === "applied" && draft.approved_at && <p className="mt-1 text-[13px] leading-6 text-text-secondary">Approved {formatDraftTimestamp(draft.approved_at)}</p>}
              {draft.status === "dismissed" && <p className="mt-1 text-[13px] leading-6 text-text-secondary">Last updated {formatDraftTimestamp(draft.updated_at)}</p>}
            </div></DraftEntry>;
          })}
        </ol>}
      </section>
    </div>
  </div>;
}
