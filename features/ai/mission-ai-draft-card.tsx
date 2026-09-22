"use client";

import { useState, useTransition } from "react";
import { SparklesIcon } from "lucide-react";
import {
  approveMissionAiDraftAction,
  dismissMissionAiDraftAction,
} from "@/features/ai/actions";
import type { MissionAiDraft } from "@/features/ai/types";
import {
  formatConfidenceScore,
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

  const statusPresentation = getDraftStatusPresentation(draft.status);
  const confidencePresentation = getConfidenceTierPresentation(draft.confidence_tier);
  const isPendingReview = draft.status === "pending_review";

  function handleApprove() {
    setError(null);
    setPendingAction("approve");
    startTransition(async () => {
      const result = await approveMissionAiDraftAction(
        workspaceSlug,
        projectId,
        missionId,
        draft.id,
      );
      setPendingAction(null);
      if (result.error) setError(result.error);
    });
  }

  function handleDismiss() {
    setError(null);
    setPendingAction("dismiss");
    startTransition(async () => {
      const result = await dismissMissionAiDraftAction(
        workspaceSlug,
        projectId,
        missionId,
        draft.id,
      );
      setPendingAction(null);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card aria-label={`AI draft, ${statusPresentation.label.toLowerCase()}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <SparklesIcon aria-hidden="true" />
            AI-generated
          </Badge>
          <Badge variant={statusPresentation.variant}>
            {statusPresentation.label}
          </Badge>
          <Badge variant={confidencePresentation.variant}>
            {confidencePresentation.label} · {formatConfidenceScore(draft.confidence_score)}
          </Badge>
        </div>
        <CardTitle className="mt-2">{draft.summary}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Suggested actions
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
          {draft.suggested_actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ul>

        {draft.status === "applied" && (
          <p className="mt-4 text-xs text-neutral-500">
            Approved {draft.approved_at ? new Date(draft.approved_at).toLocaleString() : ""}
          </p>
        )}
      </CardContent>

      {isPendingReview && (
        <CardFooter className="flex-col items-start gap-3">
          <div aria-live="polite" role="status" className="min-h-5 text-sm text-red-400">
            {error}
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleApprove} disabled={isPending}>
              {isPending && pendingAction === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDismiss}
              disabled={isPending}
            >
              {isPending && pendingAction === "dismiss" ? "Dismissing…" : "Dismiss"}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
