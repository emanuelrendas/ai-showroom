export const AI_SHOWROOM_PROJECT = "ai-showroom" as const;

export type SyncProject = typeof AI_SHOWROOM_PROJECT;

export type SyncActor =
  | "sol"
  | "spark"
  | "flash"
  | "tiago";

export type SyncOperation =
  | "create"
  | "update"
  | "append"
  | "move"
  | "delete";

export type MutationKind =
  | "substantive"
  | "state-metadata"
  | "append-state";

export type GovernedDocumentType =
  | "command-state"
  | "milestone"
  | "task"
  | "architecture"
  | "decision"
  | "handoff"
  | "review"
  | "audit"
  | "evidence"
  | "knowledge"
  | "protocol";

export type GovernedOwner =
  | "tiago"
  | "sol"
  | "spark"
  | "human";

export type ActiveWriter =
  | "sol"
  | "spark"
  | null;

export type VaultMutationRequest = {
  project: string;
  task: string;
  actor: SyncActor;
  operation: SyncOperation;
  mutationKind: MutationKind;
  target: string;
};

export type ArtifactPolicyState = {
  exists: boolean;
  type: GovernedDocumentType;
  status: string;
  frozen: boolean;
  owner: GovernedOwner;
  activeWriter: ActiveWriter;
  writeLockTask: string | null;
};

export type AuthorizedTaskScope = {
  project: SyncProject;
  task: string;
  allowedTargetPrefixes: readonly string[];
};

export type ContractDenyCode =
  | "INVALID_TARGET"
  | "PROJECT_MISMATCH"
  | "TASK_SCOPE_MISMATCH"
  | "TARGET_OUTSIDE_TASK_SCOPE"
  | "FLASH_READ_ONLY"
  | "ROLE_PATH_FORBIDDEN"
  | "FROZEN_ARTIFACT"
  | "WRITE_LOCKED_BY_OTHER_ACTOR"
  | "WRITE_LOCKED_BY_OTHER_TASK"
  | "REVIEW_WRITE_FORBIDDEN";

export type ContractDecision =
  | {
      ok: true;
      code: "AUTHORIZED";
      target: string;
    }
  | {
      ok: false;
      code: ContractDenyCode;
      target?: string;
    };

/*
 * Gate B — Append-Only Validator
 */

export type AppendOnlyDenyCode =
  | "NOT_APPEND_STATE_OPERATION"
  | "CURRENT_HISTORY_MODIFIED"
  | "CURRENT_HISTORY_DELETED"
  | "NO_CONTENT_APPENDED"
  | "INVALID_APPEND_BOUNDARY"
  | "MALFORMED_STATE_EVENT"
  | "MULTIPLE_STATE_EVENTS"
  | "ACTOR_MISMATCH"
  | "TASK_MISMATCH";

export type AppendOnlyDecision =
  | {
      ok: true;
      code: "APPEND_ONLY_VALID";
      appendedContent: string;
    }
  | {
      ok: false;
      code: AppendOnlyDenyCode;
    };

export type AppendOnlyValidationInput = {
  request: VaultMutationRequest;
  currentContent: string;
  proposedContent: string;
};

/*
 * Gate C — Git Transaction Layer / SHA-CAS
 */

export type PreparedVaultChange = {
  request: VaultMutationRequest;
  artifact: ArtifactPolicyState;
  taskScope: AuthorizedTaskScope;
  currentContent: string;
  proposedContent: string;
};

export type GitTransactionRequest = {
  project: string;
  task: string;

  repoPath: string;
  targetBranch: string;

  expectedBaseSha: string;

  changes: readonly PreparedVaultChange[];

  commitMessage: string;
};

export type GitTransactionDenyCode =
  | "PROJECT_MISMATCH"
  | "INVALID_BASE_SHA"
  | "INVALID_TARGET_BRANCH"
  | "EMPTY_CHANGESET"
  | "GATE_A_REJECTED"
  | "GATE_B_REJECTED"
  | "PRIMARY_WORKTREE_DIRTY"
  | "LOCAL_HEAD_MISMATCH"
  | "REMOTE_HEAD_MISMATCH"
  | "UNEXPECTED_CHANGED_PATH"
  | "EXPECTED_CHANGED_PATH_MISSING"
  | "COMMIT_PARENT_MISMATCH"
  | "PUSH_REJECTED"
  | "REMOTE_VERIFY_MISMATCH"
  | "GIT_COMMAND_FAILED"
  | "TRANSACTION_CLEANUP_FAILED";

export type GitPolicyCode =
  | ContractDenyCode
  | AppendOnlyDenyCode;

export type GitTransactionDecision =
  | {
      ok: true;
      code: "COMMITTED_AND_PUSHED";
      baseSha: string;
      resultSha: string;
      targetBranch: string;
      changedPaths: readonly string[];
    }
  | {
      ok: false;
      code: GitTransactionDenyCode;
      policyCode?: GitPolicyCode;
      path?: string;
    };