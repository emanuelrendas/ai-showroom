import {
  describe,
  expect,
  it,
} from "vitest";

import {
  validateVaultMutation,
} from "@/tools/obsidian-sync/contract-validator";

import {
  executeMutationPipeline,
} from "@/tools/obsidian-sync/mutation-pipeline";

import type {
  GitAdapter,
  TransactionWorktree,
} from "@/tools/obsidian-sync/git-adapter";

import type {
  IsolationAdapter,
} from "@/tools/obsidian-sync/isolation-adapter";

import type {
  IsolationDecision,
  PathComparisonMode,
} from "@/tools/obsidian-sync/isolation-types";

import type {
  AppendOnlyDecision,
  GitTransactionDecision,
  GitTransactionRequest,
  VaultMutationRequest,
} from "@/tools/obsidian-sync/types";

const BASE =
  "1111111111111111111111111111111111111111";

const RESULT =
  "2222222222222222222222222222222222222222";

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

const appendedEvent = `## State Update — 2026-09-02T19:00+04:00

Agent: Spark
Task: TASK-AS-0003
Previous Status: active
New Status: active
Reason: Gate E positive control.
Evidence: 79ff8eb3529abd5830547d3fc17134f953b3950a`;

function transaction(
  actor:
    VaultMutationRequest["actor"],
): GitTransactionRequest {
  return {
    project:
      "ai-showroom",

    task:
      "TASK-AS-0003",

    repoPath:
      "/fake/ai-showroom-vault",

    targetBranch:
      "main",

    expectedBaseSha:
      BASE,

    commitMessage:
      "chore(obsidian): TASK-AS-0003 Gate E test",

    changes: [
      {
        request: {
          project:
            "ai-showroom",

          task:
            "TASK-AS-0003",

          actor,

          operation:
            "append",

          mutationKind:
            "append-state",

          target:
            TARGET,
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

          task:
            "TASK-AS-0003",

          allowedTargetPrefixes: [
            "04 - AI WORKSPACE/SPARK/",
          ],
        },

        currentContent,

        proposedContent:
          `${currentContent}\n\n${appendedEvent}`,
      },
    ],
  };
}

class NoAuthorityIsolationAdapter
  implements IsolationAdapter {
  realpathCalls =
    0;

  targetCalls =
    0;

  originCalls =
    0;

  environmentCalls =
    0;

  async realpath(
    path: string,
  ): Promise<string> {
    this.realpathCalls += 1;

    return path;
  }

  async resolveTargetPhysicalAnchor(
    repoPath: string,
  ): Promise<string> {
    this.targetCalls += 1;

    return repoPath;
  }

  async getOriginUrl():
    Promise<string | null> {
    this.originCalls += 1;

    return "https://github.com/tiago/ai-showroom-vault.git";
  }

  listEnvironmentKeys():
    readonly string[] {
    this.environmentCalls += 1;

    return [];
  }

  getPathComparisonMode():
    PathComparisonMode {
    return "case-sensitive";
  }
}

class CountingGitAdapter
  implements GitAdapter {
  cleanCalls = 0;

  localHeadCalls = 0;

  remoteHeadCalls = 0;

  worktreeCalls = 0;

  writeCalls = 0;

  changedPathCalls = 0;

  stageCalls = 0;

  commitCalls = 0;

  parentCalls = 0;

  pushCalls = 0;

  cleanupCalls = 0;

  async isClean():
    Promise<boolean> {
    this.cleanCalls += 1;

    return true;
  }

  async getLocalHead():
    Promise<string> {
    this.localHeadCalls += 1;

    return BASE;
  }

  async getRemoteHead():
    Promise<string> {
    this.remoteHeadCalls += 1;

    return BASE;
  }

  async createTransactionWorktree():
    Promise<TransactionWorktree> {
    this.worktreeCalls += 1;

    return {
      path:
        "/fake/worktree",

      cleanupRoot:
        "/fake/root",
    };
  }

  async writeFile():
    Promise<void> {
    this.writeCalls += 1;
  }

  async getChangedPaths():
    Promise<readonly string[]> {
    this.changedPathCalls += 1;

    return [
      TARGET,
    ];
  }

  async stagePaths():
    Promise<void> {
    this.stageCalls += 1;
  }

  async commit():
    Promise<string> {
    this.commitCalls += 1;

    return RESULT;
  }

  async getCommitParent():
    Promise<string> {
    this.parentCalls += 1;

    return BASE;
  }

  async pushCommit():
    Promise<void> {
    this.pushCalls += 1;
  }

  async removeTransactionWorktree():
    Promise<void> {
    this.cleanupCalls += 1;
  }
}

