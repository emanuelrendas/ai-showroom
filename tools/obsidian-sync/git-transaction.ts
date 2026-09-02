import {
  AI_SHOWROOM_PROJECT,
  type GitPolicyCode,
  type GitTransactionDecision,
  type GitTransactionRequest,
} from "./types";

import type {
  GitAdapter,
  TransactionWorktree,
} from "./git-adapter";

import {
  validateVaultMutation,
} from "./contract-validator";

import {
  validateAppendOnlyMutation,
} from "./append-only-validator";

const FULL_SHA_PATTERN =
  /^[0-9a-f]{40}$/;

const V1_TARGET_BRANCH =
  "main";

type ValidatedChange = {
  target: string;
  content: string;
};

function failure(
  code:
    | Exclude<
        GitTransactionDecision,
        { ok: true }
      >["code"],
  options: {
    policyCode?: GitPolicyCode;
    path?: string;
  } = {},
): GitTransactionDecision {
  return {
    ok: false,
    code,
    ...options,
  };
}

function validateEnvelope(
  request: GitTransactionRequest,
): GitTransactionDecision | null {
  if (
    request.project !==
    AI_SHOWROOM_PROJECT
  ) {
    return failure(
      "PROJECT_MISMATCH",
    );
  }

  if (
    !FULL_SHA_PATTERN.test(
      request.expectedBaseSha,
    )
  ) {
    return failure(
      "INVALID_BASE_SHA",
    );
  }

  if (
    request.targetBranch !==
    V1_TARGET_BRANCH
  ) {
    return failure(
      "INVALID_TARGET_BRANCH",
    );
  }

  if (
    request.changes.length === 0
  ) {
    return failure(
      "EMPTY_CHANGESET",
    );
  }

  return null;
}

function validatePolicies(
  transaction:
    GitTransactionRequest,
):
  | {
      ok: true;
      changes:
        readonly ValidatedChange[];
    }
  | {
      ok: false;
      decision:
        GitTransactionDecision;
    } {
  const validated:
    ValidatedChange[] = [];

  for (
    const change of
    transaction.changes
  ) {
    if (
      change.request.task !==
        transaction.task ||
      change.taskScope.task !==
        transaction.task
    ) {
      return {
        ok: false,
        decision: failure(
          "GATE_A_REJECTED",
          {
            policyCode:
              "TASK_SCOPE_MISMATCH",
          },
        ),
      };
    }

    const gateA =
      validateVaultMutation({
        request:
          change.request,
        artifact:
          change.artifact,
        taskScope:
          change.taskScope,
      });

    if (!gateA.ok) {
      return {
        ok: false,
        decision: failure(
          "GATE_A_REJECTED",
          {
            policyCode:
              gateA.code,
          },
        ),
      };
    }

    if (
      change.request
        .mutationKind ===
      "append-state"
    ) {
      const gateB =
        validateAppendOnlyMutation(
          {
            request:
              change.request,
            currentContent:
              change.currentContent,
            proposedContent:
              change.proposedContent,
          },
        );

      if (!gateB.ok) {
        return {
          ok: false,
          decision: failure(
            "GATE_B_REJECTED",
            {
              policyCode:
                gateB.code,
            },
          ),
        };
      }
    }

    validated.push({
      target: gateA.target,
      content:
        change.proposedContent,
    });
  }

  return {
    ok: true,
    changes: validated,
  };
}

function findUnexpectedPath(
  actualPaths: readonly string[],
  expectedPaths:
    ReadonlySet<string>,
): string | null {
  for (
    const path of actualPaths
  ) {
    if (
      !expectedPaths.has(path)
    ) {
      return path;
    }
  }

  return null;
}

function findMissingPath(
  expectedPaths:
    readonly string[],
  actualPaths:
    ReadonlySet<string>,
): string | null {
  for (
    const path of expectedPaths
  ) {
    if (
      !actualPaths.has(path)
    ) {
      return path;
    }
  }

  return null;
}

