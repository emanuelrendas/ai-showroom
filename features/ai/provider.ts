import {
  ProviderRateLimitError,
  type CostEstimator,
  type ModelProviderAdapter,
  type ModelProviderInvocation,
  type ModelProviderResult,
  type PromptTemplateMap,
} from "./inference-wrapper";

const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 15_000;

// gemini-1.5-flash pricing, ratified 22 Sep 2026: $0.075 / 1M input tokens,
// $0.30 / 1M output tokens -- expressed directly in usd_micros per token.
const GEMINI_INPUT_USD_MICROS_PER_TOKEN = 0.075;
const GEMINI_OUTPUT_USD_MICROS_PER_TOKEN = 0.3;

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
    requires_human_review: { type: "BOOLEAN" },
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

  const costUsdMicros = Math.round(
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
export function getPromptTemplates(): PromptTemplateMap {
  return {
    summarize: "Summarize the following mission context.",
    classify: "Classify the following mission context.",
    draft_response: "Draft a suggested response for the following mission context.",
  };
}

const CHARS_PER_TOKEN_ESTIMATE = 4;
const ASSUMED_OUTPUT_TOKENS = 512;

/**
 * Pre-flight cost estimator calibrated to gemini-1.5-flash's real pricing,
 * used by InferenceExecutionWrapper's $0.02 hard ceiling (Section 3.3.2)
 * before any call reaches Gemini. Prompt token count is still a heuristic
 * (real tokenization isn't available pre-call); output token count is a
 * fixed assumption since it cannot be known until the model responds.
 */
export function getCostEstimator(): CostEstimator {
  return ({ input }) => {
    const estimatedPromptTokens = Math.ceil(
      input.prompt_context.length / CHARS_PER_TOKEN_ESTIMATE,
    );
    return Math.round(
      estimatedPromptTokens * GEMINI_INPUT_USD_MICROS_PER_TOKEN +
        ASSUMED_OUTPUT_TOKENS * GEMINI_OUTPUT_USD_MICROS_PER_TOKEN,
    );
  };
}
