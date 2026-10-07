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

  return <div>
    <header className="pb-7">
      <nav aria-label="Mission hierarchy" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
        <Link href={`/w/${workspace.slug}`} className="hover:text-foreground">{workspace.name}</Link><span aria-hidden="true">/</span>
        <Link href={`/w/${workspace.slug}/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link><span aria-hidden="true">/</span>
        <span aria-current="page" className="break-words text-foreground">{mission.title}</span>
      </nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><p className="eyebrow text-primary">Mission workspace</p><h1 className="mt-2 break-words text-[32px] font-semibold leading-tight tracking-tight">{mission.title}</h1></div>
        <div className="flex items-center gap-4 pb-1" aria-label="Mission state"><PriorityLabel priority={mission.priority} /><StatusBadge status={mission.status} /></div>
      </div>
    </header>

    <div role="group" aria-label="Mission working modes" className="mission-modes mb-4 grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface p-1">
      {modes.map((workingMode, index) => <button key={workingMode} ref={(node) => { modeRefs.current[index] = node; }} type="button" aria-pressed={mode === workingMode} aria-controls={`mission-${workingMode}`} onClick={() => setMode(workingMode)} onKeyDown={(event) => onModeKeyDown(event, index)} className="mission-mode min-h-11 rounded-md px-2 text-sm font-medium">
        {workingMode === "ai" ? "AI" : workingMode === "context" ? "Context" : "Activity"}
      </button>)}
    </div>

    <div className="mission-surface page-entry">
      <section id="mission-context" aria-label="Mission Context" data-active={mode === "context"} className="mission-zone mission-context">
        <div className="zone-heading"><p className="eyebrow text-text-secondary">Context</p><h2 className="mt-1 text-base font-medium">Mission Context</h2></div>
        <div className="mt-6"><h3 className="text-xs font-medium text-text-secondary">Objective / Brief</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{mission.description || "No description provided."}</p></div>
        <dl className="mt-8 space-y-5 border-t border-border pt-5 text-xs">
          <div><dt className="text-text-secondary">Workspace</dt><dd className="mt-1.5 break-words">{workspace.name}</dd></div>
          <div><dt className="text-text-secondary">Project</dt><dd className="mt-1.5 break-words">{project.name}</dd></div>
          <div><dt className="text-text-secondary">Created</dt><dd className="mt-1.5 leading-5">{formatDraftTimestamp(mission.created_at)}</dd></div>
          <div><dt className="text-text-secondary">Updated</dt><dd className="mt-1.5 leading-5">{formatDraftTimestamp(mission.updated_at)}</dd></div>
        </dl>
      </section>

      <section id="mission-ai" aria-label="AI Workspace" data-active={mode === "ai"} className="mission-zone mission-ai">
        <div className="zone-heading mb-6"><p className="eyebrow text-primary">Create & review</p><h2 className="mt-1 text-xl font-semibold">AI Workspace</h2><p className="mt-2 text-xs text-text-secondary">Human review required</p></div>
        <GenerateDraftForm {...ids} />
        <div className="mt-8 space-y-4" aria-label="Mission AI drafts">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3"><h3 className="text-sm font-medium">Drafts & review</h3><span className="text-xs text-text-secondary">{drafts.length} {drafts.length === 1 ? "draft" : "drafts"}</span></div>
          {drafts.length === 0 ? <div className="rounded-lg border border-dashed border-border-strong p-5"><p className="text-sm text-text-secondary">No AI drafts yet for this mission.</p><p className="mt-2 text-xs leading-5 text-text-secondary">Add context above and generate a draft to review.</p></div> : <ul className="space-y-4">
            {drafts.map((draft) => <DraftEntry key={draft.id} isNew={!initialDraftIds.has(draft.id)} reducedMotion={reducedMotion}><MissionAiDraftCard draft={draft} {...ids} /></DraftEntry>)}
          </ul>}
        </div>
      </section>

      <section id="mission-activity" aria-label="Activity and review history" data-active={mode === "activity"} className="mission-zone mission-activity">
        <div className="zone-heading"><p className="eyebrow text-text-secondary">Record</p><h2 className="mt-1 text-base font-medium">Activity</h2><p className="mt-2 text-xs text-text-secondary">Drafts and review history</p></div>
        {drafts.length === 0 ? <p className="mt-6 text-sm leading-6 text-text-secondary">No draft activity yet.</p> : <ol className="mt-6 space-y-6">
          {drafts.map((draft) => {
            const status = getDraftStatusPresentation(draft.status);
            return <DraftEntry key={draft.id} isNew={!initialDraftIds.has(draft.id)} reducedMotion={reducedMotion} subtle><div className="activity-record relative border-l border-border-strong pl-4">
              <p className="break-words text-sm font-medium leading-6">{draft.summary}</p>
              <p className="mt-2 text-xs leading-5 text-text-secondary">Draft created {formatDraftTimestamp(draft.created_at)}</p>
              <p className={`mt-3 text-xs ${draft.status === "applied" ? "text-success" : draft.status === "pending_review" ? "text-warning" : "text-text-secondary"}`}>{status.label}</p>
              {draft.status === "applied" && draft.approved_at && <p className="mt-1 text-xs leading-5 text-text-secondary">Approved {formatDraftTimestamp(draft.approved_at)}</p>}
              {draft.status === "dismissed" && <p className="mt-1 text-xs leading-5 text-text-secondary">Last updated {formatDraftTimestamp(draft.updated_at)}</p>}
            </div></DraftEntry>;
          })}
        </ol>}
      </section>
    </div>
  </div>;
}
