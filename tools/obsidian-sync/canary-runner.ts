import {
  execFile,
} from "node:child_process";

import {
  createHash,
} from "node:crypto";

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
  createTaskClosedResult,
  isTaskClosed,
  type TaskClosedResult,
} from "./closed-tasks";

import {
  executeMutationPipeline,
  type MutationPipelineDecision,
  type MutationPipelineRequest,
} from "./mutation-pipeline";

import {
  executeLocalObsidianPull,
} from "./local-pull";

import {
  verifyIsolation,
} from "./isolation-gate";

import {
  NodeIsolationAdapter,
} from "./node-isolation-adapter";

import {
  GitCliAdapter as GitCliTransactionAdapter,
} from "./git-cli-adapter";

import {
  GitCliPullAdapter,
} from "./git-cli-pull-adapter";

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
  LocalPullDecision,
  LocalPullRequest,
} from "./local-pull-types";

export const GATE_G_TASK =
  "TASK-AS-0003" as const;

export const GATE_G_TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SPARK/STATE-UPDATES/TASK-AS-0003.md" as const;

export const GATE_G_VAULT_ROOT =
  String.raw`C:\Users\diore\Documents\RAIOC V2`;

export const GATE_G_REMOTE =
  "https://github.com/emanuelrendas/raioc-obsidian-vault2.git" as const;

export const GATE_G_BRANCH =
  "main" as const;

export const GATE_G_COMMIT_MESSAGE =
  "chore(obsidian): TASK-AS-0003 Gate G controlled canary" as const;

export const GATE_G_ARM_VALUE =
  "AUTHORIZED_BY_TIAGO" as const;

const FULL_SHA_PATTERN =
  /^[0-9a-f]{40}$/;

const STATE_EVENT_PATTERN =
  /^## State (?:Update|Correction) — /gm;

export type GateGCanaryEvidence = {
  APPLICATION_SHA:
    string | null;

  APPLICATION_TREE:
    "CLEAN" | "DIRTY" | "UNKNOWN";

  LOCAL_BASE_SHA:
    string | null;

  REMOTE_BASE_SHA:
    string | null;

  TARGET_EXISTED:
    "YES" | "NO" | "UNKNOWN";

  TARGET_BEFORE_SHA256:
    string | "MISSING" | null;

  GATE_D_PREFLIGHT:
    string | null;

  GATE_A:
    string | null;

  GATE_B:
    string | null;

  GATE_D_BEFORE_PUSH:
    string | null;

  GATE_C:
    string | null;

  CANARY_RESULT_SHA:
    string | null;

  REMOTE_POST_PUSH:
    string | null;

  PRIMARY_LOCAL_POST_PUSH:
    string | null;

  GATE_D_BEFORE_PULL:
    string | null;

  GATE_F:
    string | null;

  LOCAL_FINAL_SHA:
    string | null;

  REMOTE_FINAL_SHA:
    string | null;

  CHANGED_FILE_COUNT:
    number | null;

  CHANGED_FILE:
    string | null;

  COMMIT_COUNT:
    number | null;

  COMMIT_PARENT:
    string | null;

  STATE_EVENTS_ADDED:
    number | null;

  PRIOR_HISTORY_PRESERVED:
    "PASS" | "FAIL" | "UNKNOWN";

  FINAL_TREE:
    "CLEAN" | "DIRTY" | "UNKNOWN";

  SECRET_DISCLOSURE:
    "NONE" | "VIOLATION";

  FINAL_VERDICT:
    "PASS" | "HOLD";

  FAILURE_CODE?:
    string;
};

type ApplicationState = {
  repoRoot: string;
  head: string;
  clean: boolean;
};

type TargetSnapshot = {
  exists: boolean;
  content: string;
  sha256: string | null;
  stateEventCount: number;
};

type ReadOnlyGit =
  (
    cwd: string,
    args: readonly string[],
  ) => Promise<string>;

type IsolationVerifier =
  typeof verifyIsolation;

type MutationExecutor =
  typeof executeMutationPipeline;

type PullExecutor =
  typeof executeLocalObsidianPull;

