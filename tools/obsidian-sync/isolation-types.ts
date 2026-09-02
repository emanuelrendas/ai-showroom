export const AI_SHOWROOM_CREDENTIAL_PREFIX =
  "AI_SHOWROOM_" as const;

export type PathComparisonMode =
  | "case-sensitive"
  | "case-insensitive";

export type GitRemoteIdentity = {
  host: string;
  owner: string;
  repo: string;
};

export type IsolationRequest = {
  project: string;

  repoPath: string;
  approvedVaultRoot: string;

  approvedRemote: string;

  targets: readonly string[];

  requiredEnvironmentKeys?:
    readonly string[];
};

export type TargetPhysicalAnchor = {
  target: string;
  resolvedAnchor: string;
};

export type IsolationSnapshot = {
  pathComparisonMode:
    PathComparisonMode;

  repoRoot: string;
  vaultRoot: string;

  targetAnchors:
    readonly TargetPhysicalAnchor[];

  actualOriginUrl:
    string | null;

  environmentKeys:
    readonly string[];
};

export type IsolationDenyCode =
  | "PROJECT_MISMATCH"

  | "VAULT_REALPATH_FAILED"
  | "REPO_REALPATH_FAILED"
  | "VAULT_ROOT_MISMATCH"
  | "TARGET_PATH_ESCAPE"

  | "REMOTE_NOT_CONFIGURED"
  | "REMOTE_FORMAT_UNSUPPORTED"
  | "REMOTE_IDENTITY_MISMATCH"

  | "REQUIRED_SHOWROOM_CREDENTIAL_MISSING"

  | "ISOLATION_INSPECTION_FAILED";

export type IsolationDecision =
  | {
      ok: true;
      code: "ISOLATION_VERIFIED";

      vaultRoot: string;
      repoRoot: string;

      remote:
        GitRemoteIdentity;
    }
  | {
      ok: false;
      code: IsolationDenyCode;

      path?: string;

      environmentKey?: string;
    };

export type IsolationGuardDecision<T> =
  | {
      ok: true;
      code:
        "ISOLATION_VERIFIED_AND_EXECUTED";

      isolation:
        Extract<
          IsolationDecision,
          { ok: true }
        >;

      result: T;
    }
  | {
      ok: false;
      code:
        "ISOLATION_REJECTED";

      isolation:
        Extract<
          IsolationDecision,
          { ok: false }
        >;
    };