import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createProductionFoundationReviewDependencies,
  runFoundationReview,
  type FoundationReviewDependencies,
} from "../../tools/obsidian-sync/foundation-review-runner";

const BASE_SHA =
  "bc856c1da42209e57ffd96601e3ed75ddaa0b279";

const TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SOL/FOUNDATION/OBSIDIAN-AI-SYNC-FOUNDATION.md";

const ARM_KEY =
  "AI_SHOWROOM_FOUNDATION_REVIEW_ARM";

const INITIAL_STATE_RECORD = `## Initial State Record

Foundation Status: ACTIVE
Recorded By: Sol
Creation Authority: Tiago-approved Foundation architecture
Creation Base: 5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7
TASK-AS-0003: DONE
TASK-AS-0003 Closure: 37b64df88dad23a9c5fc674a4f0236c5619e5bf2
Application Baseline: df87a2bd96b2c22d3da1931cb1f2aec7788b1c8f
Milestone 2: STRICT HOLD`;

const CURRENT_CONTENT = `# Obsidian AI Sync Foundation

## Canonical Identity

Subsystem: Obsidian AI Sync Foundation
Project: AI Showroom
Artifact Owner: Sol
Lifecycle Authority: Tiago
Current Status: ACTIVE
Milestone 2: STRICT HOLD

---

## Foundation Reconciliation Verdict

Current Foundation lifecycle state remains:

ACTIVE

Creation of this dossier does NOT constitute:

ACTIVE → REVIEW

and does NOT authorize:

REVIEW → FROZEN

---

${INITIAL_STATE_RECORD}`;

function createHarness() {
  const getLocalHead =
    vi.fn(
      async () =>
        BASE_SHA,
    );

  const getRemoteHead =
    vi.fn(
      async () =>
        BASE_SHA,
    );

  const readTarget =
    vi.fn(
      async () => ({
        exists: true,
        content: CURRENT_CONTENT,
      }),
    );

  const now =
    vi.fn(
      () =>
        new Date(
          "2026-09-04T10:00:00.000Z",
        ),
    );

  const executeMutationPipelineFn =
    vi.fn<
      NonNullable<
        FoundationReviewDependencies["executeMutationPipelineFn"]
      >
    >(
      async () => ({
        ok: true,
        code: "MUTATION_COMMITTED",
      }),
    );

  const executeLocalObsidianPullFn =
    vi.fn(
      async () => ({
        ok: true,
        code: "FAST_FORWARDED",
      }),
    );

  const dependencies:
    FoundationReviewDependencies = {
    environment: {
      [ARM_KEY]:
        "AUTHORIZED_BY_TIAGO",

      AI_SHOWROOM_VAULT_PATH:
        String.raw`C:\Users\diore\Documents\RAIOC V2`,

      AI_SHOWROOM_VAULT_REMOTE:
        "https://github.com/emanuelrendas/raioc-obsidian-vault2.git",
    },

    transactionAdapter: {
      getLocalHead,
      getRemoteHead,
    },

    readTarget,
    now,

    isolationAdapter: {},
    pullAdapter: {},

    executeMutationPipelineFn,
    executeLocalObsidianPullFn,
  };

  return {
    dependencies,
    getLocalHead,
    getRemoteHead,
    readTarget,
    now,
    executeMutationPipelineFn,
    executeLocalObsidianPullFn,
  };
}

