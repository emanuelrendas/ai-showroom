import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AI_SHOWROOM_SHARED_VAULT_NAMESPACE,
  normalizeVaultTarget,
  validateVaultMutation,
} from "@/tools/obsidian-sync/contract-validator";

import type {
  ArtifactPolicyState,
  AuthorizedTaskScope,
  VaultMutationRequest,
} from "@/tools/obsidian-sync/types";

const TASK =
  "TASK-AS-0003";

const SOL_TARGET =
  `${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/NOTES/TASK-AS-0003.md`;

const SPARK_TARGET =
  `${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SPARK/STATE-UPDATES/TASK-AS-0003.md`;

const defaultArtifact: ArtifactPolicyState = {
  exists: true,
  type: "task",
  status: "active",
  frozen: false,
  owner: "sol",
  activeWriter: null,
  writeLockTask: null,
};

function makeRequest(
  actor: VaultMutationRequest["actor"],
  target: string,
  overrides: Partial<VaultMutationRequest> = {},
): VaultMutationRequest {
  return {
    project: "ai-showroom",
    task: TASK,
    actor,
    operation: "update",
    mutationKind: "substantive",
    target,
    ...overrides,
  };
}

function makeScope(
  prefixes: readonly string[],
  task: string = TASK,
): AuthorizedTaskScope {
  return {
    project: "ai-showroom",
    task,
    allowedTargetPrefixes: prefixes,
  };
}

describe("Gate A — target normalization", () => {
  it("normalizes standard relative paths and forward slashes", () => {
    expect(normalizeVaultTarget("a/b/c.md")).toBe("a/b/c.md");
  });

  it("normalizes Windows backslashes", () => {
    expect(normalizeVaultTarget("a\\b\\c.md")).toBe("a/b/c.md");
  });

  it("rejects empty, absolute, or traversing targets", () => {
    expect(normalizeVaultTarget("")).toBeNull();
    expect(normalizeVaultTarget("/root.md")).toBeNull();
    expect(normalizeVaultTarget("C:/root.md")).toBeNull();
    expect(normalizeVaultTarget("../escape.md")).toBeNull();
    expect(normalizeVaultTarget("a/../b.md")).toBeNull();
    expect(normalizeVaultTarget("a/./b.md")).toBeNull();
  });
});

describe("Gate A — project and task scope checks", () => {
  it("rejects project mismatch", () => {
    const req = makeRequest("sol", SOL_TARGET, { project: "wrong-project" });
    const res = validateVaultMutation({
      request: req,
      artifact: defaultArtifact,
      taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`]),
    });
    expect(res).toMatchObject({
      ok: false,
      code: "PROJECT_MISMATCH",
    });
  });

  it("rejects task mismatch", () => {
    const req = makeRequest("sol", SOL_TARGET, { task: "TASK-OTHER" });
    const res = validateVaultMutation({
      request: req,
      artifact: defaultArtifact,
      taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`]),
    });
    expect(res).toMatchObject({
      ok: false,
      code: "TASK_SCOPE_MISMATCH",
    });
  });
});