export type GateGRunnerDependencies = {
  environment:
    Record<string, string | undefined>;

  isolationAdapter:
    IsolationAdapter;

  transactionAdapter:
    GitAdapter;

  pullAdapter:
    LocalPullAdapter;

  verifyIsolationFn:
    IsolationVerifier;

  executeMutationPipelineFn:
    MutationExecutor;

  executeLocalObsidianPullFn:
    PullExecutor;

  getApplicationState:
    () => Promise<ApplicationState>;

  readTarget:
    (
      vaultRoot: string,
    ) => Promise<TargetSnapshot>;

  readOnlyGit:
    ReadOnlyGit;

  now:
    () => Date;

  emitEvidence:
    (
      evidence:
        GateGCanaryEvidence,
    ) => void;
};

class CanaryHold
  extends Error {
  constructor(
    readonly code: string,
  ) {
    super(code);

    this.name =
      "CanaryHold";
  }
}

function hold(
  code: string,
): never {
  throw new CanaryHold(
    code,
  );
}

export function createInitialEvidence():
  GateGCanaryEvidence {
  return {
    APPLICATION_SHA:
      null,

    APPLICATION_TREE:
      "UNKNOWN",

    LOCAL_BASE_SHA:
      null,

    REMOTE_BASE_SHA:
      null,

    TARGET_EXISTED:
      "UNKNOWN",

    TARGET_BEFORE_SHA256:
      null,

    GATE_D_PREFLIGHT:
      null,

    GATE_A:
      null,

    GATE_B:
      null,

    GATE_D_BEFORE_PUSH:
      null,

    GATE_C:
      null,

    CANARY_RESULT_SHA:
      null,

    REMOTE_POST_PUSH:
      null,

    PRIMARY_LOCAL_POST_PUSH:
      null,

    GATE_D_BEFORE_PULL:
      null,

    GATE_F:
      null,

    LOCAL_FINAL_SHA:
      null,

    REMOTE_FINAL_SHA:
      null,

    CHANGED_FILE_COUNT:
      null,

    CHANGED_FILE:
      null,

    COMMIT_COUNT:
      null,

    COMMIT_PARENT:
      null,

    STATE_EVENTS_ADDED:
      null,

    PRIOR_HISTORY_PRESERVED:
      "UNKNOWN",

    FINAL_TREE:
      "UNKNOWN",

    SECRET_DISCLOSURE:
      "NONE",

    FINAL_VERDICT:
      "HOLD",
  };
}

function canonicalWindowsPath(
  value: string,
): string {
  return value
    .trim()
    .replaceAll(
      "\\",
      "/",
    )
    .replace(
      /\/+$/,
      "",
    )
    .toLowerCase();
}

function requireEnvironment(
  environment:
    Record<string, string | undefined>,
  key: string,
): string {
  const value =
    environment[key]
      ?.trim();

  if (!value) {
    hold(
      `MISSING_ENVIRONMENT:${key}`,
    );
  }

  return value;
}

function assertEnvironmentContract(
  environment:
    Record<string, string | undefined>,
): {
  vaultRoot: string;
  remote: string;
  applicationSha: string;
} {
  const vaultRoot =
    requireEnvironment(
      environment,
      "AI_SHOWROOM_VAULT_PATH",
    );

  const remote =
    requireEnvironment(
      environment,
      "AI_SHOWROOM_VAULT_REMOTE",
    );

  const applicationSha =
    requireEnvironment(
      environment,
      "AI_SHOWROOM_CANARY_APPLICATION_SHA",
    );

  const arm =
    requireEnvironment(
      environment,
      "AI_SHOWROOM_GATE_G_ARM",
    );

  if (
    arm !==
    GATE_G_ARM_VALUE
  ) {
    hold(
      "LIVE_CANARY_NOT_ARMED",
    );
  }

  if (
    canonicalWindowsPath(
      vaultRoot,
    ) !==
    canonicalWindowsPath(
      GATE_G_VAULT_ROOT,
    )
  ) {
    hold(
      "VAULT_ENVIRONMENT_MISMATCH",
    );
  }

  if (
    remote !==
    GATE_G_REMOTE
  ) {
    hold(
      "REMOTE_ENVIRONMENT_MISMATCH",
    );
  }

  if (
    !FULL_SHA_PATTERN.test(
      applicationSha,
    )
  ) {
    hold(
      "INVALID_APPLICATION_BASELINE_SHA",
    );
  }

  return {
    vaultRoot,
    remote,
    applicationSha,
  };
}

