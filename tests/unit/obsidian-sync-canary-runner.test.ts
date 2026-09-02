import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildGateGCanaryEvent,
  GATE_G_ARM_VALUE,
  GATE_G_REMOTE,
  GATE_G_TARGET,
  GATE_G_VAULT_ROOT,
  runGateGCanary,
} from "@/tools/obsidian-sync/canary-runner";

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
  LocalPullAdapter,
} from "@/tools/obsidian-sync/local-pull-adapter";

import type {
  LocalGitOperationState,
  LocalPullDecision,
} from "@/tools/obsidian-sync/local-pull-types";

import type {
  MutationPipelineDecision,
} from "@/tools/obsidian-sync/mutation-pipeline";

const APP_SHA =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const BASE =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const RESULT =
  "cccccccccccccccccccccccccccccccccccccccc";

const NOW =
  new Date(
    "2026-09-02T19:45:00.000Z",
  );

const BEFORE = `# State History

## State Update — 2026-09-02T18:00:00.000Z

Agent: Spark
Task: TASK-AS-0003
Previous Status: planned
New Status: active
Reason: Existing state.
Evidence: baseline`;

const EVENT =
  buildGateGCanaryEvent(
    NOW.toISOString(),
    APP_SHA,
  );

const AFTER =
  `${BEFORE}\n\n${EVENT}`;

class FakeIsolationAdapter
  implements IsolationAdapter {
  async realpath(
    path: string,
  ): Promise<string> {
    return path;
  }

  async resolveTargetPhysicalAnchor(
    repoPath: string,
  ): Promise<string> {
    return repoPath;
  }

  async getOriginUrl():
    Promise<string | null> {
    return GATE_G_REMOTE;
  }

  listEnvironmentKeys():
    readonly string[] {
    return [
      "AI_SHOWROOM_VAULT_PATH",
      "AI_SHOWROOM_VAULT_REMOTE",
      "RAIOC_GITHUB_TOKEN",
    ];
  }

  getPathComparisonMode():
    PathComparisonMode {
    return "case-insensitive";
  }
}

class FakeTransactionAdapter
  implements GitAdapter {
  calls: string[] = [];

  private remoteCalls =
    0;

  async isClean():
    Promise<boolean> {
    this.calls.push(
      "tx:isClean",
    );

    return true;
  }

  async getLocalHead(
    _repoPath: string,
    _branch: string,
  ):
    Promise<string> {
    this.calls.push(
      "tx:getLocalHead",
    );

    return BASE;
  }

  async getRemoteHead(
    _repoPath: string,
    _branch: string,
  ):
    Promise<string> {
    this.calls.push(
      "tx:getRemoteHead",
    );

    this.remoteCalls += 1;

    return this.remoteCalls ===
      1
      ? BASE
      : RESULT;
  }

  async createTransactionWorktree():
    Promise<TransactionWorktree> {
    throw new Error(
      "runner test should use stub pipeline",
    );
  }

  async writeFile():
    Promise<void> {
    throw new Error(
      "unexpected write",
    );
  }

  async getChangedPaths():
    Promise<readonly string[]> {
    throw new Error(
      "unexpected changed-path read",
    );
  }

  async stagePaths():
    Promise<void> {
    throw new Error(
      "unexpected stage",
    );
  }

  async commit():
    Promise<string> {
    throw new Error(
      "unexpected commit",
    );
  }

  async getCommitParent():
    Promise<string> {
    throw new Error(
      "unexpected parent",
    );
  }

  async pushCommit():
    Promise<void> {
    throw new Error(
      "unexpected push",
    );
  }

  async removeTransactionWorktree():
    Promise<void> {
    throw new Error(
      "unexpected cleanup",
    );
  }
}

class FakePullAdapter
  implements LocalPullAdapter {
  calls: string[] = [];

  private headCalls =
    0;

  async isClean():
    Promise<boolean> {
    this.calls.push(
      "pull:isClean",
    );

    return true;
  }

  async getCurrentBranch():
    Promise<string | null> {
    this.calls.push(
      "pull:getCurrentBranch",
    );

    return "main";
  }

  async getOperationState():
    Promise<LocalGitOperationState> {
    this.calls.push(
      "pull:getOperationState",
    );

    return "none";
  }

  async getHead():
    Promise<string> {
    this.calls.push(
      "pull:getHead",
    );

    this.headCalls += 1;

    return this.headCalls <=
      2
      ? BASE
      : RESULT;
  }

  async fetchBranch():
    Promise<string> {
    throw new Error(
      "runner test uses stub Gate F",
    );
  }

  async isAncestor():
    Promise<boolean> {
    throw new Error(
      "runner test uses stub Gate F",
    );
  }

  async fastForward():
    Promise<void> {
    throw new Error(
      "runner test uses stub Gate F",
    );
  }
}

