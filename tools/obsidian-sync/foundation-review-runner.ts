import {
  readFile,
} from "node:fs/promises";

import {
  resolve,
} from "node:path";

import {
  pathToFileURL,
} from "node:url";

import {
  executeMutationPipeline,
  type MutationPipelineRequest,
} from "./mutation-pipeline";

import {
  executeLocalObsidianPull,
} from "./local-pull";

import {
  NodeIsolationAdapter,
} from "./node-isolation-adapter";

import {
  GitCliAdapter as GitCliTransactionAdapter,
} from "./git-cli-adapter";

import {
  GitCliPullAdapter,
} from "./git-cli-pull-adapter";

export type FoundationReviewEvidence = {
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

export type FoundationReviewDependencies = {
  environment:
    Record<string, string | undefined>;

  transactionAdapter?: {
    getLocalHead:
      (
        repoPath: string,
        branch: string,
      ) => Promise<string>;

    getRemoteHead:
      (
        repoPath: string,
        branch: string,
      ) => Promise<string>;
  };

  readTarget?:
    (
      vaultRoot: string,
    ) => Promise<TargetSnapshot>;

  now?:
    () => Date;

  executeMutationPipelineFn?:
    (
      request:
        MutationPipelineRequest,
      pipelineDependencies: {
        isolationAdapter:
          unknown;

        gitAdapter:
          unknown;
      },
    ) => Promise<unknown>;

  isolationAdapter?:
    unknown;

  pullAdapter?:
    unknown;

  executeLocalObsidianPullFn?:
    (
      pullRequest:
        unknown,
      pullDependencies: {
        isolationAdapter:
          unknown;

        pullAdapter:
          unknown;
      },
    ) => Promise<unknown>;
};

const ARM_KEY =
  "AI_SHOWROOM_FOUNDATION_REVIEW_ARM";

const REQUIRED_ARM =
  "AUTHORIZED_BY_TIAGO";

const TASK =
  "TASK-AS-0005" as const;

const TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SOL/FOUNDATION/OBSIDIAN-AI-SYNC-FOUNDATION.md" as const;

const VAULT_ROOT =
  String.raw`C:\Users\diore\Documents\RAIOC V2`;

const REMOTE =
  "https://github.com/emanuelrendas/raioc-obsidian-vault2.git" as const;

const BASE_SHA =
  "bc856c1da42209e57ffd96601e3ed75ddaa0b279" as const;

const FOUNDATION_CREATION_BASE =
  "5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7" as const;

const CREATION_RUNNER_APPLICATION_SHA =
  "9a620ea3edb318698c655897d017f3b8b5c13c47" as const;

const CANONICAL_APPLICATION_BASELINE =
  "df87a2bd96b2c22d3da1931cb1f2aec7788b1c8f" as const;

const CURRENT_STATUS_MARKER =
  "Current Status: ACTIVE";

const REVIEW_STATUS_MARKER =
  "Current Status: REVIEW";

const CURRENT_LIFECYCLE_MARKER =
  `Current Foundation lifecycle state remains:

ACTIVE`;

const REVIEW_LIFECYCLE_MARKER =
  `Current Foundation lifecycle state remains:

REVIEW`;

const INITIAL_STATE_RECORD =
  `## Initial State Record

Foundation Status: ACTIVE
Recorded By: Sol
Creation Authority: Tiago-approved Foundation architecture
Creation Base: 5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7
TASK-AS-0003: DONE
TASK-AS-0003 Closure: 37b64df88dad23a9c5fc674a4f0236c5619e5bf2
Application Baseline: df87a2bd96b2c22d3da1931cb1f2aec7788b1c8f
Milestone 2: STRICT HOLD`;

function countOccurrences(
  content: string,
  marker: string,
): number {
  return (
    content.split(marker).length -
    1
  );
}

function buildReviewStateEvent(
  timestamp: string,
): string {
  return `## State Update — ${timestamp}

Subsystem: Obsidian AI Sync Foundation
Task: TASK-AS-0005
Human Owner / Authorizer: Tiago
Execution Agent: ChatGPT — AI SHOWROOM
Session Alias: Sol
Previous Status: ACTIVE
New Status: REVIEW
Reason: Foundation dossier creation commit bc856c1da42209e57ffd96601e3ed75ddaa0b279 certified by independent Flash audit and independent Spark architecture challenge. Foundation advancing to formal review stage for final freeze qualification.
Foundation Creation Base: ${FOUNDATION_CREATION_BASE}
Creation Commit: ${BASE_SHA}
Review Transition Base: ${BASE_SHA}
Creation Runner Application SHA: ${CREATION_RUNNER_APPLICATION_SHA}
Canonical Application Baseline Anchor: ${CANONICAL_APPLICATION_BASELINE}
Flash Creation Audit: PASS
Spark Creation Challenge: PASS
Milestone 2: STRICT HOLD`;
}

export async function runFoundationReview(
  dependencies:
    FoundationReviewDependencies,
): Promise<FoundationReviewEvidence> {
  if (
    dependencies.environment[ARM_KEY] !==
    REQUIRED_ARM
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "FOUNDATION_REVIEW_NOT_ARMED",
    };
  }

  if (
    dependencies.transactionAdapter
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
        "FOUNDATION_REVIEW_DEPENDENCY_MISSING",
    };
  }

  const before =
    await dependencies
      .readTarget(
        VAULT_ROOT,
      );

  if (
    !before.exists
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "FOUNDATION_REVIEW_TARGET_MISSING",
    };
  }

  if (
    countOccurrences(
      before.content,
      CURRENT_STATUS_MARKER,
    ) !== 1
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "FOUNDATION_CURRENT_STATUS_MISMATCH",
    };
  }

  if (
    countOccurrences(
      before.content,
      CURRENT_LIFECYCLE_MARKER,
    ) !== 1
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "FOUNDATION_LIFECYCLE_MARKER_MISMATCH",
    };
  }

  if (
    !before.content.includes(
      INITIAL_STATE_RECORD,
    )
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "FOUNDATION_INITIAL_STATE_RECORD_MISMATCH",
    };
  }

  const transitionedContent =
    before.content
      .replace(
        CURRENT_STATUS_MARKER,
        REVIEW_STATUS_MARKER,
      )
      .replace(
        CURRENT_LIFECYCLE_MARKER,
        REVIEW_LIFECYCLE_MARKER,
      );

  const event =
    buildReviewStateEvent(
      dependencies
        .now()
        .toISOString(),
    );

  const proposedContent =
    `${transitionedContent}\n\n---\n\n${event}`;

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
        "chore(obsidian): advance foundation to review",

      changes: [
        {
          request: {
            project:
              "ai-showroom",

            task:
              TASK,

            actor:
              "sol",

            operation:
              "update",

            mutationKind:
              "substantive",

            target:
              TARGET,
          },

          artifact: {
            exists:
              true,

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
              TASK,
          },

          taskScope: {
            project:
              "ai-showroom",

            task:
              TASK,

            allowedTargetPrefixes: [
              "04 - AI WORKSPACE/AI-SHOWROOM/SOL/",
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

  if (
    !dependencies
      .executeMutationPipelineFn
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "FOUNDATION_REVIEW_DEPENDENCY_MISSING",
    };
  }

  const mutationDecision =
    await dependencies
      .executeMutationPipelineFn(
        mutationRequest,
        {
          isolationAdapter:
            dependencies
              .isolationAdapter,

          gitAdapter:
            dependencies
              .transactionAdapter,
        },
      );

  if (
    typeof mutationDecision ===
      "object" &&
    mutationDecision !==
      null &&
    "ok" in mutationDecision &&
    mutationDecision.ok ===
      false
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "MUTATION_PIPELINE_REJECTED",
    };
  }

  if (
    !dependencies
      .executeLocalObsidianPullFn
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "FOUNDATION_REVIEW_DEPENDENCY_MISSING",
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
    typeof pullDecision ===
      "object" &&
    pullDecision !==
      null &&
    "ok" in pullDecision &&
    pullDecision.ok ===
      false
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "GATE_F_REJECTED",
    };
  }

  if (
    typeof pullDecision !==
      "object" ||
    pullDecision ===
      null ||
    !("code" in pullDecision) ||
    pullDecision.code !==
      "FAST_FORWARDED"
  ) {
    return {
      FINAL_VERDICT:
        "HOLD",

      FAILURE_CODE:
        "GATE_F_NOT_FAST_FORWARDED",
    };
  }

  return {
    FINAL_VERDICT:
      "PASS",

    FAILURE_CODE:
      null,
  };
}