function sha256(
  value: Buffer,
): string {
  return createHash(
    "sha256",
  )
    .update(value)
    .digest("hex");
}

function countStateEvents(
  content: string,
): number {
  return (
    content.match(
      STATE_EVENT_PATTERN,
    ) ?? []
  ).length;
}

export function buildGateGCanaryEvent(
  timestamp: string,
  applicationSha: string,
): string {
  return `## State Update — ${timestamp}

Agent: Spark
Task: TASK-AS-0003
Previous Status: active
New Status: active
Reason: Gate G controlled live canary for AI Showroom shared-vault synchronization.
Evidence: ${applicationSha}`;
}

function appendExactlyOneEvent(
  currentContent: string,
  event: string,
): string {
  if (
    currentContent.length === 0
  ) {
    return event;
  }

  return `${currentContent}\n\n${event}`;
}

function assertFullSha(
  value: string,
  failureCode: string,
): void {
  if (
    !FULL_SHA_PATTERN.test(
      value,
    )
  ) {
    hold(
      failureCode,
    );
  }
}

function recordPipelineDecision(
  evidence:
    GateGCanaryEvidence,
  decision:
    MutationPipelineDecision,
): void {
  switch (
    decision.code
  ) {
    case "MUTATION_COMMITTED":
      evidence.GATE_A =
        "AUTHORIZED";

      evidence.GATE_B =
        "APPEND_ONLY_VALID";

      evidence.GATE_D_BEFORE_PUSH =
        decision
          .isolation
          .code;

      evidence.GATE_C =
        decision
          .transaction
          .code;

      return;

    case "FLASH_READ_ONLY":
      evidence.GATE_A =
        "FLASH_READ_ONLY";

      return;

    case "GATE_A_REJECTED":
      evidence.GATE_A =
        `${decision.code}:${decision.policyCode}`;

      return;

    case "GATE_B_REJECTED":
      evidence.GATE_A =
        "AUTHORIZED";

      evidence.GATE_B =
        `${decision.code}:${decision.policyCode}`;

      return;

    case "GATE_D_REJECTED":
      evidence.GATE_A =
        "AUTHORIZED";

      evidence.GATE_B =
        "APPEND_ONLY_VALID";

      evidence.GATE_D_BEFORE_PUSH =
        `${decision.code}:${decision.isolationCode}`;

      return;

    case "GATE_C_REJECTED":
      evidence.GATE_A =
        "AUTHORIZED";

      evidence.GATE_B =
        "APPEND_ONLY_VALID";

      evidence.GATE_D_BEFORE_PUSH =
        "ISOLATION_VERIFIED";

      evidence.GATE_C =
        `${decision.code}:${decision.transactionCode}`;

      return;
  }
}

function recordPullDecision(
  evidence:
    GateGCanaryEvidence,
  decision:
    LocalPullDecision,
): void {
  if (decision.ok) {
    evidence.GATE_D_BEFORE_PULL =
      decision
        .isolation
        .code;

    evidence.GATE_F =
      decision.code;

    return;
  }

  if (
    decision.code ===
    "ISOLATION_REJECTED"
  ) {
    evidence.GATE_D_BEFORE_PULL =
      `${decision.code}:${decision.isolationCode}`;

    evidence.GATE_F =
      "NOT_EXECUTED";

    return;
  }

  evidence.GATE_D_BEFORE_PULL =
    "ISOLATION_VERIFIED";

  evidence.GATE_F =
    decision.code;
}

function splitNulPaths(
  value: string,
): string[] {
  return value
    .split("\0")
    .filter(
      Boolean,
    )
    .map(
      (path) =>
        path.replaceAll(
          "\\",
          "/",
        ),
    );
}

