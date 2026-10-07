import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { WorkspaceShell } from "@/features/workspaces/workspace-shell";
import type { Workspace } from "@/features/workspaces/types";

let pathname = "/w/atelier";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));

const workspace = {
  id: "workspace-1",
  name: "Atelier",
  slug: "atelier",
  created_by: "user-1",
  created_at: "2026-09-28T00:00:00Z",
  updated_at: "2026-09-28T00:00:00Z",
} satisfies Workspace;

function renderShell() {
  return render(
    <WorkspaceShell
      workspace={workspace}
      displayName="Emanuel"
      projects={[{ id: "project-1", name: "Northstar" }]}
    >
      <label htmlFor="draft-name">Draft name</label>
      <input id="draft-name" />
    </WorkspaceShell>,
  );
}

beforeEach(() => {
  pathname = "/w/atelier";
});

test("desktop navigation collapses and expands without discarding page input", async () => {
  const user = userEvent.setup();
  renderShell();
  const shell = screen.getByTestId("workspace-shell");
  const input = screen.getByRole("textbox", { name: "Draft name" });
  await user.type(input, "Keep this");

  await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
  expect(shell.getAttribute("data-collapsed")).toBe("true");
  expect((input as HTMLInputElement).value).toBe("Keep this");

  await user.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(shell.getAttribute("data-collapsed")).toBe("false");
});

test("mobile drawer opens, closes on Escape, and returns focus to its trigger", async () => {
  const user = userEvent.setup();
  renderShell();
  const trigger = screen.getByRole("button", { name: "Open navigation" });
  await user.click(trigger);

  const drawer = screen.getByRole("dialog", { name: "Navigation" });
  expect(drawer.getAttribute("data-open")).toBe("true");
  expect(within(drawer).getByRole("button", { name: "Close navigation" })).toBe(document.activeElement);

  await user.keyboard("{Escape}");
  expect(drawer.getAttribute("data-open")).toBe("false");
  expect(trigger).toBe(document.activeElement);

  await user.click(trigger);
  await user.click(within(drawer).getByRole("button", { name: "Close navigation" }));
  expect(drawer.getAttribute("data-open")).toBe("false");
  expect(trigger).toBe(document.activeElement);
});

test("active navigation follows the current route and renders known projects", () => {
  pathname = "/w/atelier/projects/project-1";
  renderShell();
  const desktop = screen.getByRole("navigation", { name: "Workspace navigation" });
  expect(within(desktop).getByRole("link", { name: "Northstar" }).getAttribute("aria-current")).toBe("page");
  expect(within(desktop).getByRole("link", { name: "Overview" }).hasAttribute("aria-current")).toBe(false);
  expect(screen.queryByText("No projects yet")).toBeNull();
});

test("overview is current only on the workspace route", () => {
  renderShell();
  const desktop = screen.getByRole("navigation", { name: "Workspace navigation" });
  expect(within(desktop).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
  expect(within(desktop).getByRole("link", { name: "Northstar" }).hasAttribute("aria-current")).toBe(false);
});

test("the drawer traps keyboard focus while open", async () => {
  const user = userEvent.setup();
  renderShell();
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  const drawer = screen.getByRole("dialog", { name: "Navigation" });
  const first = within(drawer).getByRole("link", { name: "AI SHOWROOM, Atelier, all workspaces" });
  const signOut = within(drawer).getByRole("button", { name: "Sign out" });

  first.focus();
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(signOut);
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(first);
});

test("collapse keeps navigation labels mounted and reverses immediately", async () => {
  const user = userEvent.setup();
  renderShell();
  const navigation = screen.getByRole("navigation", { name: "Workspace navigation" });
  const project = within(navigation).getByRole("link", { name: "Northstar" });
  const label = within(project).getByText("Northstar");
  await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
  expect(label.className).not.toContain("sr-only");
  expect(project.contains(label)).toBe(true);
  await user.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(within(project).getByText("Northstar")).toBe(label);
});

test("drawer isolates background, locks scrolling, and restores both on dismissal", async () => {
  const user = userEvent.setup();
  renderShell();
  const trigger = screen.getByRole("button", { name: "Open navigation" });
  const input = screen.getByRole("textbox");
  await user.click(trigger);
  expect(input.closest("[inert]")).not.toBeNull();
  expect(document.body.style.overflow).toBe("hidden");
  await user.click(screen.getByRole("button", { name: "Close navigation backdrop" }));
  expect(input.closest("[inert]")).toBeNull();
  expect(document.body.style.overflow).toBe("");
  expect(document.activeElement).toBe(trigger);
});

test("mission navigation marks only its real parent project as current location", () => {
  pathname = "/w/atelier/projects/project-1/missions/mission-1";
  renderShell();
  const navigation = screen.getByRole("navigation", { name: "Workspace navigation" });
  expect(within(navigation).getByRole("link", { name: "Northstar" }).getAttribute("aria-current")).toBe("location");
  expect(within(navigation).getByRole("link", { name: "Overview" }).hasAttribute("aria-current")).toBe(false);
});
