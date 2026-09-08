import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock(
  "@/tools/obsidian-sync/closed-tasks",
  () => ({
    isTaskClosed:
      () => false,

    createTaskClosedResult:
      (task: string) => ({
        status:
          "TASK_CLOSED",

        task,
      }),
  }),
);

import {
  REVIEW_CLOSURE_ARM_VALUE,
  runReviewClosure,
} from "@/tools/obsidian-sync/review-closure-runner";

async function runOperationalReviewClosure(
  dependencies:
    Parameters<
      typeof runReviewClosure
    >[0],
) {
  if (!dependencies) {
    throw new Error(
      "Expected injected review-closure dependencies",
    );
  }

  const result =
    await runReviewClosure(
      dependencies,
    );

  if (
    "status" in result
  ) {
    throw new Error(
      "Expected operational review-closure evidence",
    );
  }

  return result;
}

const BASE =
  "c0ff49eba3e7536933663d21e6e0ac1bf0e423a0";

const TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SPARK/STATE-UPDATES/TASK-AS-0003.md";

const VAULT_ROOT =
  String.raw`C:\Users\diore\Documents\RAIOC V2`;

const REMOTE =
  "https://github.com/emanuelrendas/raioc-obsidian-vault2.git";

const BEFORE =
  "# Existing State History";

