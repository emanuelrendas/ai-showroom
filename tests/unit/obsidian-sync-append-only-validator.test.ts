import { describe, expect, it } from "vitest";
import { validateAppendOnlyMutation } from "@/tools/obsidian-sync/append-only-validator";
import type { VaultMutationRequest } from "@/tools/obsidian-sync/types";

const TASK_ID = "TASK-AS-0003";

const existingHistory = `# Spark State History

## State Update — 2026-09-02T17:00+04:00

Agent: Spark
Task: TASK-AS-0003
Previous Status: planned
New Status: active
Reason: TASK-AS-0003 activated.
Evidence: dcc0462ba275e212c35459b45868da9367ceb47d`;

const validUpdate = `## State Update — 2026-09-02T18:00+04:00

Agent: Spark
Task: TASK-AS-0003
Previous Status: active
New Status: active
Reason: Gate A completed successfully.
Evidence: cacacd8c773b5737e5e6ba213c2a25efdd912d9d`;

const validCorrection = `## State Correction — 2026-09-02T18:05+04:00

Corrects: State Update — 2026-09-02T18:00+04:00
Reason: Evidence reference required clarification.
Correct State: active`;

function request(
  overrides: Partial<VaultMutationRequest> = {},
): VaultMutationRequest {
  return {
    project: "ai-showroom",
    task: TASK_ID,
    actor: "spark",
    operation: "append",
    mutationKind: "append-state",
    target: "04 - AI WORKSPACE/SPARK/STATE-UPDATES/TASK-AS-0003.md",
    ...overrides,
  };
}

function appendEvent(current: string, event: string): string {
  return `${current}\n\n${event}`;
}

describe("Gate B append-only integrity", () => {
  it("accepts one valid state update appended without changing history", () => {
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, validUpdate),
      }),
    ).toEqual({
      ok: true,
      code: "APPEND_ONLY_VALID",
      appendedContent: validUpdate,
    });
  });

  it("rejects a mutation that is not explicitly append-state", () => {
    expect(
      validateAppendOnlyMutation({
        request: request({
          mutationKind: "state-metadata",
        }),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, validUpdate),
      }),
    ).toEqual({
      ok: false,
      code: "NOT_APPEND_STATE_OPERATION",
    });
  });

  it("rejects deletion of historical content", () => {
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: existingHistory.slice(0, -10),
      }),
    ).toEqual({
      ok: false,
      code: "CURRENT_HISTORY_DELETED",
    });
  });

  it("rejects editing an earlier historical character", () => {
    const changed = existingHistory.replace("planned", "blocked");
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(changed, validUpdate),
      }),
    ).toEqual({
      ok: false,
      code: "CURRENT_HISTORY_MODIFIED",
    });
  });

  it("rejects editing an earlier timestamp", () => {
    const changed = existingHistory.replace("17:00", "17:01");
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(changed, validUpdate),
      }),
    ).toEqual({
      ok: false,
      code: "CURRENT_HISTORY_MODIFIED",
    });
  });

  it("rejects reordered historical content", () => {
    const reordered = existingHistory.replace(
      `Previous Status: planned\nNew Status: active`,
      `New Status: active\nPrevious Status: planned`,
    );
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(reordered, validUpdate),
      }),
    ).toEqual({
      ok: false,
      code: "CURRENT_HISTORY_MODIFIED",
    });
  });

  it("rejects an append request that adds nothing", () => {
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: existingHistory,
      }),
    ).toEqual({
      ok: false,
      code: "NO_CONTENT_APPENDED",
    });
  });
});

describe("Gate B append boundary", () => {
  it("rejects arbitrary prose appended instead of a governed state event", () => {
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, "hello world"),
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_APPEND_BOUNDARY",
    });
  });

  it("rejects an event without a clean Markdown paragraph boundary", () => {
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: `${existingHistory}\n${validUpdate}`,
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_APPEND_BOUNDARY",
    });
  });

  it("allows an event after history that already ends with a blank line", () => {
    const current = `${existingHistory}\n\n`;
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: current,
        proposedContent: `${current}${validUpdate}`,
      }),
    ).toMatchObject({
      ok: true,
      code: "APPEND_ONLY_VALID",
    });
  });

  it("accepts an empty log receiving its first valid state event", () => {
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: "",
        proposedContent: validUpdate,
      }),
    ).toEqual({
      ok: true,
      code: "APPEND_ONLY_VALID",
      appendedContent: validUpdate,
    });
  });
});