export function createProductionFoundationReviewDependencies():
  FoundationReviewDependencies {
  const isolationAdapter =
    new NodeIsolationAdapter();

  const transactionAdapter =
    new GitCliTransactionAdapter();

  const pullAdapter =
    new GitCliPullAdapter();

  return {
    environment:
      process.env,

    isolationAdapter,

    transactionAdapter,

    pullAdapter,

    readTarget:
      async (
        vaultRoot,
      ) => {
        try {
          return {
            exists:
              true,

            content:
              await readFile(
                resolve(
                  vaultRoot,
                  TARGET,
                ),
                "utf8",
              ),
          };
        } catch (
          error
        ) {
          if (
            (
              error as NodeJS.ErrnoException
            ).code ===
            "ENOENT"
          ) {
            return {
              exists:
                false,

              content:
                "",
            };
          }

          throw error;
        }
      },

    now:
      () =>
        new Date(),

    executeMutationPipelineFn:
      async (
        request,
      ) =>
        executeMutationPipeline(
          request,
          {
            isolationAdapter,

            gitAdapter:
              transactionAdapter,
          },
        ),

    executeLocalObsidianPullFn:
      async (
        request,
      ) =>
        executeLocalObsidianPull(
          request as Parameters<
            typeof executeLocalObsidianPull
          >[0],
          {
            isolationAdapter,
            pullAdapter,
          },
        ),
  };
}

export async function main():
  Promise<void> {
  const evidence =
    await runFoundationReview(
      createProductionFoundationReviewDependencies(),
    );

  console.log(
    JSON.stringify(
      evidence,
      null,
      2,
    ),
  );

  if (
    evidence.FINAL_VERDICT !==
      "PASS"
  ) {
    process.exitCode =
      1;
  }
}

const entry =
  process.argv[1];

if (
  entry &&
  pathToFileURL(
    resolve(
      entry,
    ),
  ).href ===
    import.meta.url
) {
  void main();
}