async function productionReadOnlyGit(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const permitted =
    new Set([
      "rev-parse",
      "status",
      "diff",
      "rev-list",
    ]);

  const command =
    args[0];

  if (
    !command ||
    !permitted.has(
      command,
    )
  ) {
    throw new Error(
      "Forbidden Git command in Gate G forensic reader",
    );
  }

  return new Promise(
    (
      resolvePromise,
      reject,
    ) => {
      execFile(
        "git",
        [...args],
        {
          cwd,
          encoding:
            "utf8",
          windowsHide:
            true,
        },
        (
          error,
          stdout,
        ) => {
          if (error) {
            reject(
              new Error(
                `Read-only Git inspection failed: ${command}`,
              ),
            );

            return;
          }

          resolvePromise(
            stdout,
          );
        },
      );
    },
  );
}

async function productionApplicationState():
  Promise<ApplicationState> {
  const repoRoot =
    (
      await productionReadOnlyGit(
        process.cwd(),
        [
          "rev-parse",
          "--show-toplevel",
        ],
      )
    ).trim();

  const head =
    (
      await productionReadOnlyGit(
        repoRoot,
        [
          "rev-parse",
          "HEAD",
        ],
      )
    ).trim();

  const status =
    await productionReadOnlyGit(
      repoRoot,
      [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      ],
    );

  return {
    repoRoot,
    head,
    clean:
      status.length === 0,
  };
}

async function productionTargetSnapshot(
  vaultRoot: string,
): Promise<TargetSnapshot> {
  const fullPath =
    resolve(
      vaultRoot,
      ...GATE_G_TARGET
        .split("/"),
    );

  let buffer:
    Buffer;

  try {
    buffer =
      await readFile(
        fullPath,
      );
  } catch (
    error: unknown
  ) {
    if (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      error.code ===
        "ENOENT"
    ) {
      return {
        exists:
          false,
        content:
          "",
        sha256:
          null,
        stateEventCount:
          0,
      };
    }

    throw error;
  }

  const content =
    buffer.toString(
      "utf8",
    );

  if (
    !Buffer
      .from(
        content,
        "utf8",
      )
      .equals(
        buffer,
      )
  ) {
    hold(
      "TARGET_NOT_UTF8",
    );
  }

  return {
    exists:
      true,

    content,

    sha256:
      sha256(
        buffer,
      ),

    stateEventCount:
      countStateEvents(
        content,
      ),
  };
}

function productionEvidenceEmitter(
  evidence:
    GateGCanaryEvidence,
): void {
  console.log(
    JSON.stringify(
      evidence,
      null,
      2,
    ),
  );
}

export function createProductionGateGDependencies():
  GateGRunnerDependencies {
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

    verifyIsolationFn:
      verifyIsolation,

    executeMutationPipelineFn:
      executeMutationPipeline,

    executeLocalObsidianPullFn:
      executeLocalObsidianPull,

    getApplicationState:
      productionApplicationState,

    readTarget:
      productionTargetSnapshot,

    readOnlyGit:
      productionReadOnlyGit,

    now:
      () =>
        new Date(),

    emitEvidence:
      productionEvidenceEmitter,
  };
}

export async function runGateGCanary(
  dependencies:
    GateGRunnerDependencies | undefined =
      undefined,
): Promise<
  GateGCanaryEvidence |
  TaskClosedResult
