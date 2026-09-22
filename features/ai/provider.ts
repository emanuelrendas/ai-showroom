import type { ModelProviderAdapter, PromptTemplateMap } from "./inference-wrapper";

/**
 * No real model provider has been chosen yet (open item, not decided by the
 * Milestone 2 design document). This stub keeps the wrapper wiring complete
 * and honest: it fails closed with a clear error instead of silently
 * returning fabricated model output. Replace with a real ModelProviderAdapter
 * once a provider is selected.
 */
export function getModelProviderAdapter(): ModelProviderAdapter {
  return {
    invoke() {
      return Promise.reject(
        new Error("MODEL_PROVIDER_NOT_CONFIGURED: no model provider is wired up yet"),
      );
    },
  };
}

// Placeholder prompt templates, pending real prompt engineering per task_type.
export function getPromptTemplates(): PromptTemplateMap {
  return {
    summarize: "Summarize the following mission context:\n\n{{prompt_context}}",
    classify: "Classify the following mission context:\n\n{{prompt_context}}",
    draft_response:
      "Draft a suggested response for the following mission context:\n\n{{prompt_context}}",
  };
}
