"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
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
}: GenerateDraftFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
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
      className="ai-composer space-y-5 rounded-xl border border-border-strong bg-surface-raised p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          Generate AI draft
        </h3>
        <p className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-secondary">Routing: Auto</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-task-type">Task</Label>
        <select
          id="draft-task-type"
          name="task_type"
          defaultValue="summarize"
          disabled={isPending}
          className="control-select disabled:opacity-60"
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
          placeholder="Paste or describe the mission context the model should work from."
          minLength={PROMPT_CONTEXT_MIN_LENGTH}
          maxLength={PROMPT_CONTEXT_MAX_LENGTH}
          rows={8}
          className="min-h-52 resize-y bg-background p-4 text-sm leading-7 focus-visible:ring-2 focus-visible:ring-primary/25"
          required
        />
        <p id="draft-context-help" className="text-xs leading-5 text-text-secondary">Provide the source material and the outcome you need.</p>
      </div>

      <div aria-live="polite" aria-atomic="true" role="status" className="min-h-5 space-y-1 break-words text-sm text-text-secondary">
        {isPending ? <span className="flex items-center gap-2"><LoaderCircle aria-hidden="true" size={14} className="motion-safe:animate-spin" />Generating…</span> : (
          <>
            {state.route && (
              <div className="state-entry rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs leading-5">
                <p className="font-medium text-foreground">{state.route.mode} · {state.route.modelLabel}</p>
                <p>{state.route.reason}</p>
              </div>
            )}
            <p key={state.error || state.draftId || "ready"} className={state.error ? "state-entry rounded-lg border border-error/20 bg-error/5 p-3 text-error" : state.draftId ? "state-entry text-success" : "text-xs"}>
              {state.error || (state.draftId ? "Draft saved for human review." : "Ready to generate.")}
            </p>
            {state.failureCategory === "resolution" && <p>Generation did not start.</p>}
          </>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Button type="submit" disabled={isPending} className="w-full motion-reduce:active:translate-y-0">
          {isPending ? "Generating…" : "Generate AI draft"}{!isPending && <ArrowUpRight aria-hidden="true" />}
        </Button>
        <p className="text-center text-xs leading-5 text-text-secondary">AI output remains a draft requiring human review.</p>
      </div>
    </form>
  );
}
