import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GenerateDraftForm } from "@/features/ai/generate-draft-form";
import { MissionAiDraftCard } from "@/features/ai/mission-ai-draft-card";
import type { MissionAiDraft } from "@/features/ai/types";
import {
  approveMissionAiDraftAction,
  dismissMissionAiDraftAction,
  generateMissionAiDraftAction,
  type MissionAiDraftActionState,
} from "@/features/ai/actions";
import { toRoutePresentation } from "@/features/ai/router/presentation";
import { routeModel } from "@/features/ai/router/router";
import { routeRequest, syntheticRegistry } from "../unit/fixtures/router-profiles";

vi.mock("@/features/ai/actions", () => ({
  approveMissionAiDraftAction: vi.fn(),
  dismissMissionAiDraftAction: vi.fn(),
  generateMissionAiDraftAction: vi.fn(),
}));

const draft: MissionAiDraft = {
  id: "draft-1", mission_id: "mission-1", project_id: "project-1",
  workspace_id: "workspace-1", schema_version: "1", summary: "Draft plan",
  suggested_actions: ["Check launch date"], confidence_score: 0.82,
  confidence_tier: "HIGH", is_ai_generated: true, status: "pending_review",
  approved_by: null, approved_at: null, created_by: "user-1",
  created_at: "2026-09-28T12:00:00Z", updated_at: "2026-09-28T12:00:00Z",
};
const ids = { workspaceSlug: "atelier", projectId: "project-1", missionId: "mission-1" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

function productionRoute() {
  const result = routeModel(routeRequest);
  if (!result.ok) throw new Error("Expected a production route");
  return toRoutePresentation(result.decision);
}

test("idle Auto identifies routing mode without claiming a selected model or offering a model picker", () => {
  render(<GenerateDraftForm {...ids} />);
  expect(screen.getByText("Routing: Auto")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Ready to generate.");
  expect(screen.queryByText(/Gemini|Automatically selected|synthetic-/)).toBeNull();
  expect(screen.getAllByRole("combobox")).toEqual([screen.getByRole("combobox", { name: "Task" })]);
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Summarize", "Classify", "Draft a response"]);
});

test("composer accepts task and prompt, then shows only real generation pending state", async () => {
  const request = deferred<MissionAiDraftActionState>();
  vi.mocked(generateMissionAiDraftAction).mockReturnValue(request.promise);
  const user = userEvent.setup();
  render(<GenerateDraftForm {...ids} />);
  await user.selectOptions(screen.getByRole("combobox", { name: "Task" }), "classify");
  const prompt = screen.getByRole("textbox", { name: "Prompt / Context" });
  await user.type(prompt, "Classify the launch risks and next steps.");
  await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
  const submitted = vi.mocked(generateMissionAiDraftAction).mock.calls[0]?.[4];
  expect(submitted?.get("task_type")).toBe("classify");
  expect(submitted?.get("prompt_context")).toBe("Classify the launch risks and next steps.");
  expect(screen.getByRole("button", { name: "Generating…" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("status").textContent).toBe("Generating…");
  expect(screen.queryByText(/Routing…|Validating…|Thinking|\d+%|Gemini|Automatically selected/)).toBeNull();
  expect((prompt as HTMLTextAreaElement).value).toContain("launch risks");
  await act(async () => request.resolve({ error: null, draftId: "draft-1", route: productionRoute() }));
  const status = screen.getByRole("status");
  expect(within(status).getByText("Auto · Gemini 3.6 Flash")).toBeTruthy();
  expect(within(status).getByText("Automatically selected")).toBeTruthy();
  expect(within(status).getByText("Draft saved for human review.")).toBeTruthy();
  expect(status.getAttribute("aria-live")).toBe("polite");
  expect(status.getAttribute("aria-atomic")).toBe("true");
});

test.each(["success", "resolution", "generation"] as const)("a new pending run suppresses prior %s route, error and success text", async (previous) => {
  const request = deferred<MissionAiDraftActionState>();
  vi.mocked(generateMissionAiDraftAction)
    .mockResolvedValueOnce(previous === "success"
      ? { error: null, draftId: "draft-1", route: productionRoute() }
      : { error: "Prior failure.", failureCategory: previous, route: productionRoute() })
    .mockReturnValueOnce(request.promise);
  const user = userEvent.setup();
  render(<GenerateDraftForm {...ids} />);
  await user.type(screen.getByRole("textbox"), "Summarize the launch review notes.");
  await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
  expect(await screen.findByText("Auto · Gemini 3.6 Flash")).toBeTruthy();
  await user.type(screen.getByRole("textbox"), "Summarize the updated review notes.");
  await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
  expect(screen.getByRole("status").textContent).toBe("Generating…");
  expect(screen.queryByText(/Gemini|Automatically selected|Draft saved|Prior failure|Generation did not start/)).toBeNull();
  await act(async () => request.resolve({ error: "No eligible model profile is available.", failureCategory: "routing" }));
  expect(screen.queryByText(/Gemini|Automatically selected|Draft saved/)).toBeNull();
});

test.each([
  ["routing", "No eligible model profile is available."],
  ["resolution", "The selected model profile is not configured."],
  ["resolution", "The selected model profile could not be resolved."],
  ["generation", "The selected model timed out. No draft was saved."],
  ["generation", "The selected model could not complete the request. No draft was saved."],
  ["generation", "The selected model is rate limited. No draft was saved."],
  ["generation", "The selected model returned an invalid draft. No draft was saved."],
] as const)("%s failure displays the safe error without claiming successful or alternate generation: %s", async (failureCategory, error) => {
  vi.mocked(generateMissionAiDraftAction).mockResolvedValue({
    error, failureCategory, ...(failureCategory === "routing" ? {} : { route: productionRoute() }),
  });
  const user = userEvent.setup();
  render(<GenerateDraftForm {...ids} />);
  await user.type(screen.getByRole("textbox"), "Summarize the launch review notes.");
  await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
  const status = screen.getByRole("status");
  expect(within(status).getByText(error)).toBeTruthy();
  expect(screen.queryByText("Draft saved for human review.")).toBeNull();
  expect(screen.queryByText(/fallback|rerout|synthetic-|GPT|Claude/i)).toBeNull();
  if (failureCategory === "routing") {
    expect(screen.queryByText(/Gemini|Automatically selected/)).toBeNull();
  } else {
    expect(within(status).getByText("Auto · Gemini 3.6 Flash")).toBeTruthy();
  }
  if (failureCategory === "resolution") {
    expect(within(status).getByText("Generation did not start.")).toBeTruthy();
  }
});

test.each(["balanced", "latency"] as const)("synthetic %s decisions cannot surface profile names through presentation", async (preference) => {
  const result = routeModel({ ...routeRequest, preference }, { registry: syntheticRegistry, execution_class: "synthetic" });
  if (!result.ok) throw new Error("Expected a synthetic test decision");
  vi.mocked(generateMissionAiDraftAction).mockResolvedValue({
    error: "The selected model profile could not be resolved.", failureCategory: "resolution",
    route: toRoutePresentation(result.decision),
  });
  const user = userEvent.setup();
  const { container } = render(<GenerateDraftForm {...ids} />);
  await user.type(screen.getByRole("textbox"), "Summarize the launch review notes.");
  await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
  expect(await screen.findByText("Generation did not start.")).toBeTruthy();
  expect(container.textContent).not.toMatch(/synthetic-|test-only|Gemini|Automatically selected/);
});

test.each([false, true])("keyboard generation and live status remain accessible with reduced motion = %s", async (reducedMotion) => {
  vi.stubGlobal("matchMedia", () => ({ matches: reducedMotion, media: "(prefers-reduced-motion: reduce)", addListener: vi.fn(), removeListener: vi.fn() }));
  const request = deferred<MissionAiDraftActionState>();
  vi.mocked(generateMissionAiDraftAction).mockReturnValue(request.promise);
  const user = userEvent.setup();
  render(<GenerateDraftForm {...ids} />);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Task" }));
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
  await user.keyboard("Summarize the launch review notes.");
  await user.tab();
  const submit = screen.getByRole("button", { name: "Generate AI draft" });
  expect(document.activeElement).toBe(submit);
  expect(submit.className).toContain("focus-visible:ring");
  await user.keyboard("{Enter}");
  expect(screen.getByRole("status").textContent).toBe("Generating…");
  await act(async () => request.resolve({ error: null, draftId: "draft-1", route: productionRoute() }));
  expect(screen.getByRole("status").textContent).toContain("Auto · Gemini 3.6 Flash");
  expect(screen.getByRole("status").textContent).toContain("Automatically selected");
  expect(screen.getByRole("status").textContent).toContain("Draft saved for human review.");
});

test("composer displays the server generation error without a success claim", async () => {
  vi.mocked(generateMissionAiDraftAction).mockResolvedValue({ error: "Provider unavailable." });
  const user = userEvent.setup();
  render(<GenerateDraftForm {...ids} />);
  await user.type(screen.getByRole("textbox", { name: "Prompt / Context" }), "Summarize the launch review notes.");
  await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
  expect(await screen.findByText("Provider unavailable.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Generate AI draft" })).toBeTruthy();
});

test("draft presents AI identity, review status, confidence and actions", () => {
  render(<MissionAiDraftCard draft={draft} {...ids} />);
  expect(screen.getByText("AI-generated")).toBeTruthy();
  expect(screen.getByText("Pending review")).toBeTruthy();
  expect(screen.getByText(/High confidence.*82%/)).toBeTruthy();
  expect(screen.getByText("Draft plan")).toBeTruthy();
  expect(screen.getByText("Check launch date")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
});

test("approve disables duplicate actions until server confirms Applied", async () => {
  const request = deferred<{ error: null; draftId: string }>();
  vi.mocked(approveMissionAiDraftAction).mockReturnValue(request.promise);
  const user = userEvent.setup();
  render(<MissionAiDraftCard draft={draft} {...ids} />);
  await user.click(screen.getByRole("button", { name: "Approve" }));
  expect(screen.getByRole("button", { name: "Approving…" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Dismiss" }).hasAttribute("disabled")).toBe(true);
  await act(async () => request.resolve({ error: null, draftId: draft.id }));
  expect(screen.getByText("Applied")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
});

test("dismiss disables duplicate actions until server confirms Dismissed", async () => {
  const request = deferred<{ error: null; draftId: string }>();
  vi.mocked(dismissMissionAiDraftAction).mockReturnValue(request.promise);
  const user = userEvent.setup();
  render(<MissionAiDraftCard draft={draft} {...ids} />);
  await user.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.getByRole("button", { name: "Dismissing…" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Approve" }).hasAttribute("disabled")).toBe(true);
  await act(async () => request.resolve({ error: null, draftId: draft.id }));
  expect(screen.getByText("Dismissed")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
});

test.each([
  ["Approve", approveMissionAiDraftAction, "Approval denied."],
  ["Dismiss", dismissMissionAiDraftAction, "Dismissal denied."],
] as const)("failed %s keeps review controls and exposes real error", async (label, action, error) => {
  vi.mocked(action).mockResolvedValue({ error });
  const user = userEvent.setup();
  render(<MissionAiDraftCard draft={draft} {...ids} />);
  await user.click(screen.getByRole("button", { name: label }));
  expect(await screen.findByText(error)).toBeTruthy();
  expect(screen.getByText("Pending review")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
});

test.each(["applied", "dismissed"])("%s record has no review controls", (status) => {
  render(<MissionAiDraftCard draft={{ ...draft, status }} {...ids} />);
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
});

test("keyboard review and reduced motion keep status text accessible", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, media: "(prefers-reduced-motion: reduce)", addListener: vi.fn(), removeListener: vi.fn() }));
  const user = userEvent.setup();
  const card = render(<MissionAiDraftCard draft={draft} {...ids} />);
  const approve = within(card.container).getByRole("button", { name: "Approve" });
  approve.focus();
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.getByText("Pending review")).toBeTruthy();
  vi.unstubAllGlobals();
});
