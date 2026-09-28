"use client";

import { useActionState } from "react";
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
      aria-label="Generate an AI draft for this mission"
      className="space-y-5 rounded-xl border border-border bg-surface-raised p-5 shadow-sm sm:p-6"
    >
      <div className="space-y-2 border-b border-border pb-5">
        <h3 className="text-base font-semibold text-foreground">
          Generate AI draft
        </h3>
        <p className="text-sm leading-6 text-text-secondary">
          AI output remains a draft requiring human review.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-task-type">Task</Label>
        <select
          id="draft-task-type"
          name="task_type"
          defaultValue="summarize"
          className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground transition-colors duration-[var(--motion-micro)] focus-visible:outline-2 focus-visible:outline-ring"
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
          placeholder="Paste or describe the mission context the model should work from."
          minLength={PROMPT_CONTEXT_MIN_LENGTH}
          maxLength={PROMPT_CONTEXT_MAX_LENGTH}
          rows={8}
          className="min-h-44 resize-y bg-surface p-4 text-sm leading-6"
          required
        />
      </div>

      <div aria-live="polite" role="status" className={`min-h-5 text-sm ${state.error && !isPending ? "text-error" : "text-text-secondary"}`}>
        {isPending ? "Generating…" : state.error || (state.draftId ? "Draft saved for human review." : "Ready to generate.")}
      </div>

      <Button type="submit" disabled={isPending} className="min-h-10 px-5 motion-reduce:active:translate-y-0">
        {isPending ? "Generating…" : "Generate AI draft"}
      </Button>
    </form>
  );
}
