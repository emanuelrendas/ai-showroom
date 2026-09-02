import { describe, expect, it } from "vitest";
import {
  normalizeVaultTarget,
  validateVaultMutation,
} from "@/tools/obsidian-sync/contract-validator";
import type {
  ArtifactPolicyState,
  AuthorizedTaskScope,
  VaultMutationRequest,
} from "@/tools/obsidian-sync/types";

const TASK_ID = "TASK-AS-0003";

const taskScope: AuthorizedTaskScope = {
  project: "ai-showroom",
  task: TASK_ID,
  allowedTargetPrefixes: [
    "00 - COMMAND CENTER/",
    "03 - TASKS/",
    "04 - AI WORKSPACE/SPARK/",
    "07 - HANDOFFS/",
    "08 - EVIDENCE/",
  ],
};

const artifact: ArtifactPolicyState = {
  exists: true,
  type: "task",
  status: "active",
  frozen: false,
  owner: "sol",
  activeWriter: null,
  writeLockTask: null,
};

function request(
  overrides: Partial<VaultMutationRequest> = {},
): VaultMutationRequest {
  return {
    project: "ai-showroom",
    task: TASK_ID,
    actor: "spark",
    operation: "update",
    mutationKind: "state-metadata",
    target: "03 - TASKS/ACTIVE/TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md",
    ...overrides,
  };
}

describe("normalizeVaultTarget", () => {
  it("normalizes Windows separators to a vault-relative POSIX-style path", () => {
    expect(
      normalizeVaultTarget(
        "03 - TASKS\\ACTIVE\\TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md",
      ),
    ).toBe("03 - TASKS/ACTIVE/TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md");
  });

  it.each([
    "../RAIOC V2/secret.md",
    "03 - TASKS/../../outside.md",
    "03 - TASKS/./ACTIVE/task.md",
    "C:\\Users\\diore\\Documents\\AI Showroom\\note.md",
    "/absolute/note.md",
    "",
    "   ",
  ])("rejects invalid non-vault-relative target %s", (target) => {
    expect(normalizeVaultTarget(target)).toBeNull();
  });
});

describe("explicit project and task identity", () => {
  it("allows an explicit valid AI Showroom request", () => {
    expect(
      validateVaultMutation({
        request: request(),
        artifact,
        taskScope,
      }),
    ).toEqual({
      ok: true,
      code: "AUTHORIZED",
      target: "03 - TASKS/ACTIVE/TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md",
    });
  });

  it("rejects a project other than ai-showroom", () => {
    expect(
      validateVaultMutation({
        request: request({
          project: "raioc",
        }),
        artifact,
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "PROJECT_MISMATCH",
    });
  });

  it("rejects a request whose task does not match explicit task scope", () => {
    expect(
      validateVaultMutation({
        request: request({
          task: "TASK-AS-9999",
        }),
        artifact,
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "TASK_SCOPE_MISMATCH",
    });
  });
});

describe("role and target authority", () => {
  it("rejects Flash mutation requests unconditionally", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "flash",
        }),
        artifact,
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "FLASH_READ_ONLY",
    });
  });

  it("rejects a target outside explicit task scope", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "sol",
          target: "01 - ARCHITECTURE/SYSTEM-ARCHITECTURE.md",
          mutationKind: "substantive",
        }),
        artifact: {
          ...artifact,
          type: "architecture",
          owner: "sol",
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "TARGET_OUTSIDE_TASK_SCOPE",
    });
  });

  it("rejects Spark architecture writes even if task scope is widened", () => {
    const widenedScope: AuthorizedTaskScope = {
      ...taskScope,
      allowedTargetPrefixes: ["01 - ARCHITECTURE/"],
    };

    expect(
      validateVaultMutation({
        request: request({
          actor: "spark",
          target: "01 - ARCHITECTURE/SYSTEM-ARCHITECTURE.md",
          mutationKind: "substantive",
        }),
        artifact: {
          ...artifact,
          type: "architecture",
          owner: "sol",
        },
        taskScope: widenedScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
    });
  });

  it("rejects Spark milestone writes even if task scope is widened", () => {
    const widenedScope: AuthorizedTaskScope = {
      ...taskScope,
      allowedTargetPrefixes: ["02 - MILESTONES/"],
    };

    expect(
      validateVaultMutation({
        request: request({
          actor: "spark",
          target: "02 - MILESTONES/OBSIDIAN-AI-SYNC/OAS-STATE.md",
          mutationKind: "state-metadata",
        }),
        artifact: {
          ...artifact,
          type: "milestone",
          owner: "sol",
        },
        taskScope: widenedScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
    });
  });

  it("allows Sol architecture writes when explicitly inside task scope", () => {
    const solScope: AuthorizedTaskScope = {
      ...taskScope,
      allowedTargetPrefixes: ["01 - ARCHITECTURE/"],
    };

    expect(
      validateVaultMutation({
        request: request({
          actor: "sol",
          target: "01 - ARCHITECTURE/INTEGRATIONS/OBSIDIAN-SYNC.md",
          mutationKind: "substantive",
        }),
        artifact: {
          ...artifact,
          type: "architecture",
          owner: "sol",
        },
        taskScope: solScope,
      }),
    ).toMatchObject({
      ok: true,
      code: "AUTHORIZED",
    });
  });
});

