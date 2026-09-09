import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createProductionFoundationReviewDependencies,
  readAuthorizedApplicationShaFromArgv,
  runFoundationReview,
  type FoundationReviewDependencies,
} from "../../tools/obsidian-sync/foundation-review-runner";

import {
  runApplicationPreflight,
  type ApplicationPreflightGitAdapter,
} from "../../tools/obsidian-sync/application-preflight";

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

  const applicationPreflightFn =
    vi.fn<
      NonNullable<
        FoundationReviewDependencies["applicationPreflightFn"]
      >
    >(
      async () => ({
        ok: true,
        code: "APPLICATION_PREFLIGHT_VERIFIED",
        verifiedApplicationSha:
          "279dd001c971f93036bac472b10669033311e24c",
      }),
    );

  const applicationGitAdapter: ApplicationPreflightGitAdapter = {
    isClean: vi.fn(
      async () => true,
    ),

    getCurrentHead: vi.fn(
      async () =>
        "279dd001c971f93036bac472b10669033311e24c",
    ),

    getRemoteUrl: vi.fn(
      async () =>
        "https://github.com/emanuelrendas/ai-showroom.git",
    ),
  };

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

    applicationGitAdapter,
    applicationPreflightFn,

    // FIND-AS-001 / A1: per-execution authorized SHA, plain test fixture
    // data threaded through the (mocked, by default) applicationPreflightFn
    // above. Individual tests below override this to prove the runner
    // never substitutes anything else for it.
    authorizedApplicationSha:
      "279dd001c971f93036bac472b10669033311e24c",

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
    applicationPreflightFn,
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
      "invokes the application preflight and blocks the mutation pipeline when it fails (FIND-AS-001)",
      async () => {
        const harness =
          createHarness();

        harness
          .applicationPreflightFn
          .mockResolvedValueOnce({
            ok: false,
            code: "APPLICATION_PREFLIGHT_HEAD_MISMATCH",
          });

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "APPLICATION_PREFLIGHT_HEAD_MISMATCH",
        });

        expect(
          harness
            .applicationPreflightFn,
        ).toHaveBeenCalledTimes(1);

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "invokes the application preflight before the mutation pipeline on the successful path (FIND-AS-001)",
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
            .applicationPreflightFn,
        ).toHaveBeenCalledTimes(1);

        expect(
          harness
            .executeMutationPipelineFn,
        ).toHaveBeenCalledTimes(1);

        const preflightOrder =
          harness
            .applicationPreflightFn
            .mock
            .invocationCallOrder[0];

        const mutationOrder =
          harness
            .executeMutationPipelineFn
            .mock
            .invocationCallOrder[0];

        expect(
          preflightOrder,
        ).toBeLessThan(
          mutationOrder as number,
        );
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
      "accepts a CRLF Foundation fixture and preserves CRLF output",
      async () => {
        const harness =
          createHarness();

        const crlfContent =
          CURRENT_CONTENT.replace(
            /\n/g,
            "\r\n",
          );

        expect(
          crlfContent.includes(
            "\r\n",
          ),
        ).toBe(true);

        harness
          .readTarget
          .mockResolvedValueOnce({
            exists: true,
            content: crlfContent,
          });

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
          request.transaction.changes,
        ).toHaveLength(1);

        const proposed =
          request
            .transaction
            .changes[0]
            .proposedContent;

        expect(proposed).toContain(
          "Current Status: REVIEW\r\n",
        );

        expect(proposed).toContain(
          "Current Foundation lifecycle state remains:\r\n\r\nREVIEW",
        );

        expect(proposed).toContain(
          INITIAL_STATE_RECORD.replace(
            /\n/g,
            "\r\n",
          ),
        );

        expect(proposed).toContain(
          "Milestone 2: STRICT HOLD",
        );

        expect(
          proposed.match(
            /## State Update —/g,
          ),
        ).toHaveLength(1);

        const withoutCrlf =
          proposed.replace(
            /\r\n/g,
            "",
          );

        expect(
          withoutCrlf.includes("\n"),
        ).toBe(false);
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

        expect(
          dependencies.applicationGitAdapter,
        ).toBeDefined();

        expect(
          dependencies.applicationPreflightFn,
        ).toBeTypeOf("function");

        // FIND-AS-001 / A1 (RED-2): the production factory must carry NO
        // default, fallback, or historical authorized application SHA.
        // A bare call to this factory must fail closed on the
        // application preflight, not silently pass with 279dd001....
        expect(
          dependencies.authorizedApplicationSha,
        ).toBeUndefined();
      },
    );
  },
);