describe(
  "Gate E — canonical Flash short circuit",
  () => {
    it(
      "stops Flash before Gates B, D or C",
      async () => {
        const isolationAdapter =
          new NoAuthorityIsolationAdapter();

        const gitAdapter =
          new CountingGitAdapter();

        const calls = {
          gateA: 0,
          gateB: 0,
          gateD: 0,
          gateC: 0,
        };

        const result =
          await executeMutationPipeline(
            {
              transaction:
                transaction(
                  "flash",
                ),

              isolation: {
                approvedVaultRoot:
                  "/fake/ai-showroom-vault",

                

                approvedRemote:
                  "https://github.com/tiago/ai-showroom-vault.git",

                requiredEnvironmentKeys:
                  [],
              },
            },
            {
              isolationAdapter,
              gitAdapter,

              validateGateA:
                (input) => {
                  calls.gateA += 1;

                  return validateVaultMutation(
                    input,
                  );
                },

              validateGateB:
                () => {
                  calls.gateB += 1;

                  return {
                    ok: true,
                    code:
                      "APPEND_ONLY_VALID",
                    appendedContent:
                      appendedEvent,
                  };
                },

              verifyGateD:
                async () => {
                  calls.gateD += 1;

                  return {
                    ok: true,
                    code:
                      "ISOLATION_VERIFIED",
                    vaultRoot:
                      "/fake/ai-showroom-vault",
                    repoRoot:
                      "/fake/ai-showroom-vault",
                    remote: {
                      host:
                        "github.com",
                      owner:
                        "tiago",
                      repo:
                        "ai-showroom-vault",
                    },
                  };
                },

              executeGateC:
                async () => {
                  calls.gateC += 1;

                  return {
                    ok: true,
                    code:
                      "COMMITTED_AND_PUSHED",
                    baseSha:
                      BASE,
                    resultSha:
                      RESULT,
                    targetBranch:
                      "main",
                    changedPaths: [
                      TARGET,
                    ],
                  };
                },
            },
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "FLASH_READ_ONLY",
          });

        expect(calls)
          .toEqual({
            gateA: 1,
            gateB: 0,
            gateD: 0,
            gateC: 0,
          });

        expect(
          isolationAdapter
            .realpathCalls,
        ).toBe(0);

        expect(
          isolationAdapter
            .targetCalls,
        ).toBe(0);

        expect(
          isolationAdapter
            .originCalls,
        ).toBe(0);

        expect(
          isolationAdapter
            .environmentCalls,
        ).toBe(0);

        expect(
          gitAdapter
            .worktreeCalls,
        ).toBe(0);

        expect(
          gitAdapter
            .writeCalls,
        ).toBe(0);

        expect(
          gitAdapter
            .stageCalls,
        ).toBe(0);

        expect(
          gitAdapter
            .commitCalls,
        ).toBe(0);

        expect(
          gitAdapter
            .pushCalls,
        ).toBe(0);
      },
    );

    it(
      "stops a Flash append-state request before Gate B specifically",
      async () => {
        let gateBCalls = 0;

        const result =
          await executeMutationPipeline(
            {
              transaction:
                transaction(
                  "flash",
                ),

              isolation: {
                approvedVaultRoot:
                  "/fake/ai-showroom-vault",

                

                approvedRemote:
                  "https://github.com/tiago/ai-showroom-vault.git",
              },
            },
            {
              isolationAdapter:
                new NoAuthorityIsolationAdapter(),

              gitAdapter:
                new CountingGitAdapter(),

              validateGateB:
                () => {
                  gateBCalls += 1;

                  return {
                    ok: true,
                    code:
                      "APPEND_ONLY_VALID",
                    appendedContent:
                      appendedEvent,
                  };
                },
            },
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "FLASH_READ_ONLY",
          });

        expect(
          gateBCalls,
        ).toBe(0);
      },
    );
  },
);

describe(
  "Gate E — authorized positive control",
  () => {
    it(
      "allows an authorized Spark append to reach B, D and C",
      async () => {
        const isolationAdapter =
          new NoAuthorityIsolationAdapter();

        const gitAdapter =
          new CountingGitAdapter();

        const calls = {
          gateA: 0,
          gateB: 0,
          gateD: 0,
          gateC: 0,
        };

        const gateBPass:
          AppendOnlyDecision = {
          ok: true,
          code:
            "APPEND_ONLY_VALID",
          appendedContent:
            appendedEvent,
        };

        const gateDPass:
          IsolationDecision = {
          ok: true,
          code:
            "ISOLATION_VERIFIED",

          vaultRoot:
            "/fake/ai-showroom-vault",

          repoRoot:
            "/fake/ai-showroom-vault",

          remote: {
            host:
              "github.com",
            owner:
              "tiago",
            repo:
              "ai-showroom-vault",
          },
        };

        const gateCPass:
          GitTransactionDecision = {
          ok: true,
          code:
            "COMMITTED_AND_PUSHED",

          baseSha:
            BASE,

          resultSha:
            RESULT,

          targetBranch:
            "main",

          changedPaths: [
            TARGET,
          ],
        };

        const result =
          await executeMutationPipeline(
            {
              transaction:
                transaction(
                  "spark",
                ),

              isolation: {
                approvedVaultRoot:
                  "/fake/ai-showroom-vault",

                

                approvedRemote:
                  "https://github.com/tiago/ai-showroom-vault.git",
              },
            },
            {
              isolationAdapter,
              gitAdapter,

              validateGateA:
                (input) => {
                  calls.gateA += 1;

                  return validateVaultMutation(
                    input,
                  );
                },

              validateGateB:
                () => {
                  calls.gateB += 1;

                  return gateBPass;
                },

              verifyGateD:
                async () => {
                  calls.gateD += 1;

                  return gateDPass;
                },

              executeGateC:
                async () => {
                  calls.gateC += 1;

                  return gateCPass;
                },
            },
          );

        expect(result)
          .toMatchObject({
            ok: true,
            code:
              "MUTATION_COMMITTED",
          });

        expect(calls)
          .toEqual({
            gateA: 1,
            gateB: 1,
            gateD: 1,
            gateC: 1,
          });
      },
    );
  },
);