describe("artifact policy state", () => {
  it("rejects every AI write to a frozen artifact", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "sol",
        }),
        artifact: {
          ...artifact,
          frozen: true,
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "FROZEN_ARTIFACT",
    });
  });

  it("rejects an artifact locked by a different writer", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "spark",
        }),
        artifact: {
          ...artifact,
          activeWriter: "sol",
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "WRITE_LOCKED_BY_OTHER_ACTOR",
    });
  });

  it("allows the current active writer", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "spark",
        }),
        artifact: {
          ...artifact,
          activeWriter: "spark",
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: true,
      code: "AUTHORIZED",
    });
  });

  it("rejects an artifact locked to a different task", () => {
    expect(
      validateVaultMutation({
        request: request(),
        artifact: {
          ...artifact,
          writeLockTask: "TASK-AS-0002",
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "WRITE_LOCKED_BY_OTHER_TASK",
    });
  });

  it("allows the task that owns the write lock", () => {
    expect(
      validateVaultMutation({
        request: request(),
        artifact: {
          ...artifact,
          writeLockTask: TASK_ID,
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: true,
      code: "AUTHORIZED",
    });
  });

  it("rejects substantive writes while an artifact is in review", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "sol",
          mutationKind: "substantive",
        }),
        artifact: {
          ...artifact,
          status: "review",
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "REVIEW_WRITE_FORBIDDEN",
    });
  });

  it("allows Spark state metadata on a task during review", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "spark",
          mutationKind: "state-metadata",
          target: "03 - TASKS/REVIEW/TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md",
        }),
        artifact: {
          ...artifact,
          status: "review",
          type: "task",
        },
        taskScope: {
          ...taskScope,
          allowedTargetPrefixes: ["03 - TASKS/"],
        },
      }),
    ).toMatchObject({
      ok: true,
      code: "AUTHORIZED",
    });
  });

  it("allows Spark state metadata on command-state during review", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "spark",
          mutationKind: "state-metadata",
          target: "00 - COMMAND CENTER/CURRENT-STATE.md",
        }),
        artifact: {
          ...artifact,
          status: "review",
          type: "command-state",
          owner: "tiago",
        },
        taskScope: {
          ...taskScope,
          allowedTargetPrefixes: ["00 - COMMAND CENTER/"],
        },
      }),
    ).toMatchObject({
      ok: true,
      code: "AUTHORIZED",
    });
  });

  it("rejects Spark substantive task content changes during review", () => {
    expect(
      validateVaultMutation({
        request: request({
          actor: "spark",
          mutationKind: "substantive",
          target: "03 - TASKS/REVIEW/TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md",
        }),
        artifact: {
          ...artifact,
          status: "review",
          type: "task",
        },
        taskScope,
      }),
    ).toMatchObject({
      ok: false,
      code: "REVIEW_WRITE_FORBIDDEN",
    });
  });
});

describe("hermetic Gate A behavior", () => {
  it("returns a decision using only supplied data", () => {
    const result = validateVaultMutation({
      request: request(),
      artifact,
      taskScope,
    });

    expect(result).toEqual({
      ok: true,
      code: "AUTHORIZED",
      target: "03 - TASKS/ACTIVE/TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md",
    });
  });
});