describe("Gate A — shared RAIOC V2 vault namespace", () => {
  it("allows Sol only inside the canonical Sol tenant", () => {
    expect(
      validateVaultMutation({
        request: makeRequest("sol", SOL_TARGET),
        artifact: defaultArtifact,
        taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`]),
      }),
    ).toEqual({
      ok: true,
      code: "AUTHORIZED",
      target: SOL_TARGET,
    });
  });

  it("allows Spark only inside the canonical Spark tenant", () => {
    expect(
      validateVaultMutation({
        request: makeRequest("spark", SPARK_TARGET),
        artifact: defaultArtifact,
        taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SPARK/`]),
      }),
    ).toEqual({
      ok: true,
      code: "AUTHORIZED",
      target: SPARK_TARGET,
    });
  });

  it.each([
    "00 - COMMAND CENTER/CURRENT-STATE.md",
    "01 - ARCHITECTURE/SYSTEM-ARCHITECTURE.md",
    "02 - MILESTONES/OBSIDIAN-AI-SYNC.md",
    "03 - TASKS/ACTIVE/TASK-AS-0003.md",
    "04 - AI WORKSPACE/SPARK/STATE-UPDATES/TASK-AS-0003.md",
    "05 - REVIEWS/FLASH-AUDITS/AUDIT.md",
    "06 - KNOWLEDGE/NOTES.md",
    "07 - HANDOFFS/AI-TO-AI/HANDOFF.md",
    "08 - EVIDENCE/TESTS/EVIDENCE.md",
    "04 - MISSIONS/ACTIVE/MISSION-TEST.md",
  ])("hard-rejects Sol outside the AI Showroom namespace: %s", (target) => {
    expect(
      validateVaultMutation({
        request: makeRequest("sol", target),
        artifact: defaultArtifact,
        taskScope: makeScope([
          "00 - COMMAND CENTER/",
          "01 - ARCHITECTURE/",
          "02 - MILESTONES/",
          "03 - TASKS/",
          "04 - AI WORKSPACE/",
          "04 - MISSIONS/",
          "05 - REVIEWS/",
          "06 - KNOWLEDGE/",
          "07 - HANDOFFS/",
          "08 - EVIDENCE/",
        ]),
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
      target,
    });
  });

  it.each([
    "00 - COMMAND CENTER/CURRENT-STATE.md",
    "03 - TASKS/ACTIVE/TASK-AS-0003.md",
    "04 - AI WORKSPACE/SOL/NOTES/file.md",
    "04 - MISSIONS/ACTIVE/MISSION-API-TEST.md",
    "08 - EVIDENCE/result.md",
  ])("hard-rejects Spark outside the AI Showroom namespace: %s", (target) => {
    expect(
      validateVaultMutation({
        request: makeRequest("spark", target),
        artifact: defaultArtifact,
        taskScope: makeScope([
          "00 - COMMAND CENTER/",
          "03 - TASKS/",
          "04 - AI WORKSPACE/",
          "04 - MISSIONS/",
          "08 - EVIDENCE/",
        ]),
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
      target,
    });
  });

  it("rejects Sol attempting to write into Spark's tenant", () => {
    expect(
      validateVaultMutation({
        request: makeRequest("sol", SPARK_TARGET),
        artifact: defaultArtifact,
        taskScope: makeScope([AI_SHOWROOM_SHARED_VAULT_NAMESPACE]),
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
    });
  });

  it("rejects Spark attempting to write into Sol's tenant", () => {
    expect(
      validateVaultMutation({
        request: makeRequest("spark", SOL_TARGET),
        artifact: defaultArtifact,
        taskScope: makeScope([AI_SHOWROOM_SHARED_VAULT_NAMESPACE]),
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
    });
  });

  it("rejects a deceptive sibling namespace", () => {
    const deceptiveTarget = "04 - AI WORKSPACE/AI-SHOWROOM-OLD/SPARK/state.md";
    expect(
      validateVaultMutation({
        request: makeRequest("spark", deceptiveTarget),
        artifact: defaultArtifact,
        taskScope: makeScope(["04 - AI WORKSPACE/"]),
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
    });
  });

  it("rejects the parent AI WORKSPACE folder itself", () => {
    const target = "04 - AI WORKSPACE/random.md";
    expect(
      validateVaultMutation({
        request: makeRequest("sol", target),
        artifact: defaultArtifact,
        taskScope: makeScope(["04 - AI WORKSPACE/"]),
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
    });
  });

  it("normalizes backslashes but still enforces the Spark tenant", () => {
    const windowsStyle =
      "04 - AI WORKSPACE\\AI-SHOWROOM\\SPARK\\STATE-UPDATES\\TASK-AS-0003.md";

    expect(
      validateVaultMutation({
        request: makeRequest("spark", windowsStyle),
        artifact: defaultArtifact,
        taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SPARK/`]),
      }),
    ).toEqual({
      ok: true,
      code: "AUTHORIZED",
      target: SPARK_TARGET,
    });
  });

  it("preserves FLASH_READ_ONLY as the stronger Flash invariant", () => {
    expect(
      validateVaultMutation({
        request: makeRequest("flash", SPARK_TARGET),
        artifact: defaultArtifact,
        taskScope: makeScope([AI_SHOWROOM_SHARED_VAULT_NAMESPACE]),
      }),
    ).toMatchObject({
      ok: false,
      code: "FLASH_READ_ONLY",
    });
  });

  it("constrains Tiago's automated pipeline writes to the AI Showroom tenant", () => {
    const outside = "00 - COMMAND CENTER/CURRENT-STATE.md";
    expect(
      validateVaultMutation({
        request: makeRequest("tiago", outside),
        artifact: defaultArtifact,
        taskScope: makeScope(["00 - COMMAND CENTER/"]),
      }),
    ).toMatchObject({
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
    });
  });

  it("allows Tiago automated authority anywhere inside the AI Showroom tenant", () => {
    const target = `${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/HUMAN-REVIEW.md`;
    expect(
      validateVaultMutation({
        request: makeRequest("tiago", target),
        artifact: defaultArtifact,
        taskScope: makeScope([AI_SHOWROOM_SHARED_VAULT_NAMESPACE]),
      }),
    ).toMatchObject({
      ok: true,
      code: "AUTHORIZED",
      target,
    });
  });
});

describe("Gate A — artifact state rules", () => {
  it("rejects writes to frozen artifacts", () => {
    const res = validateVaultMutation({
      request: makeRequest("sol", SOL_TARGET),
      artifact: { ...defaultArtifact, frozen: true },
      taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`]),
    });
    expect(res).toMatchObject({
      ok: false,
      code: "FROZEN_ARTIFACT",
    });
  });

  it("rejects writes when locked by another actor", () => {
    const res = validateVaultMutation({
      request: makeRequest("sol", SOL_TARGET),
      artifact: { ...defaultArtifact, activeWriter: "spark" },
      taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`]),
    });
    expect(res).toMatchObject({
      ok: false,
      code: "WRITE_LOCKED_BY_OTHER_ACTOR",
    });
  });

  it("rejects writes when locked by another task", () => {
    const res = validateVaultMutation({
      request: makeRequest("sol", SOL_TARGET),
      artifact: { ...defaultArtifact, writeLockTask: "TASK-AS-0001" },
      taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`]),
    });
    expect(res).toMatchObject({
      ok: false,
      code: "WRITE_LOCKED_BY_OTHER_TASK",
    });
  });

  it("allows Spark state-metadata updates in review status", () => {
    const res = validateVaultMutation({
      request: makeRequest("spark", SPARK_TARGET, { mutationKind: "state-metadata" }),
      artifact: { ...defaultArtifact, status: "review", type: "task" },
      taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SPARK/`]),
    });
    expect(res).toMatchObject({
      ok: true,
      code: "AUTHORIZED",
    });
  });

  it("rejects substantive writes during review status", () => {
    const res = validateVaultMutation({
      request: makeRequest("sol", SOL_TARGET, { mutationKind: "substantive" }),
      artifact: { ...defaultArtifact, status: "review", type: "task" },
      taskScope: makeScope([`${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`]),
    });
    expect(res).toMatchObject({
      ok: false,
      code: "REVIEW_WRITE_FORBIDDEN",
    });
  });
});