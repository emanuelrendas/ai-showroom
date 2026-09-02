import {
  describe,
  expect,
  it,
} from "vitest";

import {
  validateVaultMutation,
} from "@/tools/obsidian-sync/contract-validator";

import {
  validateAppendOnlyMutation,
} from "@/tools/obsidian-sync/append-only-validator";

import {
  executeGitTransaction,
} from "@/tools/obsidian-sync/git-transaction";

import type {
  GitAdapter,
} from "@/tools/obsidian-sync/git-adapter";

import type {
  ArtifactPolicyState,
  AuthorizedTaskScope,
  GitTransactionRequest,
  ReviewClosureApproval,
  VaultMutationRequest,
} from "@/tools/obsidian-sync/types";

const TASK =
  "TASK-AS-0003";

const TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SPARK/STATE-UPDATES/TASK-AS-0003.md";

const BASE =
  "c0ff49eba3e7536933663d21e6e0ac1bf0e423a0";

const OTHER_BASE =
  "1111111111111111111111111111111111111111";

const CURRENT_CONTENT =
  "# Existing State History";

function approval(
  overrides:
    Partial<ReviewClosureApproval> = {},
): ReviewClosureApproval {
  return {
    approvedBy:
      "tiago",

    task:
      TASK,

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

    ...overrides,
  };
}

function mutationRequest(
  reviewClosureApproval?:
    ReviewClosureApproval,
): VaultMutationRequest {
  return {
    project:
      "ai-showroom",

    task:
      TASK,

    actor:
      "spark",

    operation:
      "append",

    mutationKind:
      "append-state",

    target:
      TARGET,

    reviewClosureApproval,
  };
}

const artifact:
  ArtifactPolicyState = {
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
    TASK,
};

const taskScope:
  AuthorizedTaskScope = {
  project:
    "ai-showroom",

  task:
    TASK,

  allowedTargetPrefixes: [
    "04 - AI WORKSPACE/AI-SHOWROOM/SPARK/",
  ],
};

function stateEvent(
  previousStatus:
    string = "review",
  newStatus:
    string = "done",
): string {
  return `## State Update \u2014 2026-09-02T20:45:00+04:00

Agent: Spark
Task: TASK-AS-0003
Previous Status: ${previousStatus}
New Status: ${newStatus}
Reason: Human-approved final task closure.
Evidence: Gate G PASS`;
}

function proposed(
  previousStatus:
    string = "review",
  newStatus:
    string = "done",
): string {
  return `${CURRENT_CONTENT}\n\n${stateEvent(
    previousStatus,
    newStatus,
  )}`;
}

describe(
  "Gate A — human-authorized review closure",
  () => {
    it(
      "rejects Spark review closure without explicit Tiago approval",
      () => {
        expect(
          validateVaultMutation({
            request:
              mutationRequest(),

            artifact,

            taskScope,
          }),
        ).toMatchObject({
          ok: false,
          code:
            "REVIEW_WRITE_FORBIDDEN",
        });
      },
    );

    it(
      "allows exact Spark review-to-done closure with Tiago approval",
      () => {
        expect(
          validateVaultMutation({
            request:
              mutationRequest(
                approval(),
              ),

            artifact,

            taskScope,
          }),
        ).toEqual({
          ok: true,
          code:
            "AUTHORIZED",
          target:
            TARGET,
        });
      },
    );
  },
);

describe(
  "Gate B — review closure event binding",
  () => {
    it(
      "accepts review to done",
      () => {
        expect(
          validateAppendOnlyMutation({
            request:
              mutationRequest(
                approval(),
              ),

            currentContent:
              CURRENT_CONTENT,

            proposedContent:
              proposed(),
          }),
        ).toMatchObject({
          ok: true,
          code:
            "APPEND_ONLY_VALID",
        });
      },
    );

    it(
      "rejects review to active under a review-to-done approval",
      () => {
        expect(
          validateAppendOnlyMutation({
            request:
              mutationRequest(
                approval(),
              ),

            currentContent:
              CURRENT_CONTENT,

            proposedContent:
              proposed(
                "review",
                "active",
              ),
          }),
        ).toEqual({
          ok: false,
          code:
            "REVIEW_CLOSURE_EVENT_MISMATCH",
        });
      },
    );
  },
);

describe(
  "Gate C — review closure SHA binding",
  () => {
    it(
      "rejects wrong approval SHA before Git adapter calls",
      async () => {
        let adapterCalls =
          0;

        const adapter =
          new Proxy(
            {},
            {
              get() {
                return async () => {
                  adapterCalls += 1;

                  throw new Error(
                    "Git adapter must not be called",
                  );
                };
              },
            },
          ) as unknown as
            GitAdapter;

        const transaction:
          GitTransactionRequest = {
          project:
            "ai-showroom",

          task:
            TASK,

          repoPath:
            "C:\\fake\\vault",

          targetBranch:
            "main",

          expectedBaseSha:
            BASE,

          commitMessage:
            "test closure",

          changes: [
            {
              request:
                mutationRequest(
                  approval({
                    baseSha:
                      OTHER_BASE,
                  }),
                ),

              artifact,

              taskScope,

              currentContent:
                CURRENT_CONTENT,

              proposedContent:
                proposed(),
            },
          ],
        };

        const result =
          await executeGitTransaction(
            transaction,
            adapter,
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "REVIEW_CLOSURE_BASE_SHA_MISMATCH",
          });

        expect(
          adapterCalls,
        ).toBe(0);
      },
    );
  },
);