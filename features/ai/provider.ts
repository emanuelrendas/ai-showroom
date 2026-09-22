import {
  ProviderRateLimitError,
  type CostEstimator,
  type ModelProviderAdapter,
  type ModelProviderInvocation,
  type ModelProviderResult,
  type PromptTemplateMap,
} from "./inference-wrapper";

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 15_000;

// gemini-3.6-flash pricing, ratified 22 Sep 2026 (standard Flash tier):
// $0.10 / 1M input tokens, $0.40 / 1M output tokens -- expressed directly in
// usd_micros per token. Superseded gemini-1.5-flash, which is fully retired
// (confirmed via a live ListModels call, not assumed) and no longer callable
// at all; gemini-2.5-flash, tried next, was also rejected ("no longer
// available to new users").
const GEMINI_INPUT_USD_MICROS_PER_TOKEN = 0.1;
const GEMINI_OUTPUT_USD_MICROS_PER_TOKEN = 0.4;

// Mirrors SingleModelOutputSchema (Section 3.3.1) field-for-field. This is
// Gemini's own OpenAPI-subset schema format, not JSON Schema -- it has no
// additionalProperties: false equivalent, so it is a hint to the model, not
// an enforcement mechanism. The real, load-bearing enforcement is still
// SingleModelOutputSchema.safeParse() inside the wrapper (Section 3.3.1's
// "Strict rejection mechanism"), which runs on whatever Gemini actually
// returns regardless of this schema.
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    schema_version: { type: "STRING", enum: ["1.0.0"] },
    summary: { type: "STRING" },
    suggested_actions: { type: "ARRAY", items: { type: "STRING" } },
    confidence_score: { type: "NUMBER" },
    confidence_tier: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
    requires_human_review: {
      type: "BOOLEAN",
      description: "Must always be true. Human-in-the-loop review is mandatory by policy.",
    },
  },
  required: [
    "schema_version",
    "summary",
    "suggested_actions",
    "confidence_score",
    "confidence_tier",
    "requires_human_review",
  ],
} as const;

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
  };
}

async function invokeGemini(
  invocation: ModelProviderInvocation,
): Promise<ModelProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("MODEL_PROVIDER_NOT_CONFIGURED: GEMINI_API_KEY is not set");
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${invocation.promptTemplate}\n\n${invocation.input.prompt_context}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
  });

  if (response.status === 429) {
    throw new ProviderRateLimitError("Gemini rate limit exceeded (HTTP 429)");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Gemini request failed: HTTP ${response.status} ${response.statusText} ${body}`,
    );
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("Gemini response did not contain candidate text");
  }

  const usage = data.usageMetadata;

  if (!usage) {
    throw new Error("Gemini response did not contain usageMetadata");
  }

  const costUsdMicros = Math.ceil(
    usage.promptTokenCount * GEMINI_INPUT_USD_MICROS_PER_TOKEN +
      usage.candidatesTokenCount * GEMINI_OUTPUT_USD_MICROS_PER_TOKEN,
  );

  return {
    payload: JSON.parse(text),
    usage: {
      promptTokens: usage.promptTokenCount,
      completionTokens: usage.candidatesTokenCount,
      model: GEMINI_MODEL,
    },
    costUsdMicros,
  };
}

export function getModelProviderAdapter(): ModelProviderAdapter {
  return { invoke: invokeGemini };
}

// No `{{prompt_context}}` placeholder: invokeGemini appends
// invocation.input.prompt_context itself, after this instruction line. A
// placeholder here would be sent to Gemini unsubstituted.
//
// REQUIRES_HUMAN_REVIEW_RULE is a prompt-level reinforcement of the
// responseSchema's `description` above -- Gemini's structured-output schema
// has no enum/const equivalent for BOOLEAN, so neither the schema nor this
// instruction *guarantees* the model emits `true`. Both are hints. The real
// enforcement is still SingleModelOutputSchema.safeParse()'s `z.literal(true)`
// inside the wrapper: on a real gemini-3.6-flash call during manual testing
// (22 Sep 2026), the model returned `false` with no rule in the prompt, and
// safeParse correctly rejected it with MODEL_SCHEMA_VIOLATION. This rule
// reduces how often that happens; it does not replace the rejection.
const REQUIRES_HUMAN_REVIEW_RULE =
  "The requires_human_review field must always be true, with no exceptions, " +
  "regardless of your confidence level.";

export function getPromptTemplates(): PromptTemplateMap {
  return {
    summarize: `Summarize the following mission context. ${REQUIRES_HUMAN_REVIEW_RULE}`,
    classify: `Classify the following mission context. ${REQUIRES_HUMAN_REVIEW_RULE}`,
    draft_response: `Draft a suggested response for the following mission context. ${REQUIRES_HUMAN_REVIEW_RULE}`,
  };
}

const CHARS_PER_TOKEN_ESTIMATE = 4;
const ASSUMED_OUTPUT_TOKENS = 512;

/**
 * Pre-flight cost estimator calibrated to gemini-3.6-flash's real pricing,
 * used by InferenceExecutionWrapper's $0.02 hard ceiling (Section 3.3.2)
 * before any call reaches Gemini. Prompt token count is still a heuristic
 * (real tokenization isn't available pre-call); output token count is a
 * fixed assumption since it cannot be known until the model responds.
 * Rounds up (Math.ceil), same as the real post-call cost calculation above,
 * so the pre-flight estimate is never optimistic relative to the ceiling.
 */
export function getCostEstimator(): CostEstimator {
  return ({ input }) => {
    const estimatedPromptTokens = Math.ceil(
      input.prompt_context.length / CHARS_PER_TOKEN_ESTIMATE,
    );
    return Math.ceil(
      estimatedPromptTokens * GEMINI_INPUT_USD_MICROS_PER_TOKEN +
        ASSUMED_OUTPUT_TOKENS * GEMINI_OUTPUT_USD_MICROS_PER_TOKEN,
    );
  };
}
