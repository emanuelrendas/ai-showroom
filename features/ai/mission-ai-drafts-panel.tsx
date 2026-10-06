"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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

type WorkingMode = "context" | "ai" | "activity";

export function MissionAiDraftsPanel({ workspace, project, mission, drafts }: MissionAiDraftsPanelProps) {
  const [mode, setMode] = useState<WorkingMode>("ai");
  const ids = { workspaceSlug: workspace.slug, projectId: project.id, missionId: mission.id };

  return (
    <div className="space-y-7">
      <header className="border-b border-border pb-7">
        <nav aria-label="Mission hierarchy" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
          <Link href={`/w/${workspace.slug}`} className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{workspace.name}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/w/${workspace.slug}/projects/${project.id}`} className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{project.name}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-foreground">{mission.title}</span>
        </nav>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Mission workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{mission.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Mission state">
            <Badge variant="outline">Priority: {mission.priority}</Badge>
            <Badge variant="secondary">Status: {mission.status}</Badge>
          </div>
        </div>
      </header>

      <div role="group" aria-label="Mission working modes" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1 md:hidden">
        {(["context", "ai", "activity"] as const).map((workingMode) => (
          <button key={workingMode} type="button" aria-pressed={mode === workingMode}
            onClick={() => setMode(workingMode)}
            className={`min-h-11 rounded-lg px-2 text-sm font-medium transition-colors duration-[var(--motion-nav)] ${mode === workingMode ? "bg-surface-3 text-foreground" : "text-text-secondary hover:text-foreground"}`}>
            {workingMode === "ai" ? "AI" : workingMode === "context" ? "Context" : "Activity"}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-2 lg:grid-cols-[minmax(190px,0.85fr)_minmax(0,2fr)_minmax(190px,0.9fr)] lg:items-start">
        <section aria-label="Mission Context" className={`${mode === "context" ? "block" : "hidden"} min-w-0 rounded-xl border border-border bg-surface p-5 md:order-2 md:block lg:order-1`}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Mission Context</h2>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground">{mission.description || "No description provided."}</p>
          <dl className="mt-7 space-y-4 border-t border-border pt-5 text-xs">
            <div><dt className="text-text-tertiary">Workspace</dt><dd className="mt-1 text-foreground">{workspace.name}</dd></div>
            <div><dt className="text-text-tertiary">Project</dt><dd className="mt-1 text-foreground">{project.name}</dd></div>
            <div><dt className="text-text-tertiary">Created</dt><dd className="mt-1 text-foreground">{formatDraftTimestamp(mission.created_at)}</dd></div>
            <div><dt className="text-text-tertiary">Updated</dt><dd className="mt-1 text-foreground">{formatDraftTimestamp(mission.updated_at)}</dd></div>
          </dl>
        </section>

        <section aria-label="AI Workspace" className={`${mode === "ai" ? "block" : "hidden"} min-w-0 space-y-6 md:order-1 md:col-span-2 md:block lg:order-2 lg:col-span-1`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Primary workspace</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">AI Workspace</h2>
            </div>
            <span className="text-xs text-text-secondary">Human review required</span>
          </div>
          <GenerateDraftForm {...ids} />
          <div className="space-y-4" aria-label="Mission AI drafts">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Drafts for review</h3>
            {drafts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-text-secondary">No AI drafts yet for this mission.</p>
            ) : (
              <ul className="space-y-4">
                {drafts.map((draft) => <li key={draft.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[220ms]"><MissionAiDraftCard draft={draft} {...ids} /></li>)}
              </ul>
            )}
          </div>
        </section>

        <section aria-label="Activity and review history" className={`${mode === "activity" ? "block" : "hidden"} min-w-0 rounded-xl border border-border bg-surface p-5 md:order-3 md:block lg:order-3`}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Activity / Review history</h2>
          {drafts.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-text-secondary">No draft activity yet.</p>
          ) : (
            <ol className="mt-5 space-y-5">
              {drafts.map((draft) => {
                const status = getDraftStatusPresentation(draft.status);
                return <li key={draft.id} className="border-l-2 border-border pl-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[180ms]">
                  <p className="break-words text-sm font-medium text-foreground">{draft.summary}</p>
                  <p className="mt-1 text-xs text-text-secondary">Draft created {formatDraftTimestamp(draft.created_at)}</p>
                  <p className="mt-2 text-xs text-foreground">{status.label}</p>
                  {draft.status === "applied" && draft.approved_at && <p className="mt-1 text-xs text-text-secondary">Approved {formatDraftTimestamp(draft.approved_at)}</p>}
                  {draft.status === "dismissed" && <p className="mt-1 text-xs text-text-secondary">Last updated {formatDraftTimestamp(draft.updated_at)}</p>}
                </li>;
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
