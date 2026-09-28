import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Input } from "@/components/ui/input";

function ControlledInput() {
  const [name, setName] = useState("");

  return (
    <>
      <Input
        aria-label="Mission name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <output aria-label="Entered name">{name || "No name entered"}</output>
    </>
  );
}

test("Input updates the displayed React state when the user types and clears", async () => {
  const user = userEvent.setup();
  render(<ControlledInput />);

  const input = screen.getByRole<HTMLInputElement>("textbox", {
    name: "Mission name",
  });
  const output = screen.getByRole("status", { name: "Entered name" });

  expect(input.value).toBe("");
  expect(output.textContent).toBe("No name entered");

  await user.type(input, "Mission alpha");

  expect(input.value).toBe("Mission alpha");
  expect(output.textContent).toBe("Mission alpha");

  await user.clear(input);

  expect(input.value).toBe("");
  expect(output.textContent).toBe("No name entered");
});
