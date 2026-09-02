import {
  describe,
  expect,
  it,
} from "vitest";

import {
  executeGitTransaction,
} from "@/tools/obsidian-sync/git-transaction";

import type {
  GitAdapter,
  TransactionWorktree,
} from "@/tools/obsidian-sync/git-adapter";

import type {
  GitTransactionRequest,
  PreparedVaultChange,
} from "@/tools/obsidian-sync/types";

const BASE =
  "1111111111111111111111111111111111111111";

const RESULT =
  "2222222222222222222222222222222222222222";

const OTHER =
  "3333333333333333333333333333333333333333";

const TARGET =
  "04 - AI WORKSPACE/SPARK/STATE-UPDATES/TASK-AS-0003.md";

const currentContent = `# State History

## State Update — 2026-09-02T17:00+04:00

Agent: Spark
Task: TASK-AS-0003
Previous Status: planned
New Status: active
Reason: Task activated.
Evidence: baseline`;

const appendedEvent = `## State Update — 2026-09-02T18:00+04:00

Agent: Spark
Task: TASK-AS-0003
Previous Status: active
New Status: active
Reason: Gate B complete.
Evidence: e46bdd1af071610fc27a7a71767eb003e071c060`;

const proposedContent =
  `${currentContent}\n\n${appendedEvent}`;

function validChange(
  overrides:
    Partial<PreparedVaultChange> = {},
): PreparedVaultChange {
  return {
    request: {
      project: "ai-showroom",
      task: "TASK-AS-0003",
      actor: "spark",
      operation: "append",
      mutationKind:
        "append-state",
      target: TARGET,
    },

    artifact: {
      exists: true,
      type: "task",
      status: "active",
      frozen: false,
      owner: "sol",
      activeWriter: null,
      writeLockTask: null,
    },

    taskScope: {
      project:
        "ai-showroom",
      task: "TASK-AS-0003",
      allowedTargetPrefixes: [
        "04 - AI WORKSPACE/SPARK/",
      ],
    },

    currentContent,
    proposedContent,

    ...overrides,
  };
}

function validTransaction(
  overrides:
    Partial<GitTransactionRequest> = {},
): GitTransactionRequest {
  return {
    project: "ai-showroom",
    task: "TASK-AS-0003",
    repoPath:
      "C:/fake/ai-showroom-vault",
    targetBranch: "main",
    expectedBaseSha: BASE,
    changes: [
      validChange(),
    ],
    commitMessage:
      "chore(obsidian): TASK-AS-0003 append state",
    ...overrides,
  };
}

class FakeGitAdapter
  implements GitAdapter {
  calls: string[] = [];

  clean = true;

  localHead = BASE;

  remoteHeads = [
    BASE,
    RESULT,
  ];

  changedPaths:
    readonly string[] = [
      TARGET,
    ];

  resultSha =
    RESULT;

  parentSha =
    BASE;

  pushShouldFail =
    false;

  cleanupShouldFail =
    false;

  pushCalls = 0;

  private remoteIndex =
    0;

  async isClean():
    Promise<boolean> {
    this.calls.push(
      "isClean",
    );

    return this.clean;
  }

  async getLocalHead():
    Promise<string> {
    this.calls.push(
      "getLocalHead",
    );

    return this.localHead;
  }

  async getRemoteHead():
    Promise<string> {
    this.calls.push(
      "getRemoteHead",
    );

    const index =
      Math.min(
        this.remoteIndex,
        this.remoteHeads.length - 1,
      );

    const value =
      this.remoteHeads[index];

    this.remoteIndex += 1;

    if (!value) {
      throw new Error(
        "No fake remote head",
      );
    }

    return value;
  }

  async createTransactionWorktree():
    Promise<TransactionWorktree> {
    this.calls.push(
      "createTransactionWorktree",
    );

    return {
      path: "/fake/worktree",
      cleanupRoot:
        "/fake/root",
    };
  }

  async writeFile(
    _worktreePath: string,
    target: string,
  ): Promise<void> {
    this.calls.push(
      `writeFile:${target}`,
    );
  }

  async getChangedPaths():
    Promise<readonly string[]> {
    this.calls.push(
      "getChangedPaths",
    );

    return this.changedPaths;
  }

  async stagePaths(
    _worktreePath: string,
    paths:
      readonly string[],
  ): Promise<void> {
    this.calls.push(
      `stage:${paths.join(",")}`,
    );
  }

  async commit():
    Promise<string> {
    this.calls.push(
      "commit",
    );

    return this.resultSha;
  }

  async getCommitParent():
    Promise<string> {
    this.calls.push(
      "getCommitParent",
    );

    return this.parentSha;
  }

  async pushCommit():
    Promise<void> {
    this.calls.push(
      "pushCommit",
    );

    this.pushCalls += 1;

    if (
      this.pushShouldFail
    ) {
      throw new Error(
        "push rejected",
      );
    }
  }

  async removeTransactionWorktree():
    Promise<void> {
    this.calls.push(
      "removeTransactionWorktree",
    );

    if (
      this.cleanupShouldFail
    ) {
      throw new Error(
        "cleanup failed",
      );
    }
  }
}