describe(
  "FIND-AS-001 / Option A1 — per-execution authorized application SHA (RED-2)",
  () => {
    const LIVE_HEAD_A =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const LIVE_HEAD_B =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    function realApplicationGitAdapter(
      overrides: Partial<ApplicationPreflightGitAdapter> = {},
    ): ApplicationPreflightGitAdapter {
      return {
        isClean:
          vi.fn(
            async () =>
              true,
          ),

        getCurrentHead:
          vi.fn(
            async () =>
              LIVE_HEAD_A,
          ),

        getRemoteUrl:
          vi.fn(
            async () =>
              "https://github.com/emanuelrendas/ai-showroom.git",
          ),

        ...overrides,
      };
    }

    it(
      "holds and never reaches the mutation pipeline when no per-execution authorized SHA is supplied",
      async () => {
        const harness =
          createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapter();

        harness.dependencies.authorizedApplicationSha =
          undefined;

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "APPLICATION_PREFLIGHT_SHA_MISSING",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds and never reaches the mutation pipeline when the per-execution authorized SHA is malformed",
      async () => {
        const harness =
          createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapter();

        harness.dependencies.authorizedApplicationSha =
          "279dd00";

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "APPLICATION_PREFLIGHT_SHA_MALFORMED",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "passes the application preflight and reaches the mutation pipeline when the authorized SHA exactly matches live HEAD (authority A / HEAD A)",
      async () => {
        const harness =
          createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapter({
            getCurrentHead:
              vi.fn(
                async () =>
                  LIVE_HEAD_A,
              ),
          });

        harness.dependencies.authorizedApplicationSha =
          LIVE_HEAD_A;

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
      },
    );

    it(
      "holds with APPLICATION_PREFLIGHT_HEAD_MISMATCH and blocks the mutation pipeline when the authorized SHA does not match live HEAD (authority A / HEAD B)",
      async () => {
        const harness =
          createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapter({
            getCurrentHead:
              vi.fn(
                async () =>
                  LIVE_HEAD_B,
              ),
          });

        harness.dependencies.authorizedApplicationSha =
          LIVE_HEAD_A;

        const result =
          await runFoundationReview(
            harness.dependencies,
          );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "APPLICATION_PREFLIGHT_HEAD_MISMATCH",
        });

        expect(
          harness
            .executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "a second, independent execution authorized against a different SHA and a different live HEAD also passes, without any source change (authority B / HEAD B)",
      async () => {
        const harness =
          createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapter({
            getCurrentHead:
              vi.fn(
                async () =>
                  LIVE_HEAD_B,
              ),
          });

        harness.dependencies.authorizedApplicationSha =
          LIVE_HEAD_B;

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
      },
    );

    it(
      "threads the exact per-execution authorized SHA into the preflight request, never substituting the historical FIND-AS-001 SHA or any other value",
      async () => {
        const harness =
          createHarness();

        harness.dependencies.authorizedApplicationSha =
          undefined;

        await runFoundationReview(
          harness.dependencies,
        );

        expect(
          harness
            .applicationPreflightFn,
        ).toHaveBeenCalledTimes(1);

        const [
          request,
        ] =
          harness
            .applicationPreflightFn
            .mock.calls[0]!;

        expect(
          request.expectedApplicationSha,
        ).toBeUndefined();

        expect(
          request.expectedApplicationSha,
        ).not.toBe(
          "279dd001c971f93036bac472b10669033311e24c",
        );
      },
    );
  },
);

describe(
  "FIND-AS-001 — readAuthorizedApplicationShaFromArgv (RED-3, blocker 2: duplicate CLI authority arguments)",
  () => {
    const SHA_A =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const SHA_B =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    it(
      "returns undefined when the --authorized-application-sha= flag is absent (zero occurrences)",
      () => {
        const result =
          readAuthorizedApplicationShaFromArgv(
            [
              "--some-other-flag=value",
            ],
          );

        expect(result).toBeUndefined();
      },
    );

    it(
      "returns the supplied value when the --authorized-application-sha= flag appears exactly once (one occurrence)",
      () => {
        const result =
          readAuthorizedApplicationShaFromArgv(
            [
              `--authorized-application-sha=${SHA_A}`,
            ],
          );

        expect(result).toBe(SHA_A);
      },
    );

    it(
      "returns undefined, not the first, not the last, and not a merged value, when the flag appears twice with two DIFFERENT values (duplicate-conflicting)",
      () => {
        const result =
          readAuthorizedApplicationShaFromArgv(
            [
              `--authorized-application-sha=${SHA_A}`,
              `--authorized-application-sha=${SHA_B}`,
            ],
          );

        // Do not select first. Do not select last. Do not merge values.
        // Do not infer intent. Ambiguous authority input fails closed.
        expect(result).toBeUndefined();
        expect(result).not.toBe(SHA_A);
        expect(result).not.toBe(SHA_B);
      },
    );

    it(
      "returns undefined even when the flag appears twice with the SAME value (duplicate-identical) — repetition itself is the defect, not disagreement",
      () => {
        const result =
          readAuthorizedApplicationShaFromArgv(
            [
              `--authorized-application-sha=${SHA_A}`,
              `--authorized-application-sha=${SHA_A}`,
            ],
          );

        expect(result).toBeUndefined();
      },
    );
  },
);

// FIND-AS-001 independent review, blocker 3 (RED-4): two independent
// fail-closed boundaries.
//
// Layer 1 (proven against the REAL runApplicationPreflight): a Git
// inspection failure inside the preflight itself must resolve to a
// normal HOLD/APPLICATION_PREFLIGHT_GIT_ERROR result, not an unhandled
// exception that reaches runFoundationReview.
//
// Layer 2 (proven independently of Layer 1, via an injected
// applicationPreflightFn that throws directly): even if a
// dependency-injected preflight implementation itself misbehaves and
// throws — bypassing whatever Layer 1 does — runFoundationReview must
// still fail closed with HOLD/APPLICATION_PREFLIGHT_EXECUTION_ERROR,
// never let the exception propagate, and never invoke the mutation
// pipeline.
describe(
  "FIND-AS-001 independent review, blocker 3 — fail-closed Git/preflight exception handling (RED-4)",
  () => {
    function realApplicationGitAdapterWithFailure(
      overrides: Partial<ApplicationPreflightGitAdapter>,
    ): ApplicationPreflightGitAdapter {
      return {
        isClean: vi.fn(async () => true),

        getCurrentHead: vi.fn(
          async () =>
            "279dd001c971f93036bac472b10669033311e24c",
        ),

        getRemoteUrl: vi.fn(
          async () =>
            "https://github.com/emanuelrendas/ai-showroom.git",
        ),

        ...overrides,
      };
    }

    it(
      "holds with APPLICATION_PREFLIGHT_GIT_ERROR and blocks the mutation pipeline when the REAL preflight's getRemoteUrl rejects",
      async () => {
        const harness = createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapterWithFailure({
            getRemoteUrl: vi.fn(async () => {
              throw new Error("git: origin remote not found");
            }),
          });

        const result = await runFoundationReview(
          harness.dependencies,
        );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE: "APPLICATION_PREFLIGHT_GIT_ERROR",
        });

        expect(
          harness.executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds with APPLICATION_PREFLIGHT_GIT_ERROR and blocks the mutation pipeline when the REAL preflight's isClean rejects",
      async () => {
        const harness = createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapterWithFailure({
            isClean: vi.fn(async () => {
              throw new Error("git: status command failed");
            }),
          });

        const result = await runFoundationReview(
          harness.dependencies,
        );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE: "APPLICATION_PREFLIGHT_GIT_ERROR",
        });

        expect(
          harness.executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds with APPLICATION_PREFLIGHT_GIT_ERROR and blocks the mutation pipeline when the REAL preflight's getCurrentHead rejects",
      async () => {
        const harness = createHarness();

        harness.dependencies.applicationPreflightFn =
          runApplicationPreflight;

        harness.dependencies.applicationGitAdapter =
          realApplicationGitAdapterWithFailure({
            getCurrentHead: vi.fn(async () => {
              throw new Error("git: rev-parse HEAD failed");
            }),
          });

        const result = await runFoundationReview(
          harness.dependencies,
        );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE: "APPLICATION_PREFLIGHT_GIT_ERROR",
        });

        expect(
          harness.executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "holds with APPLICATION_PREFLIGHT_EXECUTION_ERROR and blocks the mutation pipeline when the injected applicationPreflightFn itself throws unexpectedly",
      async () => {
        const harness = createHarness();

        harness.applicationPreflightFn.mockImplementationOnce(
          async () => {
            throw new Error(
              "unexpected crash inside a custom preflight implementation",
            );
          },
        );

        const result = await runFoundationReview(
          harness.dependencies,
        );

        expect(result).toEqual({
          FINAL_VERDICT: "HOLD",
          FAILURE_CODE:
            "APPLICATION_PREFLIGHT_EXECUTION_ERROR",
        });

        expect(
          harness.executeMutationPipelineFn,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "the existing successful preflight path is unaffected by the new exception boundary",
      async () => {
        const harness = createHarness();

        const result = await runFoundationReview(
          harness.dependencies,
        );

        expect(result).toEqual({
          FINAL_VERDICT: "PASS",
          FAILURE_CODE: null,
        });

        expect(
          harness.executeMutationPipelineFn,
        ).toHaveBeenCalledTimes(1);
      },
    );
  },
);
