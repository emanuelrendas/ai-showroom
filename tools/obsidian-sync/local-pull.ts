import type {
  IsolationAdapter,
} from "./isolation-adapter";

import {
  verifyIsolation,
} from "./isolation-gate";

import type {
  IsolationRequest,
} from "./isolation-types";

import type {
  LocalPullAdapter,
} from "./local-pull-adapter";

import type {
  LocalPullDecision,
  LocalPullRequest,
} from "./local-pull-types";

const FULL_SHA_PATTERN =
  /^[0-9a-f]{40}$/;

const V1_BRANCH =
  "main";

type GateDVerifier =
  typeof verifyIsolation;

export type LocalPullDependencies = {
  isolationAdapter:
    IsolationAdapter;

  pullAdapter:
    LocalPullAdapter;

  verifyGateD?:
    GateDVerifier;
};

function deny(
  code:
    Exclude<
      LocalPullDecision,
      { ok: true }
    >["code"],
): LocalPullDecision {
  if (
    code ===
    "ISOLATION_REJECTED"
  ) {
    throw new Error(
      "ISOLATION_REJECTED requires an isolation code",
    );
  }

  return {
    ok: false,
    code,
  };
}

export async function executeLocalObsidianPull(
  request: LocalPullRequest,
  dependencies:
    LocalPullDependencies,
): Promise<LocalPullDecision> {
  const runGateD =
    dependencies.verifyGateD ??
    verifyIsolation;

  const isolationRequest:
    IsolationRequest = {
    ...request.isolation,

    project:
      request.project,

    repoPath:
      request.repoPath,

    targets: [],
  };

  let isolation:
    Awaited<
      ReturnType<GateDVerifier>
    >;

  try {
    isolation =
      await runGateD(
        isolationRequest,
        dependencies
          .isolationAdapter,
      );
  } catch {
    return deny(
      "PULL_INSPECTION_FAILED",
    );
  }

  if (!isolation.ok) {
    return {
      ok: false,
      code:
        "ISOLATION_REJECTED",
      isolationCode:
        isolation.code,
    };
  }

  if (
    request.targetBranch !==
    V1_BRANCH
  ) {
    return deny(
      "LOCAL_BRANCH_MISMATCH",
    );
  }

  const adapter =
    dependencies.pullAdapter;

  let localBaseSha: string;

  try {
    const currentBranch =
      await adapter
        .getCurrentBranch(
          request.repoPath,
        );

    if (
      currentBranch !==
      request.targetBranch
    ) {
      return deny(
        "LOCAL_BRANCH_MISMATCH",
      );
    }

    const operationState =
      await adapter
        .getOperationState(
          request.repoPath,
        );

    if (
      operationState !==
      "none"
    ) {
      return deny(
        "LOCAL_OPERATION_IN_PROGRESS",
      );
    }

    const clean =
      await adapter.isClean(
        request.repoPath,
      );

    if (!clean) {
      return deny(
        "LOCAL_WORKTREE_DIRTY",
      );
    }

    localBaseSha =
      await adapter.getHead(
        request.repoPath,
      );
  } catch {
    return deny(
      "PULL_INSPECTION_FAILED",
    );
  }

  if (
    !FULL_SHA_PATTERN.test(
      localBaseSha,
    )
  ) {
    return deny(
      "LOCAL_HEAD_INVALID",
    );
  }

  let fetchedRemoteSha: string;

  try {
    fetchedRemoteSha =
      await adapter.fetchBranch(
        request.repoPath,
        request.targetBranch,
      );
  } catch {
    return deny(
      "FETCH_FAILED",
    );
  }

  if (
    !FULL_SHA_PATTERN.test(
      fetchedRemoteSha,
    )
  ) {
    return deny(
      "FETCHED_HEAD_INVALID",
    );
  }

  try {
    const headAfterFetch =
      await adapter.getHead(
        request.repoPath,
      );

    if (
      headAfterFetch !==
      localBaseSha
    ) {
      return deny(
        "LOCAL_HEAD_CHANGED",
      );
    }

    const cleanAfterFetch =
      await adapter.isClean(
        request.repoPath,
      );

    if (!cleanAfterFetch) {
      return deny(
        "LOCAL_WORKTREE_DIRTY_AFTER_FETCH",
      );
    }
  } catch {
    return deny(
      "PULL_INSPECTION_FAILED",
    );
  }

  if (
    localBaseSha ===
    fetchedRemoteSha
  ) {
    return {
      ok: true,
      code:
        "UP_TO_DATE",
      localSha:
        localBaseSha,
      remoteSha:
        fetchedRemoteSha,
      isolation,
    };
  }

  let localIsAncestor:
    boolean;

  let remoteIsAncestor:
    boolean;

  try {
    localIsAncestor =
      await adapter.isAncestor(
        request.repoPath,
        localBaseSha,
        fetchedRemoteSha,
      );

    if (localIsAncestor) {
      remoteIsAncestor =
        false;
    } else {
      remoteIsAncestor =
        await adapter.isAncestor(
          request.repoPath,
          fetchedRemoteSha,
          localBaseSha,
        );
    }
  } catch {
    return deny(
      "PULL_INSPECTION_FAILED",
    );
  }

  if (!localIsAncestor) {
    if (remoteIsAncestor) {
      return deny(
        "LOCAL_AHEAD_OF_REMOTE",
      );
    }

    return deny(
      "HISTORY_DIVERGED",
    );
  }

  try {
    await adapter.fastForward(
      request.repoPath,
      fetchedRemoteSha,
    );
  } catch {
    return deny(
      "FAST_FORWARD_FAILED",
    );
  }

  try {
    const finalHead =
      await adapter.getHead(
        request.repoPath,
      );

    if (
      finalHead !==
      fetchedRemoteSha
    ) {
      return deny(
        "POST_PULL_HEAD_MISMATCH",
      );
    }

    const finalClean =
      await adapter.isClean(
        request.repoPath,
      );

    if (!finalClean) {
      return deny(
        "POST_PULL_WORKTREE_DIRTY",
      );
    }
  } catch {
    return deny(
      "PULL_INSPECTION_FAILED",
    );
  }

  return {
    ok: true,
    code:
      "FAST_FORWARDED",
    fromSha:
      localBaseSha,
    toSha:
      fetchedRemoteSha,
    isolation,
  };
}