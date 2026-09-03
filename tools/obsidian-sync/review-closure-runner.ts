import type {
  MutationPipelineDecision,
  MutationPipelineRequest,
} from "./mutation-pipeline";

import type {
  GitAdapter,
} from "./git-adapter";

import type {
  IsolationAdapter,
} from "./isolation-adapter";

import type {
  LocalPullAdapter,
} from "./local-pull-adapter";

import type {
  executeLocalObsidianPull,
} from "./local-pull";

export const REVIEW_CLOSURE_ARM_VALUE =
  "AUTHORIZED_BY_TIAGO" as const;

const TASK =
  "TASK-AS-0003" as const;

const TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SPARK/STATE-UPDATES/TASK-AS-0003.md" as const;

const VAULT_ROOT =
  String.raw`C:\Users\diore\Documents\RAIOC V2`;

const REMOTE =
  "https://github.com/emanuelrendas/raioc-obsidian-vault2.git" as const;

const BASE_SHA =
  "c0ff49eba3e7536933663d21e6e0ac1bf0e423a0" as const;

const APPROVAL_ID =
  "AS-APPROVAL-20260902-TASK-AS-0003-REVIEW-TO-DONE" as const;

export type ReviewClosureEvidence = {
  FINAL_VERDICT:
    "PASS" | "HOLD";

  FAILURE_CODE:
    string | null;
};

type TargetSnapshot = {
  exists:
    boolean;

  content:
    string;
};


export type ReviewClosureRunnerDependencies = {
  environment:
    Record<string, string | undefined>;

  transactionAdapter?:
    Pick<
      GitAdapter,
      "getLocalHead" | "getRemoteHead"
    >;

  isolationAdapter:
    IsolationAdapter;

  pullAdapter:
    LocalPullAdapter;

  readTarget?:
    (
      vaultRoot: string,
    ) => Promise<TargetSnapshot>;

  now?:
    () => Date;

  executeMutationPipelineFn:
    (
      request:
        MutationPipelineRequest,
    ) => Promise<MutationPipelineDecision>;

  executeLocalObsidianPullFn:
    typeof executeLocalObsidianPull;
};

function buildClosureEvent(
  timestamp: string,
): string {
  return `## State Update — ${timestamp}

Agent: Spark
Task: TASK-AS-0003
Previous Status: review
New Status: done
Reason: Human-approved final task closure after independent Flash and Spark PASS.
Evidence: 6132ec562a7c064b46437930c5f7a0ed571f4755
Flash Audit: PASS
Spark Challenge: PASS
Closure Authority: Tiago
Milestone 2: HOLD`;
}

export async function runReviewClosure(

  dependencies:
    ReviewClosureRunnerDependencies,
): Promise<ReviewClosureEvidence> {
  const arm =
    dependencies
      .environment
      .AI_SHOWROOM_REVIEW_CLOSURE_ARM;

  if (
    arm !==
    REVIEW_CLOSURE_ARM_VALUE
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "REVIEW_CLOSURE_NOT_ARMED",
    };
  }
  if (
    dependencies
      .transactionAdapter
  ) {
    const localHead =
      await dependencies
        .transactionAdapter
        .getLocalHead(
          VAULT_ROOT,
          "main",
        );

    if (
      localHead !==
      BASE_SHA
    ) {
      return {
        FINAL_VERDICT:
          "HOLD",

        FAILURE_CODE:
          "INITIAL_CONVERGENCE_FAILURE",
      };
    }


    const remoteHead =
      await dependencies
        .transactionAdapter
        .getRemoteHead(
          VAULT_ROOT,
          "main",
        );

    if (
      remoteHead !==
      BASE_SHA
    ) {
      return {
        FINAL_VERDICT:
          "HOLD",

        FAILURE_CODE:
          "INITIAL_CONVERGENCE_FAILURE",
      };
    }

  }
  if (
    !dependencies.readTarget ||
    !dependencies.now
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "REVIEW_CLOSURE_DEPENDENCY_MISSING",
    };
  }

  const before =
    await dependencies
      .readTarget(
        VAULT_ROOT,
      );

  const event =
    buildClosureEvent(
      dependencies
        .now()
        .toISOString(),
    );

  const proposedContent =
    before.exists
      ? `${before.content}\n\n${event}`
      : event;

  const mutationRequest:
    MutationPipelineRequest = {
    transaction: {
      project:
        "ai-showroom",

      task:
        TASK,

      repoPath:
        VAULT_ROOT,

      targetBranch:
        "main",

      expectedBaseSha:
        BASE_SHA,

      commitMessage:
        "chore(obsidian): close TASK-AS-0003 after review",

      changes: [
        {
          request: {
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

            reviewClosureApproval: {
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
                BASE_SHA,

              approvalId:
                APPROVAL_ID,
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
              TASK,
          },

          taskScope: {
            project:
              "ai-showroom",

            task:
              TASK,

            allowedTargetPrefixes: [
              "04 - AI WORKSPACE/AI-SHOWROOM/SPARK/",
            ],
          },

          currentContent:
            before.content,

          proposedContent,
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
  };

  const mutationDecision =
    await dependencies
      .executeMutationPipelineFn(
        mutationRequest,
      );

  if (
    !mutationDecision.ok
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        `MUTATION_PIPELINE:${mutationDecision.code}`,
    };
  }
  const pullDecision =
    await dependencies
    .executeLocalObsidianPullFn(
      {
        project:
          "ai-showroom",

        repoPath:
          VAULT_ROOT,

        targetBranch:
          "main",

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
      },
      {
        isolationAdapter:
          dependencies
            .isolationAdapter,

        pullAdapter:
          dependencies
            .pullAdapter,
      },
    );
  if (
    !pullDecision.ok ||
    pullDecision.code !==
      "FAST_FORWARDED"
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        `GATE_F:${pullDecision.code}`,
    };
  }
  return {
    FINAL_VERDICT:
      "PASS",

    FAILURE_CODE:
      null,
  };
}