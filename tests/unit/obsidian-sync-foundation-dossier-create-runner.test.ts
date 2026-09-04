import {
  createHash,
} from "node:crypto";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  MutationPipelineRequest,
} from "@/tools/obsidian-sync/mutation-pipeline";

import * as foundationDossierRunner
  from "@/tools/obsidian-sync/foundation-dossier-create-runner";

import {
  runFoundationDossierCreate,
} from "@/tools/obsidian-sync/foundation-dossier-create-runner";

const BASE_SHA =
  "5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7";

const TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SOL/FOUNDATION/OBSIDIAN-AI-SYNC-FOUNDATION.md";

const APPROVED_DOSSIER_SHA256 =
  "d5ab9078c93d91f900d15e6365dbbb2dff04e0dcbe2bee06f490211b0f72368c";

describe(
  "TASK-AS-0004 foundation dossier create runner",
  () => {
    it(
      "refuses to execute unless explicitly armed",
      async () => {
        const result =
          await runFoundationDossierCreate({
            environment: {},
          });

        expect(result).toEqual({
          FINAL_VERDICT:
            "HOLD",

          FAILURE_CODE:
            "FOUNDATION_DOSSIER_CREATE_NOT_ARMED",
        });
      },
    );

    it(
      "builds the exact hard-bound TASK-AS-0004 create-once transaction",
      async () => {
        let captured:
          MutationPipelineRequest | null =
          null;

        const executeMutationPipelineFn =
          vi.fn(
            async (
              request:
                MutationPipelineRequest,
            ) => {
              captured =
                request;

              return {
                ok: true,
              } as never;
            },
          );

        const dependencies = {
          environment: {
            AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
              "AUTHORIZED_BY_TIAGO",
          },

          transactionAdapter: {
            getLocalHead:
              vi.fn(
                async () =>
                  BASE_SHA,
              ),

            getRemoteHead:
              vi.fn(
                async () =>
                  BASE_SHA,
              ),
          },

          readTarget:
            vi.fn(
              async () => ({
                exists:
                  false,

                content:
                  "",
              }),
            ),

          executeMutationPipelineFn,

          isolationAdapter:
            {} as never,

          pullAdapter:
            {} as never,

          executeLocalObsidianPullFn:
            vi.fn(
              async () =>
                ({
                  ok: true,
                  code:
                    "FAST_FORWARDED",
                }) as never,
            ),
        } as unknown as Parameters<
          typeof runFoundationDossierCreate
        >[0];

        await runFoundationDossierCreate(
          dependencies,
        );

        expect(
          executeMutationPipelineFn,
        ).toHaveBeenCalledTimes(1);

        expect(captured).not.toBeNull();

        const request =
          captured as unknown as
            MutationPipelineRequest;

        expect(
          request.transaction.project,
        ).toBe(
          "ai-showroom",
        );

        expect(
          request.transaction.task,
        ).toBe(
          "TASK-AS-0004",
        );

        expect(
          request.transaction.repoPath,
        ).toBe(
          String.raw`C:\Users\diore\Documents\RAIOC V2`,
        );

        expect(
          request.transaction.targetBranch,
        ).toBe(
          "main",
        );

        expect(
          request.transaction.expectedBaseSha,
        ).toBe(
          BASE_SHA,
        );

        expect(
          request.transaction.changes,
        ).toHaveLength(1);

        const change =
          request.transaction.changes[0];

        expect(
          change.request,
        ).toEqual({
          project:
            "ai-showroom",

          task:
            "TASK-AS-0004",

          actor:
            "sol",

          operation:
            "create",

          mutationKind:
            "substantive",

          target:
            TARGET,
        });

        expect(
          change.artifact,
        ).toEqual({
          exists:
            false,

          type:
            "architecture",

          status:
            "active",

          frozen:
            false,

          owner:
            "sol",

          activeWriter:
            "sol",

          writeLockTask:
            "TASK-AS-0004",
        });

        expect(
          change.taskScope,
        ).toEqual({
          project:
            "ai-showroom",

          task:
            "TASK-AS-0004",

          allowedTargetPrefixes: [
            "04 - AI WORKSPACE/AI-SHOWROOM/SOL/",
          ],
        });

        expect(
          change.currentContent,
        ).toBe("");

        expect(
          createHash("sha256")
            .update(
              change.proposedContent,
              "utf8",
            )
            .digest("hex"),
        ).toBe(
          APPROVED_DOSSIER_SHA256,
        );

        expect(
          change.proposedContent,
        ).toContain(
          "Current Status: ACTIVE",
        );

        expect(
          change.proposedContent,
        ).toContain(
          "Milestone 2: STRICT HOLD",
        );

        expect(
          change.proposedContent,
        ).not.toContain(
          "New Status: review",
        );

        expect(
          request.isolation,
        ).toEqual({
          approvedVaultRoot:
            String.raw`C:\Users\diore\Documents\RAIOC V2`,

          approvedRemote:
            "https://github.com/emanuelrendas/raioc-obsidian-vault2.git",

          requiredEnvironmentKeys: [
            "AI_SHOWROOM_VAULT_PATH",
            "AI_SHOWROOM_VAULT_REMOTE",
          ],
        });
      },
    );
    it(
      "stops before target read or mutation when local vault SHA differs from the approved base",
      async () => {
        const getLocalHead =
          vi.fn(
            async () =>
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          );

        const getRemoteHead =
          vi.fn(
            async () =>
              BASE_SHA,
          );

        const readTarget =
          vi.fn(
            async () => ({
              exists:
                false,

              content:
                "",
            }),
          );

        const executeMutationPipelineFn =
          vi.fn(
            async () =>
              ({
                ok: true,
              }) as never,
          );

        const result =
          await runFoundationDossierCreate(
            {
              environment: {
                AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                  "AUTHORIZED_BY_TIAGO",
              },

              transactionAdapter: {
                getLocalHead,
                getRemoteHead,
              },

              readTarget,

              executeMutationPipelineFn,
            } as unknown as Parameters<
              typeof runFoundationDossierCreate
            >[0],
          );

        expect(result).toEqual({
          FINAL_VERDICT:
            "HOLD",

          FAILURE_CODE:
            "INITIAL_CONVERGENCE_FAILURE",
        });

        expect(
          getLocalHead,
        ).toHaveBeenCalledTimes(1);

        expect(
          getRemoteHead,
        ).not.toHaveBeenCalled();

        expect(
          readTarget,
        ).not.toHaveBeenCalled();

        expect(
          executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );
    it(
      "stops before target read or mutation when remote vault SHA differs from the approved base",
      async () => {
        const getLocalHead =
          vi.fn(
            async () =>
              BASE_SHA,
          );

        const getRemoteHead =
          vi.fn(
            async () =>
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          );

        const readTarget =
          vi.fn(
            async () => ({
              exists:
                false,

              content:
                "",
            }),
          );

        const executeMutationPipelineFn =
          vi.fn(
            async () =>
              ({
                ok: true,
              }) as never,
          );

        const result =
          await runFoundationDossierCreate(
            {
              environment: {
                AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                  "AUTHORIZED_BY_TIAGO",
              },

              transactionAdapter: {
                getLocalHead,
                getRemoteHead,
              },

              readTarget,

              executeMutationPipelineFn,
            } as unknown as Parameters<
              typeof runFoundationDossierCreate
            >[0],
          );

        expect(result).toEqual({
          FINAL_VERDICT:
            "HOLD",

          FAILURE_CODE:
            "INITIAL_CONVERGENCE_FAILURE",
        });

        expect(
          getLocalHead,
        ).toHaveBeenCalledTimes(1);

        expect(
          getRemoteHead,
        ).toHaveBeenCalledTimes(1);

        expect(
          readTarget,
        ).not.toHaveBeenCalled();

        expect(
          executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "refuses creation when the canonical Foundation dossier already exists",
      async () => {
        const getLocalHead =
          vi.fn(async () => BASE_SHA);

        const getRemoteHead =
          vi.fn(async () => BASE_SHA);

        const readTarget =
          vi.fn(
            async () => ({
              exists: true,
              content:
                "# Existing Foundation dossier",
            }),
          );

        const executeMutationPipelineFn =
          vi.fn(
            async () =>
              ({
                ok: true,
              }) as never,
          );

        const result =
          await runFoundationDossierCreate(
            {
              environment: {
                AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                  "AUTHORIZED_BY_TIAGO",
              },

              transactionAdapter: {
                getLocalHead,
                getRemoteHead,
              },

              readTarget,
              executeMutationPipelineFn,
            } as unknown as Parameters<
              typeof runFoundationDossierCreate
            >[0],
          );

        expect(result).toEqual({
          FINAL_VERDICT:
            "HOLD",

          FAILURE_CODE:
            "FOUNDATION_DOSSIER_ALREADY_EXISTS",
        });

        expect(readTarget)
          .toHaveBeenCalledTimes(1);

        expect(
          executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "stops before Gate F when the governed mutation transaction rejects",
      async () => {
        const executeMutationPipelineFn =
          vi.fn(
            async () =>
              ({
                ok: false,
                code:
                  "GATE_A_REJECTED",
              }) as never,
          );

        const executeLocalObsidianPullFn =
          vi.fn(
            async () =>
              ({
                ok: true,
                code:
                  "FAST_FORWARDED",
              }) as never,
          );

        const result =
          await runFoundationDossierCreate(
            {
              environment: {
                AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                  "AUTHORIZED_BY_TIAGO",
              },

              transactionAdapter: {
                getLocalHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),

                getRemoteHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),
              },

              readTarget:
                vi.fn(
                  async () => ({
                    exists:
                      false,

                    content:
                      "",
                  }),
                ),

              executeMutationPipelineFn,
              executeLocalObsidianPullFn,

              isolationAdapter:
                {} as never,

              pullAdapter:
                {} as never,
            } as unknown as Parameters<
              typeof runFoundationDossierCreate
            >[0],
          );

        expect(result).toEqual({
          FINAL_VERDICT:
            "HOLD",

          FAILURE_CODE:
            "MUTATION_PIPELINE_REJECTED",
        });

        expect(
          executeMutationPipelineFn,
        ).toHaveBeenCalledTimes(1);

        expect(
          executeLocalObsidianPullFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "passes certified adapters only after all create preconditions succeed",
      async () => {
        const order:
          string[] = [];

        const isolationAdapter =
          {
            marker:
              "isolation",
          } as never;

        const transactionAdapter =
          {
            getLocalHead:
              vi.fn(
                async () => {
                  order.push(
                    "local",
                  );

                  return BASE_SHA;
                },
              ),

            getRemoteHead:
              vi.fn(
                async () => {
                  order.push(
                    "remote",
                  );

                  return BASE_SHA;
                },
              ),
          } as never;

        const readTarget =
          vi.fn(
            async () => {
              order.push(
                "target",
              );

              return {
                exists:
                  false,

                content:
                  "",
              };
            },
          );

        let capturedPipelineDependencies:
          unknown = null;

        const executeMutationPipelineFn =
          vi.fn(
            async (
              _request:
                MutationPipelineRequest,
              pipelineDependencies:
                unknown,
            ) => {
              order.push(
                "mutation",
              );

              capturedPipelineDependencies =
                pipelineDependencies;

              return {
                ok: true,
                code:
                  "MUTATION_COMMITTED",
              } as never;
            },
          );

        await runFoundationDossierCreate(
          {
            environment: {
              AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                "AUTHORIZED_BY_TIAGO",
            },

            transactionAdapter,
            isolationAdapter,
            readTarget,
            executeMutationPipelineFn,
          } as unknown as Parameters<
            typeof runFoundationDossierCreate
          >[0],
        );

        expect(order).toEqual([
          "local",
          "remote",
          "target",
          "mutation",
        ]);

        expect(
          capturedPipelineDependencies,
        ).toEqual({
          isolationAdapter,
          gitAdapter:
            transactionAdapter,
        });
      },
    );

    it(
      "returns HOLD when Gate F rejects after successful creation",
      async () => {
        const executeLocalObsidianPullFn =
          vi.fn(
            async () =>
              ({
                ok: false,
                code:
                  "LOCAL_PULL_REJECTED",
              }) as never,
          );

        const result =
          await runFoundationDossierCreate(
            {
              environment: {
                AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                  "AUTHORIZED_BY_TIAGO",
              },

              transactionAdapter: {
                getLocalHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),

                getRemoteHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),
              },

              readTarget:
                vi.fn(
                  async () => ({
                    exists:
                      false,

                    content:
                      "",
                  }),
                ),

              isolationAdapter:
                {} as never,

              pullAdapter:
                {} as never,

              executeMutationPipelineFn:
                vi.fn(
                  async () =>
                    ({
                      ok: true,
                      code:
                        "MUTATION_COMMITTED",
                    }) as never,
                ),

              executeLocalObsidianPullFn,
            } as unknown as Parameters<
              typeof runFoundationDossierCreate
            >[0],
          );

        expect(
          executeLocalObsidianPullFn,
        ).toHaveBeenCalledTimes(1);

        expect(result).toEqual({
          FINAL_VERDICT:
            "HOLD",

          FAILURE_CODE:
            "GATE_F_REJECTED",
        });
      },
    );

    it(
      "rejects Gate F UP_TO_DATE after a successful create transaction",
      async () => {
        const executeLocalObsidianPullFn =
          vi.fn(
            async () =>
              ({
                ok: true,
                code:
                  "UP_TO_DATE",
              }) as never,
          );

        const result =
          await runFoundationDossierCreate(
            {
              environment: {
                AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                  "AUTHORIZED_BY_TIAGO",
              },

              transactionAdapter: {
                getLocalHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),

                getRemoteHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),
              },

              readTarget:
                vi.fn(
                  async () => ({
                    exists:
                      false,

                    content:
                      "",
                  }),
                ),

              isolationAdapter:
                {} as never,

              pullAdapter:
                {} as never,

              executeMutationPipelineFn:
                vi.fn(
                  async () =>
                    ({
                      ok: true,
                      code:
                        "MUTATION_COMMITTED",
                    }) as never,
                ),

              executeLocalObsidianPullFn,
            } as unknown as Parameters<
              typeof runFoundationDossierCreate
            >[0],
          );

        expect(
          executeLocalObsidianPullFn,
        ).toHaveBeenCalledTimes(1);

        expect(result).toEqual({
          FINAL_VERDICT:
            "HOLD",

          FAILURE_CODE:
            "GATE_F_NOT_FAST_FORWARDED",
        });
      },
    );

    it(
      "passes only after Gate F FAST_FORWARDED with the exact governed pull request",
      async () => {
        let capturedPullRequest:
          unknown = null;

        const executeLocalObsidianPullFn =
          vi.fn(
            async (
              pullRequest:
                unknown,
            ) => {
              capturedPullRequest =
                pullRequest;

              return {
                ok: true,
                code:
                  "FAST_FORWARDED",
                fromSha:
                  BASE_SHA,
                toSha:
                  "cccccccccccccccccccccccccccccccccccccccc",
                isolation:
                  {},
              } as never;
            },
          );

        const result =
          await runFoundationDossierCreate(
            {
              environment: {
                AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM:
                  "AUTHORIZED_BY_TIAGO",
              },

              transactionAdapter: {
                getLocalHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),

                getRemoteHead:
                  vi.fn(
                    async () =>
                      BASE_SHA,
                  ),
              },

              readTarget:
                vi.fn(
                  async () => ({
                    exists:
                      false,

                    content:
                      "",
                  }),
                ),

              isolationAdapter:
                {} as never,

              pullAdapter:
                {} as never,

              executeMutationPipelineFn:
                vi.fn(
                  async () =>
                    ({
                      ok: true,
                      code:
                        "MUTATION_COMMITTED",
                    }) as never,
                ),

              executeLocalObsidianPullFn,
            } as unknown as Parameters<
              typeof runFoundationDossierCreate
            >[0],
          );

        expect(
          executeLocalObsidianPullFn,
        ).toHaveBeenCalledTimes(1);

        expect(
          capturedPullRequest,
        ).toEqual({
          project:
            "ai-showroom",

          repoPath:
            String.raw`C:\Users\diore\Documents\RAIOC V2`,

          targetBranch:
            "main",

          isolation: {
            approvedVaultRoot:
              String.raw`C:\Users\diore\Documents\RAIOC V2`,

            approvedRemote:
              "https://github.com/emanuelrendas/raioc-obsidian-vault2.git",

            requiredEnvironmentKeys: [
              "AI_SHOWROOM_VAULT_PATH",
              "AI_SHOWROOM_VAULT_REMOTE",
            ],
          },
        });

        expect(result).toEqual({
          FINAL_VERDICT:
            "PASS",

          FAILURE_CODE:
            null,
        });
      },
    );

    it(
      "provides production dependencies for governed dossier creation",
      () => {
        const runnerModule =
          foundationDossierRunner as unknown as {
            createProductionFoundationDossierCreateDependencies?:
              () => Parameters<
                typeof runFoundationDossierCreate
              >[0];
          };

        const factory =
          runnerModule
            .createProductionFoundationDossierCreateDependencies;

        expect(
          factory,
        ).toBeTypeOf(
          "function",
        );

        if (
          typeof factory !==
          "function"
        ) {
          return;
        }

        const dependencies =
          factory();

        expect(
          dependencies.environment,
        ).toBe(
          process.env,
        );

        expect(
          dependencies
            .isolationAdapter
            ?.constructor
            .name,
        ).toBe(
          "NodeIsolationAdapter",
        );

        expect(
          dependencies
            .transactionAdapter
            ?.constructor
            .name,
        ).toBe(
          "GitCliAdapter",
        );

        expect(
          dependencies
            .pullAdapter
            ?.constructor
            .name,
        ).toBe(
          "GitCliPullAdapter",
        );

        expect(
          dependencies
            .readTarget,
        ).toBeTypeOf(
          "function",
        );

        expect(
          dependencies
            .executeMutationPipelineFn,
        ).toBeTypeOf(
          "function",
        );

        expect(
          dependencies
            .executeLocalObsidianPullFn,
        ).toBeTypeOf(
          "function",
        );
      },
    );

    it(
      "exposes an import-safe production main entry",
      () => {
        const runnerModule =
          foundationDossierRunner as unknown as {
            main?:
              () => Promise<void>;
          };

        expect(
          runnerModule.main,
        ).toBeTypeOf(
          "function",
        );
      },
    );
  },
);