describe("Gate B State Update structure", () => {
  it.each([
    "Agent",
    "Task",
    "Previous Status",
    "New Status",
    "Reason",
    "Evidence",
  ])("rejects a State Update missing %s", (field) => {
    const malformed = validUpdate
      .split("\n")
      .filter((line) => !line.startsWith(`${field}:`))
      .join("\n");

    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, malformed),
      }),
    ).toEqual({
      ok: false,
      code: "MALFORMED_STATE_EVENT",
    });
  });

  it("rejects an empty required field", () => {
    const malformed = validUpdate.replace(
      "Reason: Gate A completed successfully.",
      "Reason:",
    );
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, malformed),
      }),
    ).toEqual({
      ok: false,
      code: "MALFORMED_STATE_EVENT",
    });
  });

  it("rejects duplicate required fields", () => {
    const malformed = `${validUpdate}\nAgent: Spark`;
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, malformed),
      }),
    ).toEqual({
      ok: false,
      code: "MALFORMED_STATE_EVENT",
    });
  });

  it("rejects a malformed state timestamp", () => {
    const malformed = validUpdate.replace(
      "2026-09-02T18:00+04:00",
      "yesterday",
    );
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, malformed),
      }),
    ).toEqual({
      ok: false,
      code: "MALFORMED_STATE_EVENT",
    });
  });
});

describe("Gate B actor and task binding", () => {
  it("rejects an event claiming another actor", () => {
    const forged = validUpdate.replace("Agent: Spark", "Agent: Sol");
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, forged),
      }),
    ).toEqual({
      ok: false,
      code: "ACTOR_MISMATCH",
    });
  });

  it("allows Sol when the event identifies Sol", () => {
    const solUpdate = validUpdate.replace("Agent: Spark", "Agent: Sol");
    expect(
      validateAppendOnlyMutation({
        request: request({ actor: "sol" }),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, solUpdate),
      }),
    ).toMatchObject({
      ok: true,
      code: "APPEND_ONLY_VALID",
    });
  });

  it("rejects an event for a different task", () => {
    const forged = validUpdate.replace(
      "Task: TASK-AS-0003",
      "Task: TASK-AS-0002",
    );
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, forged),
      }),
    ).toEqual({
      ok: false,
      code: "TASK_MISMATCH",
    });
  });
});

describe("Gate B State Correction structure", () => {
  it("accepts a valid append-only correction", () => {
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, validCorrection),
      }),
    ).toEqual({
      ok: true,
      code: "APPEND_ONLY_VALID",
      appendedContent: validCorrection,
    });
  });

  it.each([
    "Corrects",
    "Reason",
    "Correct State",
  ])("rejects a correction missing %s", (field) => {
    const malformed = validCorrection
      .split("\n")
      .filter((line) => !line.startsWith(`${field}:`))
      .join("\n");

    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(existingHistory, malformed),
      }),
    ).toEqual({
      ok: false,
      code: "MALFORMED_STATE_EVENT",
    });
  });

  it("rejects editing old history even when a valid correction is appended", () => {
    const alteredHistory = existingHistory.replace(
      "New Status: active",
      "New Status: blocked",
    );
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: appendEvent(alteredHistory, validCorrection),
      }),
    ).toEqual({
      ok: false,
      code: "CURRENT_HISTORY_MODIFIED",
    });
  });
});

describe("Gate B one-event transaction", () => {
  it("rejects two State Update events in one transaction", () => {
    const secondUpdate = validUpdate.replace("18:00", "18:01");
    const proposed = `${existingHistory}\n\n${validUpdate}\n\n${secondUpdate}`;
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: proposed,
      }),
    ).toEqual({
      ok: false,
      code: "MULTIPLE_STATE_EVENTS",
    });
  });

  it("rejects a State Update plus State Correction in one transaction", () => {
    const proposed = `${existingHistory}\n\n${validUpdate}\n\n${validCorrection}`;
    expect(
      validateAppendOnlyMutation({
        request: request(),
        currentContent: existingHistory,
        proposedContent: proposed,
      }),
    ).toEqual({
      ok: false,
      code: "MULTIPLE_STATE_EVENTS",
    });
  });
});

describe("Gate B hermetic policy behavior", () => {
  it("returns the same decision for identical supplied data", () => {
    const input = {
      request: request(),
      currentContent: existingHistory,
      proposedContent: appendEvent(existingHistory, validUpdate),
    };
    const first = validateAppendOnlyMutation(input);
    const second = validateAppendOnlyMutation(input);
    expect(first).toEqual(second);
  });
});