describe(
  "TASK-AS-0003 review closure runner",
  () => {
    it(
      "refuses to execute unless explicitly armed",
      async () => {
        let mutationCalls =
          0;

        let pullCalls =
          0;

        const evidence =
          await runOperationalReviewClosure({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                REMOTE,

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                "NOT_AUTHORIZED",
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
                pullCalls += 1;

                throw new Error(
                  "must not execute",
                );
              },
          } as unknown as Parameters<
            typeof runReviewClosure
          >[0]);

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "HOLD",
        );

        expect(
          evidence.FAILURE_CODE,
        ).toBe(
          "REVIEW_CLOSURE_NOT_ARMED",
        );

        expect(
          mutationCalls,
        ).toBe(0);

        expect(
          pullCalls,
        ).toBe(0);
      },
    );

    it(
      "builds the exact audited TASK-AS-0003 review-to-done mutation",
      async () => {
        let capturedRequest:
          unknown = null;

        await runOperationalReviewClosure({
          environment: {
            AI_SHOWROOM_VAULT_PATH:
              VAULT_ROOT,

            AI_SHOWROOM_VAULT_REMOTE:
              REMOTE,

            AI_SHOWROOM_REVIEW_CLOSURE_ARM:
              REVIEW_CLOSURE_ARM_VALUE,
          },

          readTarget:
            async () => ({
              exists:
                true,

              content:
                BEFORE,
            }),

          now:
            () =>
              new Date(
                "2026-09-03T07:00:00.000Z",
              ),

          executeMutationPipelineFn:
            async (
              request: unknown,
            ) => {
              capturedRequest =
                request;

              return {
                ok:
                  true,
              };
            },

          executeLocalObsidianPullFn:
            async () => ({
              ok:
                true,
            }),
        } as unknown as Parameters<
          typeof runReviewClosure
        >[0]);

        expect(
          capturedRequest,
        ).toMatchObject({
          transaction: {
            project:
              "ai-showroom",

            task:
              "TASK-AS-0003",

            repoPath:
              VAULT_ROOT,

            targetBranch:
              "main",

            expectedBaseSha:
              BASE,

            changes: [
              {
                request: {
                  project:
                    "ai-showroom",

                  task:
                    "TASK-AS-0003",

                  actor:
                    "spark",

                  operation:
                    "append",

                  mutationKind:
                    "append-state",

                  target:
                    TARGET,

                  reviewClosureApproval: {
                    approvedBy:
                      "tiago",

                    task:
                      "TASK-AS-0003",

                    target:
                      TARGET,

                    fromStatus:
                      "review",

                    toStatus:
                      "done",

                    baseSha:
                      BASE,

                    approvalId:
                      "AS-APPROVAL-20260902-TASK-AS-0003-REVIEW-TO-DONE",
                  },
                },

                artifact: {
                  exists:
                    true,

                  type:
                    "task",

                  status:
                    "review",

                  frozen:
                    false,

                  owner:
                    "sol",

                  activeWriter:
                    "spark",

                  writeLockTask:
                    "TASK-AS-0003",
                },

                taskScope: {
                  project:
                    "ai-showroom",

                  task:
                    "TASK-AS-0003",

                  allowedTargetPrefixes: [
                    "04 - AI WORKSPACE/AI-SHOWROOM/SPARK/",
                  ],
                },

                currentContent:
                  BEFORE,
              },
            ],
          },

          isolation: {
            approvedVaultRoot:
              VAULT_ROOT,

            approvedRemote:
              REMOTE,

            requiredEnvironmentKeys: [
              "AI_SHOWROOM_VAULT_PATH",
              "AI_SHOWROOM_VAULT_REMOTE",
            ],
          },
        });
      },
    );
      it(
      "stops before Gate F when the mutation pipeline rejects",
      async () => {
        let pullCalls =
          0;

        const evidence =
          await runOperationalReviewClosure({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                REMOTE,

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                REVIEW_CLOSURE_ARM_VALUE,
            },

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,
              }),

            now:
              () =>
                new Date(
                  "2026-09-03T07:00:00.000Z",
                ),

            executeMutationPipelineFn:
              async () => ({
                ok:
                  false,

                code:
                  "GATE_C_REJECTED",

                transactionCode:
                  "REVIEW_CLOSURE_BASE_SHA_MISMATCH",
              }),

            executeLocalObsidianPullFn:
              async () => {
                pullCalls += 1;

                return {
                  ok:
                    true,
                };
              },
          } as unknown as Parameters<
            typeof runReviewClosure
          >[0]);

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "HOLD",
        );

        expect(
          evidence.FAILURE_CODE,
        ).toBe(
          "MUTATION_PIPELINE:GATE_C_REJECTED",
        );

        expect(
          pullCalls,
        ).toBe(0);
      },
    );
      it(
      "stops before mutation when the vault local SHA is not the approved closure base",
      async () => {
        let mutationCalls =
          0;

        let pullCalls =
          0;

        const evidence =
          await runOperationalReviewClosure({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                REMOTE,

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                REVIEW_CLOSURE_ARM_VALUE,
            },

            transactionAdapter: {
              getLocalHead:
                async () =>
                  "dddddddddddddddddddddddddddddddddddddddd",

              getRemoteHead:
                async () =>
                  BASE,
            },

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,
              }),

            now:
              () =>
                new Date(
                  "2026-09-03T07:00:00.000Z",
                ),

            executeMutationPipelineFn:
              async () => {
                mutationCalls += 1;

                return {
                  ok:
                    true,
                };
              },

            executeLocalObsidianPullFn:
              async () => {
                pullCalls += 1;

                return {
                  ok:
                    true,
                };
              },
          } as unknown as Parameters<
            typeof runReviewClosure
          >[0]);

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

        expect(
          pullCalls,
        ).toBe(0);
      },
    );

    it(
      "stops before mutation when the vault remote SHA is not the approved closure base",
      async () => {
        let mutationCalls =
          0;

        let pullCalls =
          0;

        const evidence =
          await runOperationalReviewClosure({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                REMOTE,

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                REVIEW_CLOSURE_ARM_VALUE,
            },

            transactionAdapter: {
              getLocalHead:
                async () =>
                  BASE,

              getRemoteHead:
                async () =>
                  "dddddddddddddddddddddddddddddddddddddddd",
            },

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,
              }),

            now:
              () =>
                new Date(
                  "2026-09-03T07:00:00.000Z",
                ),

            executeMutationPipelineFn:
              async () => {
                mutationCalls += 1;

                return {
                  ok:
                    true,
                };
              },

            executeLocalObsidianPullFn:
              async () => {
                pullCalls += 1;

                return {
                  ok:
                    true,
                };
              },
          } as unknown as Parameters<
            typeof runReviewClosure
          >[0]);

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

        expect(
          pullCalls,
        ).toBe(0);
      },
    );
        it(
      "runs Gate F after a successful mutation",
      async () => {
        let pullCalls =
          0;

        const evidence =
          await runOperationalReviewClosure({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                REMOTE,

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                REVIEW_CLOSURE_ARM_VALUE,
            },

            transactionAdapter: {
              getLocalHead:
                async () =>
                  BASE,

              getRemoteHead:
                async () =>
                  BASE,
            },

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,
              }),

            now:
              () =>
                new Date(
                  "2026-09-03T07:00:00.000Z",
                ),

            executeMutationPipelineFn:
              async () => ({
                ok:
                  true,
              }),

            executeLocalObsidianPullFn:
              async () => {
                pullCalls += 1;

                return {
                  ok:
                    true,

                  code:
                    "FAST_FORWARDED",
                };
              },
          } as unknown as Parameters<
            typeof runReviewClosure
          >[0]);

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "PASS",
        );

        expect(
          pullCalls,
        ).toBe(1);
      },
    );
        it(
      "returns HOLD when Gate F rejects after a successful mutation",
      async () => {
        const evidence =
          await runOperationalReviewClosure({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                REMOTE,

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                REVIEW_CLOSURE_ARM_VALUE,
            },

            transactionAdapter: {
              getLocalHead:
                async () =>
                  BASE,

              getRemoteHead:
                async () =>
                  BASE,
            },

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,
              }),

            now:
              () =>
                new Date(
                  "2026-09-03T07:00:00.000Z",
                ),

            executeMutationPipelineFn:
              async () => ({
                ok:
                  true,
              }),

            executeLocalObsidianPullFn:
              async () => ({
                ok:
                  false,

                code:
                  "FAST_FORWARD_FAILED",
              }),
          } as unknown as Parameters<
            typeof runReviewClosure
          >[0]);

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "HOLD",
        );

        expect(
          evidence.FAILURE_CODE,
        ).toBe(
          "GATE_F:FAST_FORWARD_FAILED",
        );
      },
    );
        it(
      "returns HOLD when Gate F does not fast-forward after a successful mutation",
      async () => {
        const evidence =
          await runOperationalReviewClosure({
            environment: {
              AI_SHOWROOM_VAULT_PATH:
                VAULT_ROOT,

              AI_SHOWROOM_VAULT_REMOTE:
                REMOTE,

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                REVIEW_CLOSURE_ARM_VALUE,
            },

            transactionAdapter: {
              getLocalHead:
                async () =>
                  BASE,

              getRemoteHead:
                async () =>
                  BASE,
            },

            readTarget:
              async () => ({
                exists:
                  true,

                content:
                  BEFORE,
              }),

            now:
              () =>
                new Date(
                  "2026-09-03T07:00:00.000Z",
                ),

            executeMutationPipelineFn:
              async () => ({
                ok:
                  true,
              }),

            executeLocalObsidianPullFn:
              async () => ({
                ok:
                  true,

                code:
                  "UP_TO_DATE",
              }),
          } as unknown as Parameters<
            typeof runReviewClosure
          >[0]);

        expect(
          evidence.FINAL_VERDICT,
        ).toBe(
          "HOLD",
        );

        expect(
          evidence.FAILURE_CODE,
        ).toBe(
          "GATE_F:UP_TO_DATE",
        );
      },
    );
        it(
      "provides production dependencies for governed live closure execution",
      async () => {
        const runnerModule =
          await import(
            "../../tools/obsidian-sync/review-closure-runner"
          );

        const createDependencies =
          (
            runnerModule as Record<
              string,
              unknown
            >
          )
            .createProductionReviewClosureDependencies;

        expect(
          typeof createDependencies,
        ).toBe(
          "function",
        );
      },
    );
        it(
      "exposes the governed production main entry point",
      async () => {
        const runnerModule =
          await import(
            "../../tools/obsidian-sync/review-closure-runner"
          );

        const main =
          (
            runnerModule as Record<
              string,
              unknown
            >
          )
            .main;

        expect(
          typeof main,
        ).toBe(
          "function",
        );
      },
    );
  },
);
