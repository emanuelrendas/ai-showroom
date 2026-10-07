import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { RouteError } from "@/components/ui/route-error";
import { RouteLoading } from "@/components/ui/route-loading";

test("route failure offers keyboard recovery without exposing raw error details", async () => {
  function RecoverableRoute() {
    const [failed, setFailed] = useState(true);
    return failed ? <RouteError error={new Error("Private database details")} reset={() => setFailed(false)} /> : <h1>Workspace restored</h1>;
  }
  const user = userEvent.setup();
  render(<RecoverableRoute />);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Private database details")).toBeNull();
  screen.getByRole("button", { name: "Try again" }).focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("heading", { name: "Workspace restored" })).toBeTruthy();
});

test("route loading announces unresolved work without invented progress", () => {
  render(<RouteLoading />);
  const status = screen.getByRole("status");
  expect(status.getAttribute("aria-busy")).toBe("true");
  expect(status.textContent).toContain("Loading");
  expect(status.textContent).not.toMatch(/\d+%|Thinking|Analyzing/);
});