describe(
  "Gate C authority before Git side effects",
  () => {
    it(
      "rejects the wrong project before calling Git",
      async () => {
        const adapter =
          new FakeGitAdapter();

        const result =
          await executeGitTransaction(
            validTransaction({
              project: "raioc",
            }),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "PROJECT_MISMATCH",
        });

        expect(
          adapter.calls,
        ).toEqual([]);
      },
    );

    it(
      "requires a full lowercase 40-character base SHA",
      async () => {
        const adapter =
          new FakeGitAdapter();

        const result =
          await executeGitTransaction(
            validTransaction({
              expectedBaseSha:
                "e46bdd1",
            }),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "INVALID_BASE_SHA",
        });

        expect(
          adapter.calls,
        ).toEqual([]);
      },
    );

    it(
      "rejects a branch other than main before Git",
      async () => {
        const adapter =
          new FakeGitAdapter();

        const result =
          await executeGitTransaction(
            validTransaction({
              targetBranch:
                "feature/test",
            }),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "INVALID_TARGET_BRANCH",
        });

        expect(
          adapter.calls,
        ).toEqual([]);
      },
    );

    it(
      "rejects an empty changeset before Git",
      async () => {
        const adapter =
          new FakeGitAdapter();

        const result =
          await executeGitTransaction(
            validTransaction({
              changes: [],
            }),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "EMPTY_CHANGESET",
        });

        expect(
          adapter.calls,
        ).toEqual([]);
      },
    );

    it(
      "runs Gate A before any Git operation",
      async () => {
        const adapter =
          new FakeGitAdapter();

        const change =
          validChange();

        const result =
          await executeGitTransaction(
            validTransaction({
              changes: [
                {
                  ...change,
                  request: {
                    ...change.request,
                    actor: "flash",
                  },
                },
              ],
            }),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "GATE_A_REJECTED",
          policyCode:
            "FLASH_READ_ONLY",
        });

        expect(
          adapter.calls,
        ).toEqual([]);
      },
    );

    it(
      "runs Gate B before any Git operation for append-state",
      async () => {
        const adapter =
          new FakeGitAdapter();

        const change =
          validChange({
            proposedContent:
              `${currentContent.replace(
                "planned",
                "blocked",
              )}\n\n${appendedEvent}`,
          });

        const result =
          await executeGitTransaction(
            validTransaction({
              changes: [change],
            }),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "GATE_B_REJECTED",
          policyCode:
            "CURRENT_HISTORY_MODIFIED",
        });

        expect(
          adapter.calls,
        ).toEqual([]);
      },
    );
  },
);

