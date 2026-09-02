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