const isolationPass:
  Extract<
    IsolationDecision,
    { ok: true }
  > = {
  ok: true,
  code:
    "ISOLATION_VERIFIED",

  vaultRoot:
    GATE_G_VAULT_ROOT,

  repoRoot:
    GATE_G_VAULT_ROOT,

  remote: {
    host:
      "github.com",

    owner:
      "emanuelrendas",

    repo:
      "raioc-obsidian-vault2",
  },
};

describe(
  "Gate G canary runner",
  () => {
    it(
      "refuses to execute unless explicitly armed",
      async () => {
        const transactionAdapter =
          new FakeTransactionAdapter();

        const pullAdapter =
          new FakePullAdapter();

        let isolationCalls =
          0;

        let mutationCalls =
          0;

        const evidence =
          await runGateGCanary({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                GATE_G_VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                GATE_G_REMOTE,

              AI_SHOWROOM_CANARY_APPLICATION_SHA:
                APP_SHA,

              AI_SHOWROOM_GATE_G_ARM:
                "NOT_AUTHORIZED",
            },

            isolationAdapter:
              new FakeIsolationAdapter(),

            transactionAdapter,

            pullAdapter,

            verifyIsolationFn:
              async () => {
                isolationCalls += 1;

                return isolationPass;
              },

            executeMutationPipelineFn:
              async () => {
                mutationCalls += 1;

                throw new Error(
                  "must not execute",
                );
              },

            executeLocalObsidianPullFn:
              async () => {
                throw new Error(
                  "must not execute",
                );
              },

            getApplicationState:
              async () => ({
                repoRoot:
                  "C:\\repo",

                head:
                  APP_SHA,

                clean:
                  true,
              }),

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,

                sha256:
                  "hash",

                stateEventCount:
                  1,
              }),

            readOnlyGit:
              async () =>
                "",

            now:
              () =>
                NOW,

            emitEvidence:
              () => {},
          });

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "HOLD",
        );

        expect(
          evidence.FAILURE_CODE,
        ).toBe(
          "LIVE_CANARY_NOT_ARMED",
        );

        expect(
          isolationCalls,
        ).toBe(0);

        expect(
          mutationCalls,
        ).toBe(0);

        expect(
          transactionAdapter.calls,
        ).toEqual([]);

        expect(
          pullAdapter.calls,
        ).toEqual([]);
      },
    );

    it(
      "executes Gate D before remote convergence, then pipeline, then Gate F",
      async () => {
        const order:
          string[] = [];

        const transactionAdapter =
          new FakeTransactionAdapter();

        const originalRemote =
          transactionAdapter
            .getRemoteHead
            .bind(
              transactionAdapter,
            );

        transactionAdapter
          .getRemoteHead =
          async (
            repoPath: string,
            branch: string,
          ) => {
            order.push(
              "remote",
            );

            return originalRemote(
              repoPath,
              branch,
            );
          };

        const pullAdapter =
          new FakePullAdapter();

        let targetReads =
          0;

        let emitted:
          unknown = null;

        const mutationPass:
          Extract<
            MutationPipelineDecision,
            { ok: true }
          > = {
          ok: true,

          code:
            "MUTATION_COMMITTED",

          isolation:
            isolationPass,

          transaction: {
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
              GATE_G_TARGET,
            ],
          },
        };

        const pullPass:
          Extract<
            LocalPullDecision,
            { ok: true }
          > = {
          ok: true,

          code:
            "FAST_FORWARDED",

          fromSha:
            BASE,

          toSha:
            RESULT,

          isolation:
            isolationPass,
        };

        const evidence =
          await runGateGCanary({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                GATE_G_VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                GATE_G_REMOTE,

              AI_SHOWROOM_CANARY_APPLICATION_SHA:
                APP_SHA,

              AI_SHOWROOM_GATE_G_ARM:
                GATE_G_ARM_VALUE,

              RAIOC_GITHUB_TOKEN:
                "SHOULD_NEVER_APPEAR_IN_EVIDENCE",
            },

            isolationAdapter:
              new FakeIsolationAdapter(),

            transactionAdapter,

            pullAdapter,

            verifyIsolationFn:
              async () => {
                order.push(
                  "gate-d",
                );

                return isolationPass;
              },

            executeMutationPipelineFn:
              async (
                request,
              ) => {
                order.push(
                  "pipeline",
                );

                expect(
                  request
                    .transaction
                    .changes[0]
                    ?.request,
                ).toMatchObject({
                  actor:
                    "spark",

                  operation:
                    "append",

                  mutationKind:
                    "append-state",

                  target:
                    GATE_G_TARGET,
                });

                expect(
                  request
                    .transaction
                    .expectedBaseSha,
                ).toBe(
                  BASE,
                );

                return mutationPass;
              },

            executeLocalObsidianPullFn:
              async () => {
                order.push(
                  "gate-f",
                );

                return pullPass;
              },

            getApplicationState:
              async () => ({
                repoRoot:
                  "C:\\repo",

                head:
                  APP_SHA,

                clean:
                  true,
              }),

            readTarget:
              async () => {
                targetReads += 1;

                if (
                  targetReads === 1
                ) {
                  return {
                    exists:
                      true,

                    content:
                      BEFORE,

                    sha256:
                      "before-hash",

                    stateEventCount:
                      1,
                  };
                }

                return {
                  exists:
                    true,

                  content:
                    AFTER,

                  sha256:
                    "after-hash",

                  stateEventCount:
                    2,
                };
              },

            readOnlyGit:
              async (
                _cwd,
                args,
              ) => {
                if (
                  args[0] ===
                    "rev-list" &&
                  args[1] ===
                    "--count"
                ) {
                  return "1\n";
                }

                if (
                  args[0] ===
                    "diff"
                ) {
                  return `${GATE_G_TARGET}\0`;
                }

                if (
                  args[0] ===
                    "rev-list" &&
                  args[1] ===
                    "--parents"
                ) {
                  return `${RESULT} ${BASE}\n`;
                }

                throw new Error(
                  "unexpected forensic command",
                );
              },

            now:
              () =>
                NOW,

            emitEvidence:
              (
                value,
              ) => {
                emitted =
                  value;
              },
          });

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "PASS",
        );

        expect(
          order.indexOf(
            "gate-d",
          ),
        ).toBeLessThan(
          order.indexOf(
            "remote",
          ),
        );

        expect(
          order.indexOf(
            "pipeline",
          ),
        ).toBeLessThan(
          order.indexOf(
            "gate-f",
          ),
        );

        expect(evidence)
          .toMatchObject({
            APPLICATION_SHA:
              APP_SHA,

            LOCAL_BASE_SHA:
              BASE,

            REMOTE_BASE_SHA:
              BASE,

            GATE_A:
              "AUTHORIZED",

            GATE_B:
              "APPEND_ONLY_VALID",

            GATE_D_BEFORE_PUSH:
              "ISOLATION_VERIFIED",

            GATE_C:
              "COMMITTED_AND_PUSHED",

            CANARY_RESULT_SHA:
              RESULT,

            GATE_F:
              "FAST_FORWARDED",

            LOCAL_FINAL_SHA:
              RESULT,

            REMOTE_FINAL_SHA:
              RESULT,

            CHANGED_FILE_COUNT:
              1,

            CHANGED_FILE:
              GATE_G_TARGET,

            COMMIT_COUNT:
              1,

            COMMIT_PARENT:
              BASE,

            STATE_EVENTS_ADDED:
              1,

            PRIOR_HISTORY_PRESERVED:
              "PASS",

            FINAL_TREE:
              "CLEAN",

            SECRET_DISCLOSURE:
              "NONE",

            FINAL_VERDICT:
              "PASS",
          });

        expect(
          JSON.stringify(
            emitted,
          ),
        ).not.toContain(
          "SHOULD_NEVER_APPEAR_IN_EVIDENCE",
        );
      },
    );

    it(
      "stops on initial local/remote divergence before the mutation pipeline",
      async () => {
        const transactionAdapter =
          new FakeTransactionAdapter();

        transactionAdapter
          .getRemoteHead =
          async (
            _repoPath: string,
            _branch: string,
          ) =>
            "dddddddddddddddddddddddddddddddddddddddd";

        let mutationCalls =
          0;

        const evidence =
          await runGateGCanary({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                GATE_G_VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                GATE_G_REMOTE,

              AI_SHOWROOM_CANARY_APPLICATION_SHA:
                APP_SHA,

              AI_SHOWROOM_GATE_G_ARM:
                GATE_G_ARM_VALUE,
            },

            isolationAdapter:
              new FakeIsolationAdapter(),

            transactionAdapter,

            pullAdapter:
              new FakePullAdapter(),

            verifyIsolationFn:
              async () =>
                isolationPass,

            executeMutationPipelineFn:
              async () => {
                mutationCalls += 1;

                throw new Error(
                  "must not execute",
                );
              },

            executeLocalObsidianPullFn:
              async () => {
                throw new Error(
                  "must not execute",
                );
              },

            getApplicationState:
              async () => ({
                repoRoot:
                  "C:\\repo",

                head:
                  APP_SHA,

                clean:
                  true,
              }),

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,

                sha256:
                  "hash",

                stateEventCount:
                  1,
              }),

            readOnlyGit:
              async () =>
                "",

            now:
              () =>
                NOW,

            emitEvidence:
              () => {},
          });

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "HOLD",
        );

        expect(
          evidence.FAILURE_CODE,
        ).toBe(
          "INITIAL_CONVERGENCE_FAILURE",
        );

        expect(
          mutationCalls,
        ).toBe(0);
      },
    );
  },
);