describe(
  "Gate C SHA-CAS preflight",
  () => {
    it(
      "rejects a dirty primary worktree",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.clean =
          false;

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "PRIMARY_WORKTREE_DIRTY",
        });

        expect(
          adapter.calls,
        ).toEqual([
          "isClean",
        ]);
      },
    );

    it(
      "rejects a local SHA different from the expected base",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.localHead =
          OTHER;

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "LOCAL_HEAD_MISMATCH",
        });

        expect(
          adapter.calls,
        ).toEqual([
          "isClean",
          "getLocalHead",
        ]);
      },
    );

    it(
      "rejects a remote SHA different from the expected base",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.remoteHeads = [
          OTHER,
        ];

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "REMOTE_HEAD_MISMATCH",
        });

        expect(
          adapter.calls,
        ).toEqual([
          "isClean",
          "getLocalHead",
          "getRemoteHead",
        ]);
      },
    );
  },
);

describe(
  "Gate C exact path enforcement",
  () => {
    it(
      "rejects an unexpected changed path",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.changedPaths = [
          TARGET,
          "README.md",
        ];

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "UNEXPECTED_CHANGED_PATH",
          path: "README.md",
        });

        expect(
          adapter.calls,
        ).toContain(
          "removeTransactionWorktree",
        );

        expect(
          adapter.calls.some(
            (call) =>
              call.startsWith(
                "stage:",
              ),
          ),
        ).toBe(false);
      },
    );

    it(
      "rejects a missing expected path",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.changedPaths =
          [];

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "EXPECTED_CHANGED_PATH_MISSING",
          path: TARGET,
        });

        expect(
          adapter.calls,
        ).toContain(
          "removeTransactionWorktree",
        );
      },
    );

    it(
      "stages only the exact authorized target paths",
      async () => {
        const adapter =
          new FakeGitAdapter();

        await executeGitTransaction(
          validTransaction(),
          adapter,
        );

        expect(
          adapter.calls,
        ).toContain(
          `stage:${TARGET}`,
        );
      },
    );
  },
);

describe(
  "Gate C commit and push CAS",
  () => {
    it(
      "rejects a commit whose parent is not the expected base",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.parentSha =
          OTHER;

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "COMMIT_PARENT_MISMATCH",
        });

        expect(
          adapter.pushCalls,
        ).toBe(0);

        expect(
          adapter.calls,
        ).toContain(
          "removeTransactionWorktree",
        );
      },
    );

    it(
      "returns PUSH_REJECTED without retrying when the normal push loses the CAS race",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.pushShouldFail =
          true;

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "PUSH_REJECTED",
        });

        expect(
          adapter.pushCalls,
        ).toBe(1);

        expect(
          adapter.calls,
        ).toContain(
          "removeTransactionWorktree",
        );
      },
    );

    it(
      "requires the remote head to equal the resulting commit after push",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.remoteHeads = [
          BASE,
          OTHER,
        ];

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "REMOTE_VERIFY_MISMATCH",
        });

        expect(
          adapter.calls,
        ).toContain(
          "removeTransactionWorktree",
        );
      },
    );

    it(
      "returns success only after post-push remote SHA verification",
      async () => {
        const adapter =
          new FakeGitAdapter();

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: true,
          code:
            "COMMITTED_AND_PUSHED",
          baseSha: BASE,
          resultSha: RESULT,
          targetBranch: "main",
          changedPaths: [
            TARGET,
          ],
        });

        expect(
          adapter.pushCalls,
        ).toBe(1);

        expect(
          adapter.calls.at(-1),
        ).toBe(
          "removeTransactionWorktree",
        );
      },
    );
  },
);

describe(
  "Gate C cleanup",
  () => {
    it(
      "surfaces transaction cleanup failure",
      async () => {
        const adapter =
          new FakeGitAdapter();

        adapter.cleanupShouldFail =
          true;

        const result =
          await executeGitTransaction(
            validTransaction(),
            adapter,
          );

        expect(result).toEqual({
          ok: false,
          code:
            "TRANSACTION_CLEANUP_FAILED",
        });
      },
    );
  },
);