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
      className="space-y-4 border border-neutral-800 p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-neutral-200">
          Generate AI draft
        </h3>
        <p className="text-xs text-neutral-500">
          One model call, always reviewed by a human before it counts.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-task-type">Task</Label>
        <select
          id="draft-task-type"
          name="task_type"
          defaultValue="summarize"
          className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-200"
        >
          {TASK_TYPES.map((taskType) => (
            <option key={taskType} value={taskType}>
              {TASK_TYPE_LABELS[taskType]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-prompt-context">Context for the model</Label>
        <Textarea
          id="draft-prompt-context"
          name="prompt_context"
          placeholder="Paste or describe the mission context the model should work from."
          minLength={PROMPT_CONTEXT_MIN_LENGTH}
          maxLength={PROMPT_CONTEXT_MAX_LENGTH}
          rows={5}
          required
        />
      </div>

      <div aria-live="polite" role="status" className="min-h-5 text-sm text-red-400">
        {state.error}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Generating…" : "Generate AI draft"}
      </Button>
    </form>
  );
}