> {
  if (
    isTaskClosed(
      GATE_G_TASK,
    )
  ) {
    return createTaskClosedResult(
      GATE_G_TASK,
    );
  }

  dependencies ??=
    createProductionGateGDependencies();

  const evidence =
    createInitialEvidence();

  try {
    const environment =
      assertEnvironmentContract(
        dependencies
          .environment,
      );

    const applicationBefore =
      await dependencies
        .getApplicationState();

    evidence.APPLICATION_SHA =
      applicationBefore.head;

    evidence.APPLICATION_TREE =
      applicationBefore.clean
        ? "CLEAN"
        : "DIRTY";

    if (
      applicationBefore.head !==
      environment
        .applicationSha
    ) {
      hold(
        "APPLICATION_SHA_DRIFT",
      );
    }

    if (
      !applicationBefore.clean
    ) {
      hold(
        "APPLICATION_TREE_DIRTY",
      );
    }

    const isolationRequest = {
      project:
        "ai-showroom",

      repoPath:
        environment
          .vaultRoot,

      approvedVaultRoot:
        GATE_G_VAULT_ROOT,

      approvedRemote:
        GATE_G_REMOTE,

      targets: [
        GATE_G_TARGET,
      ],

      requiredEnvironmentKeys: [
        "AI_SHOWROOM_VAULT_PATH",
        "AI_SHOWROOM_VAULT_REMOTE",
      ],
    } as const;

    const isolation =
      await dependencies
        .verifyIsolationFn(
          isolationRequest,
          dependencies
            .isolationAdapter,
        );

    evidence.GATE_D_PREFLIGHT =
      isolation.ok
        ? isolation.code
        : `${isolation.code}`;

    if (
      !isolation.ok
    ) {
      hold(
        `GATE_D_PREFLIGHT:${isolation.code}`,
      );
    }

    const branch =
      await dependencies
        .pullAdapter
        .getCurrentBranch(
          environment
            .vaultRoot,
        );

    if (
      branch !==
      GATE_G_BRANCH
    ) {
      hold(
        "LOCAL_BRANCH_MISMATCH",
      );
    }

    const operationState =
      await dependencies
        .pullAdapter
        .getOperationState(
          environment
            .vaultRoot,
        );

    if (
      operationState !==
      "none"
    ) {
      hold(
        "LOCAL_OPERATION_IN_PROGRESS",
      );
    }

    const cleanBefore =
      await dependencies
        .pullAdapter
        .isClean(
          environment
            .vaultRoot,
        );

    if (!cleanBefore) {
      hold(
        "LOCAL_WORKTREE_DIRTY",
      );
    }

    const localBaseSha =
      await dependencies
        .pullAdapter
        .getHead(
          environment
            .vaultRoot,
        );

    assertFullSha(
      localBaseSha,
      "LOCAL_HEAD_INVALID",
    );

    evidence.LOCAL_BASE_SHA =
      localBaseSha;

    const localBranchSha =
      await dependencies
        .transactionAdapter
        .getLocalHead(
          environment
            .vaultRoot,
          GATE_G_BRANCH,
        );

    if (
      localBranchSha !==
      localBaseSha
    ) {
      hold(
        "LOCAL_BRANCH_HEAD_MISMATCH",
      );
    }

    const before =
      await dependencies
        .readTarget(
          environment
            .vaultRoot,
        );

    evidence.TARGET_EXISTED =
      before.exists
        ? "YES"
        : "NO";

    evidence.TARGET_BEFORE_SHA256 =
      before.sha256 ??
      "MISSING";

    const remoteBaseSha =
      await dependencies
        .transactionAdapter
        .getRemoteHead(
          environment
            .vaultRoot,
          GATE_G_BRANCH,
        );

    assertFullSha(
      remoteBaseSha,
      "REMOTE_HEAD_INVALID",
    );

    evidence.REMOTE_BASE_SHA =
      remoteBaseSha;

    if (
      remoteBaseSha !==
      localBaseSha
    ) {
      hold(
        "INITIAL_CONVERGENCE_FAILURE",
      );
    }

    const timestamp =
      dependencies
        .now()
        .toISOString();

    const event =
      buildGateGCanaryEvent(
        timestamp,
        environment
          .applicationSha,
      );

    const proposedContent =
      appendExactlyOneEvent(
        before.content,
        event,
      );

    const mutationRequest:
      MutationPipelineRequest = {
      transaction: {
        project:
          "ai-showroom",

        task:
          GATE_G_TASK,

        repoPath:
          environment
            .vaultRoot,

        targetBranch:
          GATE_G_BRANCH,

        expectedBaseSha:
          localBaseSha,

        commitMessage:
          GATE_G_COMMIT_MESSAGE,

        changes: [
          {
            request: {
              project:
                "ai-showroom",

              task:
                GATE_G_TASK,

              actor:
                "spark",

              operation:
                "append",

              mutationKind:
                "append-state",

              target:
                GATE_G_TARGET,
            },

            artifact: {
              exists:
                before.exists,

              type:
                "task",

              status:
                "active",

              frozen:
                false,

              owner:
                "spark",

              activeWriter:
                "spark",

              writeLockTask:
                GATE_G_TASK,
            },

            taskScope: {
              project:
                "ai-showroom",

              task:
                GATE_G_TASK,

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
          GATE_G_VAULT_ROOT,

        approvedRemote:
          GATE_G_REMOTE,

        requiredEnvironmentKeys: [
          "AI_SHOWROOM_VAULT_PATH",
          "AI_SHOWROOM_VAULT_REMOTE",
        ],
      },
    };

    const mutationResult =
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

    recordPipelineDecision(
      evidence,
      mutationResult,
    );

    if (
      !mutationResult.ok
    ) {
      hold(
        `MUTATION_PIPELINE:${mutationResult.code}`,
      );
    }

    const canaryResultSha =
      mutationResult
        .transaction
        .resultSha;

    assertFullSha(
      canaryResultSha,
      "CANARY_RESULT_SHA_INVALID",
    );

    evidence.CANARY_RESULT_SHA =
      canaryResultSha;

    const remotePostPush =
      await dependencies
        .transactionAdapter
        .getRemoteHead(
          environment
            .vaultRoot,
          GATE_G_BRANCH,
        );

    evidence.REMOTE_POST_PUSH =
      remotePostPush;

    if (
      remotePostPush !==
      canaryResultSha
    ) {
      hold(
        "REMOTE_POST_PUSH_MISMATCH",
      );
    }

    const primaryLocalPostPush =
      await dependencies
        .pullAdapter
        .getHead(
          environment
            .vaultRoot,
        );

    evidence.PRIMARY_LOCAL_POST_PUSH =
      primaryLocalPostPush;

    if (
      primaryLocalPostPush !==
      localBaseSha
    ) {
      hold(
        "PRIMARY_VAULT_MUTATED_BY_GATE_C",
      );
    }

    const pullRequest:
      LocalPullRequest = {
      project:
        "ai-showroom",

      repoPath:
        environment
          .vaultRoot,

      targetBranch:
        GATE_G_BRANCH,

      isolation: {
        approvedVaultRoot:
          GATE_G_VAULT_ROOT,

        approvedRemote:
          GATE_G_REMOTE,

        requiredEnvironmentKeys: [
          "AI_SHOWROOM_VAULT_PATH",
          "AI_SHOWROOM_VAULT_REMOTE",
        ],
      },
    };

    const pullResult =
      await dependencies
        .executeLocalObsidianPullFn(
          pullRequest,
          {
            isolationAdapter:
              dependencies
                .isolationAdapter,

            pullAdapter:
              dependencies
                .pullAdapter,
          },
        );

    recordPullDecision(
      evidence,
      pullResult,
    );

    if (
      !pullResult.ok ||
      pullResult.code !==
        "FAST_FORWARDED"
    ) {
      hold(
        `GATE_F:${pullResult.code}`,
      );
    }

    if (
      pullResult.fromSha !==
        localBaseSha ||
      pullResult.toSha !==
        canaryResultSha
    ) {
      hold(
        "GATE_F_SHA_RANGE_MISMATCH",
      );
    }

    const localFinalSha =
      await dependencies
        .pullAdapter
        .getHead(
          environment
            .vaultRoot,
        );

    const remoteFinalSha =
      await dependencies
        .transactionAdapter
        .getRemoteHead(
          environment
            .vaultRoot,
          GATE_G_BRANCH,
        );

    evidence.LOCAL_FINAL_SHA =
      localFinalSha;

    evidence.REMOTE_FINAL_SHA =
      remoteFinalSha;

    if (
      localFinalSha !==
        canaryResultSha ||
      remoteFinalSha !==
        canaryResultSha
    ) {
      hold(
        "FINAL_CONVERGENCE_FAILURE",
      );
    }

    const finalClean =
      await dependencies
        .pullAdapter
        .isClean(
          environment
            .vaultRoot,
        );

    evidence.FINAL_TREE =
      finalClean
        ? "CLEAN"
        : "DIRTY";

    if (!finalClean) {
      hold(
        "FINAL_WORKTREE_DIRTY",
      );
    }

    const after =
      await dependencies
        .readTarget(
          environment
            .vaultRoot,
        );

    const expectedAfter =
      proposedContent;

    const historyPreserved =
      before.exists
        ? (
            after.content ===
              expectedAfter &&
            after.content.startsWith(
              before.content,
            )
          )
        : (
            after.content ===
            event
          );

    evidence.PRIOR_HISTORY_PRESERVED =
      historyPreserved
        ? "PASS"
        : "FAIL";

    if (
      !historyPreserved
    ) {
      hold(
        "PRIOR_HISTORY_NOT_PRESERVED",
      );
    }

    const eventsAdded =
      after.stateEventCount -
      before.stateEventCount;

    evidence.STATE_EVENTS_ADDED =
      eventsAdded;

    if (
      eventsAdded !== 1
    ) {
      hold(
        "UNEXPECTED_STATE_EVENT_COUNT",
      );
    }

    const commitCountRaw =
      (
        await dependencies
          .readOnlyGit(
            environment
              .vaultRoot,
            [
              "rev-list",
              "--count",
              `${localBaseSha}..${canaryResultSha}`,
            ],
          )
      ).trim();

    const commitCount =
      Number.parseInt(
        commitCountRaw,
        10,
      );

    evidence.COMMIT_COUNT =
      commitCount;

    if (
      commitCount !== 1
    ) {
      hold(
        "UNEXPECTED_COMMIT_COUNT",
      );
    }

    const changedFilesRaw =
      await dependencies
        .readOnlyGit(
          environment
            .vaultRoot,
          [
            "diff",
            "--name-only",
            "-z",
            localBaseSha,
            canaryResultSha,
            "--",
          ],
        );

    const changedFiles =
      splitNulPaths(
        changedFilesRaw,
      );

    evidence.CHANGED_FILE_COUNT =
      changedFiles.length;

    evidence.CHANGED_FILE =
      changedFiles.length ===
        1
        ? changedFiles[0] ??
          null
        : null;

    if (
      changedFiles.length !== 1 ||
      changedFiles[0] !==
        GATE_G_TARGET
    ) {
      hold(
        "UNEXPECTED_CHANGED_PATHS",
      );
    }

    const parentLine =
      (
        await dependencies
          .readOnlyGit(
            environment
              .vaultRoot,
            [
              "rev-list",
              "--parents",
              "-n",
              "1",
              canaryResultSha,
            ],
          )
      )
        .trim()
        .split(/\s+/);

    const parents =
      parentLine.slice(
        1,
      );

    evidence.COMMIT_PARENT =
      parents[0] ??
      null;

    if (
      parents.length !== 1 ||
      parents[0] !==
        localBaseSha
    ) {
      hold(
        "CANARY_COMMIT_PARENT_INVALID",
      );
    }

    const applicationAfter =
      await dependencies
        .getApplicationState();

    evidence.APPLICATION_SHA =
      applicationAfter.head;

    evidence.APPLICATION_TREE =
      applicationAfter.clean
        ? "CLEAN"
        : "DIRTY";

    if (
      applicationAfter.head !==
        environment
          .applicationSha
    ) {
      hold(
        "APPLICATION_SHA_CHANGED_DURING_CANARY",
      );
    }

    if (
      !applicationAfter.clean
    ) {
      hold(
        "APPLICATION_TREE_DIRTY_AFTER_CANARY",
      );
    }

    evidence.FINAL_VERDICT =
      "PASS";

    return evidence;
  } catch (
    error: unknown
  ) {
    evidence.FINAL_VERDICT =
      "HOLD";

    evidence.FAILURE_CODE =
      error instanceof
        CanaryHold
        ? error.code
        : "UNEXPECTED_CANARY_ERROR";

    return evidence;
  } finally {
    dependencies
      .emitEvidence(
        evidence,
      );
  }
}

export async function main():
  Promise<void> {
  const evidence =
    await runGateGCanary();

  if (
    "status" in evidence
  ) {
    console.log(
      JSON.stringify(
        evidence,
        null,
        2,
      ),
    );

    process.exitCode = 1;

    return;
  }

  if (
    evidence.FINAL_VERDICT !==
    "PASS"
  ) {
    process.exitCode = 1;
  }
}

const entry =
  process.argv[1];

if (
  entry &&
  pathToFileURL(
    resolve(entry),
  ).href ===
    import.meta.url
) {
  void main();
}
