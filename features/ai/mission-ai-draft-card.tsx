"use client";

import { useRef, useState, useTransition } from "react";
import { SparklesIcon } from "lucide-react";
import {
  approveMissionAiDraftAction,
  dismissMissionAiDraftAction,
} from "@/features/ai/actions";
import type { MissionAiDraft } from "@/features/ai/types";
import {
  formatConfidenceScore,
  formatDraftTimestamp,
  getConfidenceTierPresentation,
  getDraftStatusPresentation,
} from "@/features/ai/draft-presentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type MissionAiDraftCardProps = {
  draft: MissionAiDraft;
  workspaceSlug: string;
  projectId: string;
  missionId: string;
};

export function MissionAiDraftCard({
  draft,
  workspaceSlug,
  projectId,
  missionId,
}: MissionAiDraftCardProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"approve" | "dismiss" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmedStatus, setConfirmedStatus] = useState<"applied" | "dismissed" | null>(null);
  const actionInFlight = useRef(false);

  const status = confirmedStatus ?? draft.status;
  const statusPresentation = getDraftStatusPresentation(status);
  const confidencePresentation = getConfidenceTierPresentation(draft.confidence_tier);
  const isPendingReview = status === "pending_review";

  function handleReview(action: "approve" | "dismiss") {
    if (actionInFlight.current || !isPendingReview) return;
    actionInFlight.current = true;
    setError(null);
    setPendingAction(action);
    startTransition(async () => {
      try {
        const result = action === "approve"
          ? await approveMissionAiDraftAction(workspaceSlug, projectId, missionId, draft.id)
          : await dismissMissionAiDraftAction(workspaceSlug, projectId, missionId, draft.id);
        if (result.error) setError(result.error);
        else setConfirmedStatus(action === "approve" ? "applied" : "dismissed");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Unable to complete review action.");
      } finally {
        actionInFlight.current = false;
        setPendingAction(null);
      }
    });
  }

  return (
    <Card aria-label={`AI draft, ${statusPresentation.label.toLowerCase()}`} aria-busy={!!pendingAction} className="gap-5 border border-border bg-surface-raised ring-0">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <SparklesIcon aria-hidden="true" />
            AI-generated
          </Badge>
          <Badge variant={statusPresentation.variant} role="status" aria-live="polite" className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[200ms]">
            {statusPresentation.label}
          </Badge>
        </div>
        <CardTitle className="text-lg leading-7 text-foreground">{draft.summary}</CardTitle>
        <p className="text-xs text-text-tertiary">Created {formatDraftTimestamp(draft.created_at)}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
          Suggested actions
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-foreground">
          {draft.suggested_actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ul>
        {draft.suggested_actions.length === 0 && <p className="text-sm text-text-secondary">No suggested actions.</p>}

        <div className="border-t border-border pt-4 text-xs text-text-secondary">
          <Badge variant={confidencePresentation.variant} className="mr-2 align-middle">
            {confidencePresentation.label} · {formatConfidenceScore(draft.confidence_score)}
          </Badge>
          Confidence supports review; it does not approve this draft.
        </div>

        {status === "applied" && draft.approved_at && (
          <p className="text-xs text-text-secondary">
            Approved {formatDraftTimestamp(draft.approved_at)}
          </p>
        )}
      </CardContent>

      {isPendingReview && (
        <CardFooter className="flex-col items-start gap-3">
          <div aria-live="polite" role="status" className={`min-h-5 text-sm ${error ? "text-error" : "text-text-secondary"}`}>
            {error || (pendingAction === "approve" ? "Approving…" : pendingAction === "dismiss" ? "Dismissing…" : "Pending human review.")}
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => handleReview("approve")} disabled={isPending || !!pendingAction} className="motion-reduce:active:translate-y-0">
              {pendingAction === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="motion-reduce:active:translate-y-0"
              onClick={() => handleReview("dismiss")}
              disabled={isPending || !!pendingAction}
            >
              {pendingAction === "dismiss" ? "Dismissing…" : "Dismiss"}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
