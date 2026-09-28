import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MissionAiDraftsPanel } from "@/features/ai/mission-ai-drafts-panel";
import type { MissionAiDraft } from "@/features/ai/types";

vi.mock("@/features/ai/actions", () => ({
  generateMissionAiDraftAction: vi.fn(),
  approveMissionAiDraftAction: vi.fn(),
  dismissMissionAiDraftAction: vi.fn(),
}));

const workspace = {
  id: "workspace-1", name: "Atelier", slug: "atelier", created_by: "user-1",
  created_at: "2026-09-28T00:00:00Z", updated_at: "2026-09-28T00:00:00Z",
};
const project = {
  id: "project-1", workspace_id: workspace.id, name: "Northstar", description: null,
  status: "active", created_by: "user-1", created_at: "2026-09-28T00:00:00Z",
  updated_at: "2026-09-28T00:00:00Z",
};
const mission = {
  id: "mission-1", project_id: project.id, title: "Launch review",
  description: "Review the launch plan", status: "active", priority: "high",
  created_by: "user-1", created_at: "2026-09-27T10:00:00Z",
  updated_at: "2026-09-28T11:00:00Z",
};
const draft: MissionAiDraft = {
  id: "draft-1", mission_id: mission.id, project_id: project.id,
  workspace_id: workspace.id, schema_version: "1", summary: "Draft plan",
  suggested_actions: ["Check launch date"], confidence_score: 0.82,
  confidence_tier: "HIGH", is_ai_generated: true, status: "pending_review",
  approved_by: null, approved_at: null, created_by: "user-1",
  created_at: "2026-09-28T12:00:00Z", updated_at: "2026-09-28T12:00:00Z",
};

function renderWorkspace(drafts: MissionAiDraft[] = []) {
  return render(
    <MissionAiDraftsPanel workspace={workspace} project={project} mission={mission}
      drafts={drafts} />,
  );
}

test("mission workspace shows real hierarchy and mission context", () => {
  renderWorkspace();
  const hierarchy = screen.getByRole("navigation", { name: "Mission hierarchy" });
  expect(within(hierarchy).getByRole("link", { name: "Atelier" }).getAttribute("href")).toBe("/w/atelier");
  expect(within(hierarchy).getByRole("link", { name: "Northstar" }).getAttribute("href")).toBe("/w/atelier/projects/project-1");
  expect(screen.getByRole("heading", { name: "Launch review" })).toBeTruthy();
  expect(screen.getByText("Review the launch plan")).toBeTruthy();
  expect(screen.getByText("High", { exact: false })).toBeTruthy();
});

test("mobile working modes default to AI and switch by keyboard", async () => {
  const user = userEvent.setup();
  renderWorkspace();
  const modes = screen.getByRole("group", { name: "Mission working modes" });
  const ai = within(modes).getByRole("button", { name: "AI" });
  expect(ai.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("region", { name: "AI Workspace" })).toBeTruthy();
  const context = within(modes).getByRole("button", { name: "Context" });
  context.focus();
  await user.keyboard("{Enter}");
  expect(context.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("region", { name: "Mission Context" })).toBeTruthy();
  await user.click(within(modes).getByRole("button", { name: "Activity" }));
  expect(screen.getByRole("region", { name: "Activity and review history" })).toBeTruthy();
});

test("empty draft and activity states do not imply events", () => {
  renderWorkspace();
  expect(screen.getByText("No AI drafts yet for this mission.")).toBeTruthy();
  expect(screen.getByText("No draft activity yet.")).toBeTruthy();
});

test("activity reports persisted draft facts and approved time", () => {
  renderWorkspace([{ ...draft, status: "applied", approved_at: "2026-09-28T13:00:00Z" }]);
  const activity = screen.getByRole("region", { name: "Activity and review history" });
  expect(within(activity).getByText("Draft plan")).toBeTruthy();
  expect(within(activity).getByText("Applied")).toBeTruthy();
  expect(within(activity).getByText(/Approved/)).toBeTruthy();
});
