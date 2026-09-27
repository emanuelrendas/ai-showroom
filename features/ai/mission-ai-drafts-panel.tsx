import { getMissionAiDrafts } from "@/features/ai/draft-queries";
import { GenerateDraftForm } from "@/features/ai/generate-draft-form";
import { MissionAiDraftCard } from "@/features/ai/mission-ai-draft-card";

type MissionAiDraftsPanelProps = {
  workspaceSlug: string;
  projectId: string;
  missionId: string;
};

export async function MissionAiDraftsPanel({
  workspaceSlug,
  projectId,
  missionId,
}: MissionAiDraftsPanelProps) {
  const drafts = await getMissionAiDrafts(missionId);

  return (
    <section aria-labelledby="ai-drafts-heading" className="mt-8 space-y-6">
      <h2
        id="ai-drafts-heading"
        className="text-xs uppercase tracking-[0.2em] text-neutral-500"
      >
        AI drafts
      </h2>

      <GenerateDraftForm
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        missionId={missionId}
      />

      {drafts.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No AI drafts yet for this mission.
        </p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <MissionAiDraftCard
                draft={draft}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                missionId={missionId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
