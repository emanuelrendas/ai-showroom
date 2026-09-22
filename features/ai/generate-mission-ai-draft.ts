import type { SingleModelInput, SingleModelOutput } from "./schemas";
import type {
  InferenceExecutionWrapper,
  InferenceFailure,
  InferenceLogRecord,
  TaskType,
} from "./inference-wrapper";
import type { MissionAiDraftWriter } from "./mission-ai-draft-writer";

export interface GenerateMissionAiDraftDeps {
  wrapper: Pick<InferenceExecutionWrapper, "execute">;
  draftWriter: MissionAiDraftWriter;
}

export interface GenerateMissionAiDraftParams {
  input: SingleModelInput;
  taskType: TaskType;
  createdBy: string;
}

export type GenerateMissionAiDraftResult =
  | { ok: true; draftId: string; output: SingleModelOutput; log: InferenceLogRecord }
  | { ok: false; failure: InferenceFailure; log: InferenceLogRecord | null };

/**
 * Section 3.3.2 + 4.2: runs the InferenceExecutionWrapper (which always
 * persists telemetry itself, success or failure, before returning) and only
 * writes a mission_ai_drafts row when the wrapper reports success. Fail-closed
 * by construction: there is no code path here that reaches draftWriter.write
 * on a non-ok wrapper result.
 */
export async function generateMissionAiDraft(
  deps: GenerateMissionAiDraftDeps,
  params: GenerateMissionAiDraftParams,
): Promise<GenerateMissionAiDraftResult> {
  const result = await deps.wrapper.execute(params.input, params.taskType);

  if (!result.ok) {
    return result;
  }

  const { id } = await deps.draftWriter.write({
    mission_id: params.input.mission_id,
    project_id: params.input.project_id,
    workspace_id: params.input.workspace_id,
    created_by: params.createdBy,
    output: result.output,
  });

  return { ok: true, draftId: id, output: result.output, log: result.log };
}