async function runTransactionBody(
  request:
    GitTransactionRequest,
  changes:
    readonly ValidatedChange[],
  transaction:
    TransactionWorktree,
  adapter:
    GitAdapter,
): Promise<GitTransactionDecision> {
  for (
    const change of changes
  ) {
    await adapter.writeFile(
      transaction.path,
      change.target,
      change.content,
    );
  }

  const expectedPaths =
    changes.map(
      (change) =>
        change.target,
    );

  const expectedSet =
    new Set(expectedPaths);

  const actualPaths =
    await adapter.getChangedPaths(
      transaction.path,
    );

  const actualSet =
    new Set(actualPaths);

  const unexpectedPath =
    findUnexpectedPath(
      actualPaths,
      expectedSet,
    );

  if (unexpectedPath) {
    return failure(
      "UNEXPECTED_CHANGED_PATH",
      {
        path:
          unexpectedPath,
      },
    );
  }

  const missingPath =
    findMissingPath(
      expectedPaths,
      actualSet,
    );

  if (missingPath) {
    return failure(
      "EXPECTED_CHANGED_PATH_MISSING",
      {
        path: missingPath,
      },
    );
  }

  await adapter.stagePaths(
    transaction.path,
    expectedPaths,
  );

  const resultSha =
    await adapter.commit(
      transaction.path,
      request.commitMessage,
    );

  if (
    !FULL_SHA_PATTERN.test(
      resultSha,
    )
  ) {
    return failure(
      "GIT_COMMAND_FAILED",
    );
  }

  const parentSha =
    await adapter.getCommitParent(
      transaction.path,
      resultSha,
    );

  if (
    parentSha !==
    request.expectedBaseSha
  ) {
    return failure(
      "COMMIT_PARENT_MISMATCH",
    );
  }

  try {
    await adapter.pushCommit(
      request.repoPath,
      resultSha,
      request.targetBranch,
    );
  } catch {
    return failure(
      "PUSH_REJECTED",
    );
  }

  const remoteResultSha =
    await adapter.getRemoteHead(
      request.repoPath,
      request.targetBranch,
    );

  if (
    remoteResultSha !== resultSha
  ) {
    return failure(
      "REMOTE_VERIFY_MISMATCH",
    );
  }

  return {
    ok: true,
    code:
      "COMMITTED_AND_PUSHED",
    baseSha:
      request.expectedBaseSha,
    resultSha,
    targetBranch:
      request.targetBranch,
    changedPaths:
      expectedPaths,
  };
}

export async function executeGitTransaction(
  request:
    GitTransactionRequest,
  adapter:
    GitAdapter,
): Promise<GitTransactionDecision> {
  const envelopeFailure =
    validateEnvelope(request);

  if (envelopeFailure) {
    return envelopeFailure;
  }

  const policy =
    validatePolicies(request);

  if (!policy.ok) {
    return policy.decision;
  }

  try {
    const clean =
      await adapter.isClean(
        request.repoPath,
      );

    if (!clean) {
      return failure(
        "PRIMARY_WORKTREE_DIRTY",
      );
    }

    const localHead =
      await adapter.getLocalHead(
        request.repoPath,
        request.targetBranch,
      );

    if (
      localHead !==
      request.expectedBaseSha
    ) {
      return failure(
        "LOCAL_HEAD_MISMATCH",
      );
    }

    const remoteHead =
      await adapter.getRemoteHead(
        request.repoPath,
        request.targetBranch,
      );

    if (
      remoteHead !==
      request.expectedBaseSha
    ) {
      return failure(
        "REMOTE_HEAD_MISMATCH",
      );
    }
  } catch {
    return failure(
      "GIT_COMMAND_FAILED",
    );
  }

  let transaction:
    TransactionWorktree;

  try {
    transaction =
      await adapter
        .createTransactionWorktree(
          request.repoPath,
          request.expectedBaseSha,
        );
  } catch {
    return failure(
      "GIT_COMMAND_FAILED",
    );
  }

  let result:
    GitTransactionDecision;

  try {
    result =
      await runTransactionBody(
        request,
        policy.changes,
        transaction,
        adapter,
      );
  } catch {
    result = failure(
      "GIT_COMMAND_FAILED",
    );
  }

  try {
    await adapter
      .removeTransactionWorktree(
        request.repoPath,
        transaction,
      );
  } catch {
    return failure(
      "TRANSACTION_CLEANUP_FAILED",
    );
  }

  return result;
}