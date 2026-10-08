import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MissionAiDraftsPanel } from "@/features/ai/mission-ai-drafts-panel";
import type { MissionAiDraft } from "@/features/ai/types";
import { generateMissionAiDraftAction } from "@/features/ai/actions";
import { routeModel } from "@/features/ai/router/router";
import { toRoutePresentation } from "@/features/ai/router/presentation";
import { routeRequest } from "../unit/fixtures/router-profiles";

vi.mock("@/features/ai/actions", () => ({
  generateMissionAiDraftAction: vi.fn(),
  approveMissionAiDraftAction: vi.fn(),
  dismissMissionAiDraftAction: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

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

test("saved results lead the workspace and the composer opens without losing input", async () => {
  const user = userEvent.setup();
  renderWorkspace([draft]);
  const ai = screen.getByRole("region", { name: "AI Workspace" });
  const toggle = within(ai).getByRole("button", { name: "Generate another draft" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(within(ai).queryByRole("textbox")).toBeNull();
  expect(within(ai).getByRole("button", { name: "Approve" })).toBeTruthy();
  await user.click(toggle);
  await user.type(within(ai).getByRole("textbox"), "Keep this source for a second draft.");
  await user.selectOptions(within(ai).getByRole("combobox"), "classify");
  await user.click(toggle);
  await user.click(toggle);
  expect((within(ai).getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this source for a second draft.");
  expect((within(ai).getByRole("combobox") as HTMLSelectElement).value).toBe("classify");
});

test("each human review boundary is explicitly associated with its own artifact", () => {
  renderWorkspace([draft, { ...draft, id: "draft-2", summary: "Second plan" }]);
  for (const summary of ["Draft plan", "Second plan"]) {
    const review = screen.getByRole("group", { name: `Human review: ${summary}` });
    expect(within(review).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(review).getByRole("button", { name: "Dismiss" })).toBeTruthy();
    expect(within(review).getByText(/no authority until you act/)).toBeTruthy();
    expect(review.closest("[data-slot=card]")?.textContent).toContain(summary);
  }
});

test("a new result precedes the composer without discarding its context", async () => {
  const user = userEvent.setup();
  const view = renderWorkspace();
  const prompt = screen.getByRole("textbox");
  await user.type(prompt, "Preserve my working context.");
  view.rerender(<MissionAiDraftsPanel workspace={workspace} project={project} mission={mission} drafts={[draft]} />);
  const result = screen.getByLabelText("AI draft, pending review");
  const form = screen.getByRole("form", { name: "Generate an AI draft for this mission" });
  expect(result.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect((prompt as HTMLTextAreaElement).value).toBe("Preserve my working context.");
  expect(document.activeElement).toBe(prompt);
});

test("secondary composer stays open while pending and keeps the actual route visible when collapsed", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof generateMissionAiDraftAction>>) => void;
  vi.mocked(generateMissionAiDraftAction).mockReturnValue(new Promise((done) => { resolve = done; }));
  const result = routeModel(routeRequest);
  if (!result.ok) throw new Error("Expected a production route");
  const user = userEvent.setup();
  renderWorkspace([draft]);
  const toggle = screen.getByRole("button", { name: "Generate another draft" });
  await user.click(toggle);
  await user.type(screen.getByRole("textbox"), "Summarize the revised launch notes.");
  await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
  expect(toggle.hasAttribute("disabled")).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(screen.queryByRole("button", { name: /Stop|Cancel/ })).toBeNull();
  await act(async () => resolve({ error: null, draftId: "draft-2", route: toRoutePresentation(result.decision) }));
  await user.click(toggle);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText("Auto · Gemini 3.6 Flash")).toBeTruthy();
  expect(screen.getByText("Draft saved for human review.")).toBeTruthy();
});

test("activity reports persisted draft facts and approved time", () => {
  renderWorkspace([{ ...draft, status: "applied", approved_at: "2026-09-28T13:00:00Z" }]);
  const activity = screen.getByRole("region", { name: "Activity and review history" });
  expect(within(activity).getByText("Draft plan")).toBeTruthy();
  expect(within(activity).getByText("Applied")).toBeTruthy();
  expect(within(activity).getByText(/Approved/)).toBeTruthy();
});

test.each([false, true])("route result and human review survive mobile mode changes with reduced motion = %s", async (reducedMotion) => {
  vi.stubGlobal("matchMedia", () => ({ matches: reducedMotion, media: "(prefers-reduced-motion: reduce)", addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const result = routeModel(routeRequest);
  if (!result.ok) throw new Error("Expected a production route");
  vi.mocked(generateMissionAiDraftAction).mockResolvedValue({
    error: null, draftId: draft.id, route: toRoutePresentation(result.decision),
  });
  const user = userEvent.setup();
  const view = renderWorkspace();
  const composer = screen.getByRole("form", { name: "Generate an AI draft for this mission" });
  expect(within(composer).getByText("Routing: Auto")).toBeTruthy();
  await user.type(within(composer).getByRole("textbox"), "Summarize the launch review notes.");
  await user.click(within(composer).getByRole("button", { name: "Generate AI draft" }));
  expect(await within(composer).findByText("Draft saved for human review.")).toBeTruthy();
  // Model the refreshed server props after revalidation; approval is still pending.
  view.rerender(<MissionAiDraftsPanel workspace={workspace} project={project} mission={mission} drafts={[draft]} />);
  const record = screen.getByLabelText("AI draft, pending review").closest("li");
  expect(record?.getAttribute("data-reveal")).toBe(reducedMotion ? "false" : "true");
  const modes = screen.getByRole("group", { name: "Mission working modes" });
  for (const mode of ["Context", "Activity", "AI"]) {
    const button = within(modes).getByRole("button", { name: mode });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  }
  const ai = screen.getByRole("region", { name: "AI Workspace" });
  expect(within(ai).getByText("Auto · Gemini 3.6 Flash")).toBeTruthy();
  expect(within(ai).getByText("Automatically selected")).toBeTruthy();
  expect(within(ai).getByText("Draft saved for human review.")).toBeTruthy();
  expect(within(ai).getByText("Human review required")).toBeTruthy();
  expect(within(ai).getByText("Pending review")).toBeTruthy();
  expect(within(ai).getByRole("button", { name: "Approve" })).toBeTruthy();
  expect(within(ai).getByRole("button", { name: "Dismiss" })).toBeTruthy();
  expect(within(ai).getAllByRole("combobox")).toHaveLength(1);
  expect(ai.textContent).not.toMatch(/synthetic-|Routing…|Validating…/);
});

test("mode arrow keys wrap and preserve the composer context", async () => {
  const user = userEvent.setup();
  renderWorkspace();
  const prompt = screen.getByRole("textbox", { name: "Prompt / Context" });
  await user.type(prompt, "Keep this context while reviewing activity.");
  const modes = screen.getByRole("group", { name: "Mission working modes" });
  const ai = within(modes).getByRole("button", { name: "AI" });
  ai.focus();
  await user.keyboard("{ArrowRight}");
  expect(within(modes).getByRole("button", { name: "Activity" }).getAttribute("aria-pressed")).toBe("true");
  await user.keyboard("{ArrowRight}");
  expect(within(modes).getByRole("button", { name: "Context" })).toBe(document.activeElement);
  await user.keyboard("{End}{Home}{ArrowRight}");
  expect(ai.getAttribute("aria-pressed")).toBe("true");
  expect((prompt as HTMLTextAreaElement).value).toBe("Keep this context while reviewing activity.");
});

test("only a newly received draft reveals once; existing records remain stable", () => {
  const view = renderWorkspace([draft]);
  const existing = screen.getByLabelText("AI draft, pending review").closest("li");
  expect(existing?.getAttribute("data-reveal")).toBe("false");
  const added = { ...draft, id: "draft-2", summary: "New launch plan" };
  view.rerender(<MissionAiDraftsPanel workspace={workspace} project={project} mission={mission} drafts={[added, draft]} />);
  const fresh = screen.getByText("New launch plan", { selector: "[data-slot=card-title]" }).closest("li")!;
  expect(fresh.getAttribute("data-reveal")).toBe("true");
  expect(existing?.getAttribute("data-reveal")).toBe("false");
  fireEvent.animationEnd(fresh);
  expect(fresh.getAttribute("data-reveal")).toBe("false");
  view.rerender(<MissionAiDraftsPanel workspace={workspace} project={project} mission={mission} drafts={[{ ...added, status: "applied" }, draft]} />);
  expect(fresh.getAttribute("data-reveal")).toBe("false");
});

test("enabling reduced motion ends a reveal without hiding content or replaying it later", () => {
  let reduced = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return reduced; },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  const view = renderWorkspace();
  view.rerender(<MissionAiDraftsPanel workspace={workspace} project={project} mission={mission} drafts={[draft]} />);
  const record = screen.getByLabelText("AI draft, pending review").closest("li");
  expect(record?.getAttribute("data-reveal")).toBe("true");
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(record?.getAttribute("data-reveal")).toBe("false");
  expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  expect(record?.getAttribute("data-reveal")).toBe("false");
});