describe(
  "TASK-AS-0005 Foundation ACTIVE → REVIEW runner",
  () => {
    it(
      "refuses execution unless the dedicated Tiago arm is present",
      async () => {
        const harness =
          createHarness();

        delete harness
          .dependencies
          .environment[ARM_KEY];

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "FOUNDATION_REVIEW_NOT_ARMED",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds when local vault HEAD differs from the exact review base",
      async () => {
        const harness =
          createHarness();

        harness
          .getLocalHead
          .mockResolvedValueOnce(
            "1111111111111111111111111111111111111111",
          );

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "INITIAL_CONVERGENCE_FAILURE",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds when remote main differs from the exact review base",
      async () => {
        const harness =
          createHarness();

        harness
          .getRemoteHead
          .mockResolvedValueOnce(
            "2222222222222222222222222222222222222222",
          );

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "INITIAL_CONVERGENCE_FAILURE",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds when the canonical Foundation artifact is missing",
      async () => {
        const harness =
          createHarness();

        harness
          .readTarget
          .mockResolvedValueOnce({
            exists: false,
            content: "",
          });

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "FOUNDATION_REVIEW_TARGET_MISSING",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds unless the canonical current status is exactly ACTIVE",
      async () => {
        const harness =
          createHarness();

        harness
          .readTarget
          .mockResolvedValueOnce({
            exists: true,
            content:
              CURRENT_CONTENT.replace(
                "Current Status: ACTIVE",
                "Current Status: REVIEW",
              ),
          });

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "FOUNDATION_CURRENT_STATUS_MISMATCH",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds unless the reconciliation lifecycle marker is exactly ACTIVE",
      async () => {
        const harness =
          createHarness();

        harness
          .readTarget
          .mockResolvedValueOnce({
            exists: true,
            content:
              CURRENT_CONTENT.replace(
                "Current Foundation lifecycle state remains:\n\nACTIVE",
                "Current Foundation lifecycle state remains:\n\nREVIEW",
              ),
          });

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "FOUNDATION_LIFECYCLE_MARKER_MISMATCH",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "builds the exact authorized one-file ACTIVE to REVIEW mutation",
      async () => {
        const harness =
          createHarness();

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "PASS",
          FAILURE_CODE: null,
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).toHaveBeenCalledTimes(1);

        const request =
          harness
            .executeMutationPipelineFn
            .mock.calls[0]![0];

        expect(
          request.transaction.project,
        ).toBe("ai-showroom");

        expect(
          request.transaction.task,
        ).toBe("TASK-AS-0005");

        expect(
          request.transaction.targetBranch,
        ).toBe("main");

        expect(
          request.transaction.expectedBaseSha,
        ).toBe(BASE_SHA);

        expect(
          request.transaction.changes,
        ).toHaveLength(1);

        const change =
          request.transaction.changes[0];

        expect(change.request).toMatchObject({
          project: "ai-showroom",
          task: "TASK-AS-0005",
          actor: "sol",
          operation: "update",
          mutationKind: "substantive",
          target: TARGET,
        });

        expect(change.artifact).toMatchObject({
          exists: true,
          type: "architecture",
          status: "active",
          frozen: false,
          owner: "sol",
          activeWriter: "sol",
          writeLockTask:
            "TASK-AS-0005",
        });

        expect(
          change
            .taskScope
            .allowedTargetPrefixes,
        ).toEqual([
          "04 - AI WORKSPACE/AI-SHOWROOM/SOL/",
        ]);

        expect(
          change.currentContent,
        ).toBe(CURRENT_CONTENT);

        const proposed =
          change.proposedContent;

        expect(proposed).toContain(
          "Current Status: REVIEW",
        );

        expect(proposed).not.toContain(
          "Current Status: ACTIVE",
        );

        expect(proposed).toContain(
          "Current Foundation lifecycle state remains:\n\nREVIEW",
        );

        expect(proposed).not.toContain(
          "Current Foundation lifecycle state remains:\n\nACTIVE",
        );

        expect(proposed).toContain(
          INITIAL_STATE_RECORD,
        );

        expect(proposed).toContain(
          "Task: TASK-AS-0005",
        );

        expect(proposed).toContain(
          "Previous Status: ACTIVE",
        );

        expect(proposed).toContain(
          "New Status: REVIEW",
        );

        expect(proposed).toContain(
          "Human Owner / Authorizer: Tiago",
        );

        expect(proposed).toContain(
          "Execution Agent: ChatGPT — AI SHOWROOM",
        );

        expect(proposed).toContain(
          "Session Alias: Sol",
        );

        expect(proposed).toContain(
          "Foundation Creation Base: 5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7",
        );

        expect(proposed).toContain(
          `Creation Commit: ${BASE_SHA}`,
        );

        expect(proposed).toContain(
          `Review Transition Base: ${BASE_SHA}`,
        );

        expect(proposed).toContain(
          "Creation Runner Application SHA: 9a620ea3edb318698c655897d017f3b8b5c13c47",
        );

        expect(proposed).toContain(
          "Canonical Application Baseline Anchor: df87a2bd96b2c22d3da1931cb1f2aec7788b1c8f",
        );

        expect(proposed).toContain(
          "Flash Creation Audit: PASS",
        );

        expect(proposed).toContain(
          "Spark Creation Challenge: PASS",
        );

        expect(proposed).toContain(
          "Milestone 2: STRICT HOLD",
        );

        expect(
          proposed.match(
            /## State Update —/g,
          ),
        ).toHaveLength(1);
      },
    );

    it(
      "does not run Gate F when the mutation pipeline rejects",
      async () => {
        const harness =
          createHarness();

        harness
          .executeMutationPipelineFn
          .mockResolvedValueOnce({
            ok: false,
            code: "GATE_A_REJECTED",
          });

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(
          result.FINAL_VERDICT,
        ).toBe("HOLD");

        expect(
          harness
            .executeLocalObsidianPullFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds when Gate F rejects",
      async () => {
        const harness =
          createHarness();

        harness
          .executeLocalObsidianPullFn
          .mockResolvedValueOnce({
            ok: false,
            code: "LOCAL_DIRTY",
          });

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(
          result.FINAL_VERDICT,
        ).toBe("HOLD");
      },
    );

    it(
      "rejects Gate F UP_TO_DATE because the new review commit must be fast-forwarded locally",
      async () => {
        const harness =
          createHarness();

        harness
          .executeLocalObsidianPullFn
          .mockResolvedValueOnce({
            ok: true,
            code: "UP_TO_DATE",
          });

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "GATE_F_NOT_FAST_FORWARDED",
        });
      },
    );

    it(
      "passes only after Gate F reports FAST_FORWARDED",
      async () => {
        const harness =
          createHarness();

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(
          harness
            .executeLocalObsidianPullFn,
        ).toHaveBeenCalledTimes(1);

        expect(result).toEqual({
          FINAL_VERDICT: "PASS",
          FAILURE_CODE: null,
        });
      },
    );

    it(
      "constructs production dependencies from the certified adapters",
      () => {
        const dependencies =
          createProductionFoundationReviewDependencies();

        expect(
          dependencies.transactionAdapter,
        ).toBeDefined();

        expect(
          dependencies.isolationAdapter,
        ).toBeDefined();

        expect(
          dependencies.pullAdapter,
        ).toBeDefined();

        expect(
          dependencies.readTarget,
        ).toBeTypeOf("function");

        expect(
          dependencies.now,
        ).toBeTypeOf("function");

        expect(
          dependencies.executeMutationPipelineFn,
        ).toBeTypeOf("function");

        expect(
          dependencies.executeLocalObsidianPullFn,
        ).toBeTypeOf("function");
      },
    );
  },
);
