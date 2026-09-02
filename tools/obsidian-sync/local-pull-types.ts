import type {
  IsolationDecision,
  IsolationRequest,
} from "./isolation-types";

export type LocalGitOperationState =
  | "none"
  | "merge"
  | "rebase"
  | "cherry-pick"
  | "revert";

export type LocalPullIsolationConfig =
  Omit<
    IsolationRequest,
    "project" | "repoPath" | "targets"
  >;

export type LocalPullRequest = {
  project: string;
  repoPath: string;
  targetBranch: string;
  isolation: LocalPullIsolationConfig;
};

export type LocalPullDenyCode =
  | "ISOLATION_REJECTED"
  | "LOCAL_WORKTREE_DIRTY"
  | "LOCAL_BRANCH_MISMATCH"
  | "LOCAL_OPERATION_IN_PROGRESS"
  | "LOCAL_HEAD_INVALID"
  | "FETCH_FAILED"
  | "FETCHED_HEAD_INVALID"
  | "LOCAL_AHEAD_OF_REMOTE"
  | "HISTORY_DIVERGED"
  | "LOCAL_HEAD_CHANGED"
  | "LOCAL_WORKTREE_DIRTY_AFTER_FETCH"
  | "FAST_FORWARD_FAILED"
  | "POST_PULL_HEAD_MISMATCH"
  | "POST_PULL_WORKTREE_DIRTY"
  | "PULL_INSPECTION_FAILED";

export type LocalPullDecision =
  | {
      ok: true;
      code: "UP_TO_DATE";
      localSha: string;
      remoteSha: string;
      isolation:
        Extract<
          IsolationDecision,
          { ok: true }
        >;
    }
  | {
      ok: true;
      code: "FAST_FORWARDED";
      fromSha: string;
      toSha: string;
      isolation:
        Extract<
          IsolationDecision,
          { ok: true }
        >;
    }
  | {
      ok: false;
      code: "ISOLATION_REJECTED";
      isolationCode:
        Extract<
          IsolationDecision,
          { ok: false }
        >["code"];
    }
  | {
      ok: false;
      code: Exclude<
        LocalPullDenyCode,
        "ISOLATION_REJECTED"
      >;
    };