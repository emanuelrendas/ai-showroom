"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, LoaderCircle } from "lucide-react";
import {
  generateMissionAiDraftAction,
  type MissionAiDraftActionState,
} from "@/features/ai/actions";
import { TASK_TYPES } from "@/features/ai/inference-wrapper";
import {
  PROMPT_CONTEXT_MAX_LENGTH,
  PROMPT_CONTEXT_MIN_LENGTH,
} from "@/features/ai/draft-presentation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type GenerateDraftFormProps = {
  workspaceSlug: string;
  projectId: string;
  missionId: string;
  hasDrafts?: boolean;
};

const initialState: MissionAiDraftActionState = { error: null };

const TASK_TYPE_LABELS: Record<(typeof TASK_TYPES)[number], string> = {
  summarize: "Summarize",
  classify: "Classify",
  draft_response: "Draft a response",
};

export function GenerateDraftForm({
  workspaceSlug,
  projectId,
  missionId,
  hasDrafts = false,
}: GenerateDraftFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // Keep the form mounted and preserve the user's chosen working state when
  // refreshed server props deliver a result. Never collapse a focused input.
  const [expanded, setExpanded] = useState(!hasDrafts);
  useEffect(() => {
    const form = formRef.current;
    // React resets action forms even when the result contains a recoverable
    // error. Keep the source context and task available for review or retry.
    const preserveContext = (event: Event) => event.preventDefault();
    form?.addEventListener("reset", preserveContext);
    return () => form?.removeEventListener("reset", preserveContext);
  }, []);
  const generateDraft = generateMissionAiDraftAction.bind(
    null,
    workspaceSlug,
    projectId,
    missionId,
  );
  const [state, formAction, isPending] = useActionState(
    generateDraft,
    initialState,
  );

  return (
    <form
      action={formAction}
      ref={formRef}
      aria-label="Generate an AI draft for this mission"
      aria-busy={isPending}
      className="ai-composer space-y-4"
    >
      {hasDrafts && <button type="button" aria-expanded={expanded} aria-controls="draft-composer-controls" disabled={isPending} onClick={() => setExpanded(!expanded)} className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-border-strong py-3 text-left text-sm font-medium disabled:opacity-60">
        Generate another draft<ChevronDown aria-hidden="true" size={16} className={expanded ? "rotate-180" : undefined} />
      </button>}
      <div id="draft-composer-controls" hidden={hasDrafts && !expanded} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base text-foreground">What should this draft accomplish?</p>
        <p className="text-[13px] text-text-secondary">Routing: Auto</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-task-type">Task</Label>
        <select
          id="draft-task-type"
          name="task_type"
          defaultValue="summarize"
          disabled={isPending}
          className="control-select max-w-64 disabled:opacity-60"
        >
          {TASK_TYPES.map((taskType) => (
            <option key={taskType} value={taskType}>
              {TASK_TYPE_LABELS[taskType]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-prompt-context">Prompt / Context</Label>
        <Textarea
          id="draft-prompt-context"
          name="prompt_context"
          readOnly={isPending}
          aria-describedby="draft-context-help"
          placeholder="Add the source material. Describe the outcome you need."
          minLength={PROMPT_CONTEXT_MIN_LENGTH}
          maxLength={PROMPT_CONTEXT_MAX_LENGTH}
          rows={8}
          className="composer-prompt resize-y focus-visible:ring-0"
          required
        />
        <p id="draft-context-help" className="text-[13px] leading-5 text-text-secondary">Use the mission brief as context. Include the details AI needs to work from.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-48 text-[13px] leading-5 text-text-secondary">AI output remains a draft requiring human review.</p>
        <Button type="submit" disabled={isPending} className="min-w-44 motion-reduce:active:translate-y-0">
          {isPending ? "Generating…" : "Generate AI draft"}{!isPending && <ArrowUpRight aria-hidden="true" />}
        </Button>
      </div>
      </div>

      <div aria-live="polite" aria-atomic="true" role="status" className="min-h-5 space-y-1 break-words text-sm text-text-secondary">
        {isPending ? <span className="flex items-center gap-2"><LoaderCircle aria-hidden="true" size={14} className="motion-safe:animate-spin" />Generating…</span> : (
          <>
            {state.route && (
              <div className="state-entry border-l-2 border-primary/50 pl-3 text-[13px] leading-6">
                <p className="font-medium text-foreground">{state.route.mode} · {state.route.modelLabel}</p>
                <p>{state.route.reason}</p>
              </div>
            )}
            <p key={state.error || state.draftId || "ready"} className={state.error ? "state-entry rounded-lg border border-error/20 bg-error/5 p-3 text-error" : state.draftId ? "state-entry text-success" : "text-[13px]"}>
              {state.error || (state.draftId ? "Draft saved for human review." : "Ready to generate.")}
            </p>
            {state.failureCategory === "resolution" && <p>Generation did not start.</p>}
          </>
        )}
      </div>

    </form>
  );
}
