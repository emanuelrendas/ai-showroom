// Presentation-only helpers for the HITL review surface (Sections 4.2/4.3).
// Pure and framework-free so they can be unit-tested without a component
// rendering harness, which this project does not yet have set up.

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost";

export interface StatusPresentation {
  label: string;
  variant: BadgeVariant;
}

export function getDraftStatusPresentation(status: string): StatusPresentation {
  switch (status) {
    case "pending_review":
      return { label: "Pending review", variant: "outline" };
    case "applied":
      return { label: "Applied", variant: "default" };
    case "dismissed":
      return { label: "Dismissed", variant: "secondary" };
    default:
      return { label: status, variant: "ghost" };
  }
}

export function getConfidenceTierPresentation(tier: string): StatusPresentation {
  switch (tier) {
    case "HIGH":
      return { label: "High confidence", variant: "default" };
    case "MEDIUM":
      return { label: "Medium confidence", variant: "secondary" };
    case "LOW":
      return { label: "Low confidence", variant: "destructive" };
    default:
      return { label: tier, variant: "ghost" };
  }
}

export function formatConfidenceScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

// Mirrors SingleModelInputSchema's prompt_context bounds (Section 3.3.1):
// z.string().min(10).max(10000). Duplicated here, not imported, so this
// presentation-only module never needs to pull in the model I/O contract.
export const PROMPT_CONTEXT_MIN_LENGTH = 10;
export const PROMPT_CONTEXT_MAX_LENGTH = 10000;

export function isPromptContextLengthValid(value: string): boolean {
  return (
    value.length >= PROMPT_CONTEXT_MIN_LENGTH &&
    value.length <= PROMPT_CONTEXT_MAX_LENGTH
  );
}
