"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, SparklesIcon } from "lucide-react";
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
  const statusRef = useRef<HTMLSpanElement>(null);
  const restoreReviewFocus = useRef(false);

  const status = confirmedStatus ?? draft.status;
  const statusPresentation = getDraftStatusPresentation(status);
  const confidencePresentation = getConfidenceTierPresentation(draft.confidence_tier);
  const isPendingReview = status === "pending_review";

  useEffect(() => {
    if (confirmedStatus && restoreReviewFocus.current) {
      statusRef.current?.focus();
      restoreReviewFocus.current = false;
    }
  }, [confirmedStatus]);

  function handleReview(action: "approve" | "dismiss") {
    if (actionInFlight.current || !isPendingReview) return;
    actionInFlight.current = true;
    setError(null);
    setPendingAction(action);
    const trigger = document.activeElement;
    startTransition(async () => {
      try {
        const result = action === "approve"
          ? await approveMissionAiDraftAction(workspaceSlug, projectId, missionId, draft.id)
          : await dismissMissionAiDraftAction(workspaceSlug, projectId, missionId, draft.id);
        if (result.error) setError(result.error);
        else {
          restoreReviewFocus.current = document.activeElement === trigger || document.activeElement === document.body;
          setConfirmedStatus(action === "approve" ? "applied" : "dismissed");
        }
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Unable to complete review action.");
      } finally {
        actionInFlight.current = false;
        setPendingAction(null);
      }
    });
  }

  return (
    <Card data-status={status} aria-label={`AI draft, ${statusPresentation.label.toLowerCase()}`} aria-busy={!!pendingAction} className="review-card gap-5 ring-0">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-6 bg-transparent px-0 text-[13px] text-primary">
            <SparklesIcon aria-hidden="true" />
            AI-generated
          </Badge>
          <Badge ref={statusRef} tabIndex={-1} variant="outline" role="status" aria-live="polite" className="review-status ml-auto h-6 gap-1.5 text-[13px]">
            {status === "applied" && <Check aria-hidden="true" />}
            {statusPresentation.label}
          </Badge>
        </div>
        <CardTitle role="heading" aria-level={3} className="draft-summary">{draft.summary}</CardTitle>
        <p className="text-[13px] text-text-secondary">Created {formatDraftTimestamp(draft.created_at)}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-text-secondary">
          Suggested actions
        </p>
        <ul className="list-disc space-y-2 break-words pl-5 text-[15px] leading-6 text-foreground marker:text-primary">
          {draft.suggested_actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ul>
        {draft.suggested_actions.length === 0 && <p className="text-sm text-text-secondary">No suggested actions.</p>}

        <div className="border-t border-border-strong pt-4 text-[13px] leading-6 text-text-secondary">
          <Badge variant={confidencePresentation.variant} className="mr-2 align-middle">
            {confidencePresentation.label} · {formatConfidenceScore(draft.confidence_score)}
          </Badge>
          Confidence supports review; it does not approve this draft.
        </div>

        {status === "applied" && draft.approved_at && (
          <p className="text-[13px] text-text-secondary">
            Approved {formatDraftTimestamp(draft.approved_at)}
          </p>
        )}
      </CardContent>

      {isPendingReview && (
        <CardFooter role="group" aria-label={`Human review: ${draft.summary}`} className="review-boundary flex-col items-start gap-3">
          <div><p className="text-base font-semibold text-warning">Human review required</p><p className="mt-1 text-[13px] leading-6 text-text-secondary">Review the content before approving. This draft has no authority until you act.</p></div>
          <div aria-live="polite" role="status" className={pendingAction || error ? "text-sm text-text-secondary" : "sr-only"}>
            {error ? <p className="state-entry text-error">{error}</p> : <span className="flex items-center gap-2">{pendingAction && <LoaderCircle aria-hidden="true" size={14} className="motion-safe:animate-spin" />}{pendingAction === "approve" ? "Approving…" : pendingAction === "dismiss" ? "Dismissing…" : "Pending human review."}</span>}
          </div>
          <div className="review-actions flex gap-3">
            <Button type="button" onClick={() => handleReview("approve")} disabled={isPending || !!pendingAction} className="min-w-28 motion-reduce:active:translate-y-0">
              {pendingAction === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-w-28 motion-reduce:active:translate-y-0"
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
