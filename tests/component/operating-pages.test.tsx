import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import AppPage from "@/app/(app)/app/page";
import WorkspacePage from "@/app/(app)/w/[workspaceSlug]/page";
import ProjectPage from "@/app/(app)/w/[workspaceSlug]/projects/[projectId]/page";
import { getMyWorkspaces, getWorkspaceBySlug } from "@/features/workspaces/queries";
import { getProjectById, getProjectsForWorkspace } from "@/features/projects/queries";
import { getMissionsForProject } from "@/features/missions/queries";

vi.mock("@/features/workspaces/queries", () => ({ getMyWorkspaces: vi.fn(), getWorkspaceBySlug: vi.fn() }));
vi.mock("@/features/projects/queries", () => ({ getProjectById: vi.fn(), getProjectsForWorkspace: vi.fn() }));
vi.mock("@/features/missions/queries", () => ({ getMissionsForProject: vi.fn() }));
vi.mock("@/features/workspaces/actions", () => ({ createWorkspaceAction: vi.fn() }));
vi.mock("@/features/projects/actions", () => ({ createProjectAction: vi.fn() }));
vi.mock("@/features/missions/actions", () => ({ createMissionAction: vi.fn() }));
const workspace = { id: "w1", name: "Atelier", slug: "atelier", created_by: "u1", created_at: "2026-09-28T12:00:00Z", updated_at: "2026-09-28T12:00:00Z" };
const project = { ...workspace, id: "p1", workspace_id: "w1", name: "Northstar", description: "Launch operations", status: "active" };
const mission = { ...workspace, id: "m1", project_id: "p1", title: "Review launch", description: "Review the launch plan", status: "in_progress", priority: "high" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMyWorkspaces).mockResolvedValue([workspace]);
  vi.mocked(getWorkspaceBySlug).mockResolvedValue(workspace);
  vi.mocked(getProjectById).mockResolvedValue(project);
  vi.mocked(getProjectsForWorkspace).mockResolvedValue([project]);
  vi.mocked(getMissionsForProject).mockResolvedValue([mission]);
});

test("workspace entry permits creation alongside existing environments", async () => {
  const user = userEvent.setup();
  render(await AppPage());
  expect(screen.getByRole("link", { name: /Atelier/ }).getAttribute("href")).toBe("/w/atelier");
  const disclosure = screen.getByText("Create workspace", { selector: "summary" });
  await user.click(disclosure);
  expect(screen.getByRole("textbox", { name: "Workspace name" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Workspace slug" })).toBeTruthy();
});

test("first workspace form is available without opening a disclosure", async () => {
  vi.mocked(getMyWorkspaces).mockResolvedValue([]);
  render(await AppPage());
  expect(screen.getByRole("textbox", { name: "Workspace name" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Atelier/ })).toBeNull();
});

test("workspace project list links real records and exposes creation on demand", async () => {
  const user = userEvent.setup();
  render(await WorkspacePage({ params: Promise.resolve({ workspaceSlug: "atelier" }) }));
  const list = screen.getByRole("list", { name: "Projects" });
  expect(within(list).getByRole("link", { name: /Northstar/ }).getAttribute("href")).toBe("/w/atelier/projects/p1");
  const summary = screen.getByText("Create project", { selector: "summary" });
  await user.click(summary);
  expect(summary.closest("details")?.open).toBe(true);
  expect(screen.getByRole("textbox", { name: "Project name" })).toBeTruthy();
});

test("mission list exposes readable lifecycle status distinct from priority", async () => {
  render(await ProjectPage({ params: Promise.resolve({ workspaceSlug: "atelier", projectId: "p1" }) }));
  const list = screen.getByRole("list", { name: "Missions" });
  const record = within(list).getByRole("link", { name: /Review launch/ });
  expect(record.getAttribute("href")).toBe("/w/atelier/projects/p1/missions/m1");
  expect(within(record).getByText("In progress")).toBeTruthy();
  expect(within(record).getByText("High priority")).toBeTruthy();
  const summary = screen.getByText("Create mission", { selector: "summary" });
  expect(summary.closest("details")?.open).toBe(false);
});
