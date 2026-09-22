import type { z } from "zod";
import {
  SingleModelInputSchema,
  SingleModelOutputSchema,
  type SingleModelInput,
  type SingleModelOutput,
} from "./schemas";

export const TASK_TYPES = ["summarize", "classify", "draft_response"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export type PromptTemplateMap = Record<TaskType, string>;

export interface ModelProviderUsage {
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface ModelProviderInvocation {
  taskType: TaskType;
  promptTemplate: string;
  input: SingleModelInput;
}

export interface ModelProviderResult {
  payload: unknown;
  usage: ModelProviderUsage;
  costUsdMicros: number;
}

export interface ModelProviderAdapter {
  invoke(invocation: ModelProviderInvocation): Promise<ModelProviderResult>;
}

export class ProviderRateLimitError extends Error {
  constructor(message = "Model provider rate limit exceeded") {
    super(message);
    this.name = "ProviderRateLimitError";
  }
}

export class ProviderTimeoutError extends Error {
  constructor(message = "Model provider call timed out") {
    super(message);
    this.name = "ProviderTimeoutError";
  }
}

export type InferenceLogStatus = "success" | "failed" | "refused";

export interface InferenceLogRecord {
  workspace_id: string;
  project_id: string;
  mission_id: string;
  task_type: TaskType;
  status: InferenceLogStatus;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  model_identifier: string | null;
  latency_ms: number;
  cost_usd_micros: number | null;
  failure_reason: string | null;
}

export interface InferenceLogWriter {
  write(record: InferenceLogRecord): Promise<void>;
}

export type CostEstimator = (params: {
  taskType: TaskType;
  input: SingleModelInput;
}) => number;

const CHARS_PER_TOKEN_ESTIMATE = 4;
const DEFAULT_ASSUMED_OUTPUT_TOKENS = 512;
const DEFAULT_PROMPT_USD_MICROS_PER_TOKEN = 1;
const DEFAULT_COMPLETION_USD_MICROS_PER_TOKEN = 3;

/**
 * Placeholder pre-flight heuristic (no provider pricing table is ratified yet).
 * Callers with real provider pricing should inject their own `costEstimator`.
 */
export const defaultCostEstimator: CostEstimator = ({ input }) => {
  const estimatedPromptTokens = Math.ceil(
    input.prompt_context.length / CHARS_PER_TOKEN_ESTIMATE,
  );
  return (
    estimatedPromptTokens * DEFAULT_PROMPT_USD_MICROS_PER_TOKEN +
    DEFAULT_ASSUMED_OUTPUT_TOKENS * DEFAULT_COMPLETION_USD_MICROS_PER_TOKEN
  );
};

// $0.02 hard ceiling per call, per explicit runtime directive (2026-09-22).
// Section 6.6 of the milestone design document leaves the cost ceiling as an
// open item pending a number from Emanuel; this constant is that number.
export const DEFAULT_COST_CEILING_USD_MICROS = 20_000;
export const DEFAULT_TIMEOUT_MS = 30_000;

export type InferenceFailureCode =
  | "INPUT_SCHEMA_VIOLATION"
  | "COST_CEILING_EXCEEDED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_ERROR"
  | "MODEL_SCHEMA_VIOLATION";

export interface InferenceFailure {
  code: InferenceFailureCode;
  httpStatus: 402 | 422 | 429 | 502 | 504;
  message: string;
  issues?: z.ZodIssue[];
}

export type InferenceExecutionResult =
  | { ok: true; output: SingleModelOutput; log: InferenceLogRecord }
  | { ok: false; failure: InferenceFailure; log: InferenceLogRecord | null };

export interface InferenceExecutionWrapperDeps {
  provider: ModelProviderAdapter;
  promptTemplates: PromptTemplateMap;
  inferenceLogger: InferenceLogWriter;
  costEstimator?: CostEstimator;
  costCeilingUsdMicros?: number;
  timeoutMs?: number;
  now?: () => number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new ProviderTimeoutError());
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

/**
 * Server-side client wrapping every call to the model provider, per Section 3.3.2.
 * Owns telemetry, cost enforcement, and output validation; the model itself never
 * reports on its own execution.
 */
export class InferenceExecutionWrapper {
  private readonly provider: ModelProviderAdapter;
  private readonly promptTemplates: PromptTemplateMap;
  private readonly inferenceLogger: InferenceLogWriter;
  private readonly costEstimator: CostEstimator;
  private readonly costCeilingUsdMicros: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(deps: InferenceExecutionWrapperDeps) {
    this.provider = deps.provider;
    this.promptTemplates = deps.promptTemplates;
    this.inferenceLogger = deps.inferenceLogger;
    this.costEstimator = deps.costEstimator ?? defaultCostEstimator;
    this.costCeilingUsdMicros =
      deps.costCeilingUsdMicros ?? DEFAULT_COST_CEILING_USD_MICROS;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = deps.now ?? (() => performance.now());
  }

  async execute(
    rawInput: unknown,
    taskType: TaskType,
  ): Promise<InferenceExecutionResult> {
    const inputParse = SingleModelInputSchema.safeParse(rawInput);
    if (!inputParse.success) {
      return {
        ok: false,
        failure: {
          code: "INPUT_SCHEMA_VIOLATION",
          httpStatus: 422,
          message: "SingleModelInputSchema validation failed",
          issues: inputParse.error.issues,
        },
        log: null,
      };
    }
    const input = inputParse.data;
    const startedAt = this.now();
    const promptTemplate = this.promptTemplates[taskType];

    const estimatedCostUsdMicros = this.costEstimator({ taskType, input });
    if (estimatedCostUsdMicros > this.costCeilingUsdMicros) {
      const log = this.buildLogRecord({
        input,
        taskType,
        status: "failed",
        latencyMs: this.elapsedMs(startedAt),
        failureReason: "COST_CEILING_EXCEEDED",
      });
      await this.inferenceLogger.write(log);
      return {
        ok: false,
        failure: {
          code: "COST_CEILING_EXCEEDED",
          httpStatus: 402,
          message: `Estimated cost ${estimatedCostUsdMicros} usd_micros exceeds the ${this.costCeilingUsdMicros} usd_micros hard ceiling`,
        },
        log,
      };
    }

    let providerResult: ModelProviderResult;
    try {
      providerResult = await withTimeout(
        this.provider.invoke({ taskType, promptTemplate, input }),
        this.timeoutMs,
      );
    } catch (error) {
      const failureCode: InferenceFailureCode =
        error instanceof ProviderTimeoutError
          ? "PROVIDER_TIMEOUT"
          : error instanceof ProviderRateLimitError
            ? "PROVIDER_RATE_LIMIT"
            : "PROVIDER_ERROR";
      const httpStatus: InferenceFailure["httpStatus"] =
        failureCode === "PROVIDER_TIMEOUT"
          ? 504
          : failureCode === "PROVIDER_RATE_LIMIT"
            ? 429
            : 502;
      const log = this.buildLogRecord({
        input,
        taskType,
        status: "failed",
        latencyMs: this.elapsedMs(startedAt),
        failureReason: failureCode,
      });
      await this.inferenceLogger.write(log);
      return {
        ok: false,
        failure: {
          code: failureCode,
          httpStatus,
          message:
            error instanceof Error ? error.message : "Model provider call failed",
        },
        log,
      };
    }

    const latencyMs = this.elapsedMs(startedAt);
    const outputParse = SingleModelOutputSchema.safeParse(providerResult.payload);

    if (!outputParse.success) {
      const log = this.buildLogRecord({
        input,
        taskType,
        status: "refused",
        latencyMs,
        failureReason: "MODEL_SCHEMA_VIOLATION",
        usage: providerResult.usage,
        costUsdMicros: providerResult.costUsdMicros,
      });
      await this.inferenceLogger.write(log);
      return {
        ok: false,
        failure: {
          code: "MODEL_SCHEMA_VIOLATION",
          httpStatus: 422,
          message: "SingleModelOutputSchema validation failed",
          issues: outputParse.error.issues,
        },
        log,
      };
    }

    const log = this.buildLogRecord({
      input,
      taskType,
      status: "success",
      latencyMs,
      failureReason: null,
      usage: providerResult.usage,
      costUsdMicros: providerResult.costUsdMicros,
    });
    await this.inferenceLogger.write(log);

    return { ok: true, output: outputParse.data, log };
  }

  private elapsedMs(startedAt: number): number {
    return Math.max(0, Math.round(this.now() - startedAt));
  }

  private buildLogRecord(params: {
    input: SingleModelInput;
    taskType: TaskType;
    status: InferenceLogStatus;
    latencyMs: number;
    failureReason: string | null;
    usage?: ModelProviderUsage;
    costUsdMicros?: number;
  }): InferenceLogRecord {
    return {
      workspace_id: params.input.workspace_id,
      project_id: params.input.project_id,
      mission_id: params.input.mission_id,
      task_type: params.taskType,
      status: params.status,
      prompt_tokens: params.usage?.promptTokens ?? null,
      completion_tokens: params.usage?.completionTokens ?? null,
      total_tokens:
        params.usage !== undefined
          ? params.usage.promptTokens + params.usage.completionTokens
          : null,
      model_identifier: params.usage?.model ?? null,
      latency_ms: params.latencyMs,
      cost_usd_micros: params.costUsdMicros ?? null,
      failure_reason: params.failureReason,
    };
  }
}
