import {
  AI_SHOWROOM_CREDENTIAL_PREFIX,
  type GitRemoteIdentity,
  type IsolationDecision,
  type IsolationRequest,
  type IsolationSnapshot,
  type PathComparisonMode,
} from "./isolation-types";

function stripTrailingSlash(
  value: string,
): string {
  if (
    value === "/" ||
    /^[A-Za-z]:\/$/.test(value)
  ) {
    return value;
  }

  return value.replace(/\/+$/, "");
}

export function canonicalizePhysicalPath(
  value: string,
  mode: PathComparisonMode,
): string {
  let normalized =
    value.replaceAll("\\", "/");

  normalized =
    stripTrailingSlash(
      normalized,
    );

  if (
    mode ===
    "case-insensitive"
  ) {
    normalized =
      normalized.toLowerCase();
  }

  return normalized;
}

export function isSameOrDescendant(
  parent: string,
  candidate: string,
  mode: PathComparisonMode,
): boolean {
  const canonicalParent =
    canonicalizePhysicalPath(
      parent,
      mode,
    );

  const canonicalCandidate =
    canonicalizePhysicalPath(
      candidate,
      mode,
    );

  if (
    canonicalParent ===
    canonicalCandidate
  ) {
    return true;
  }

  const prefix =
    canonicalParent.endsWith("/")
      ? canonicalParent
      : `${canonicalParent}/`;

  return canonicalCandidate
    .startsWith(prefix);
}

function normalizeRemotePart(
  value: string,
): string {
  return value
    .replace(/\.git$/i, "")
    .toLowerCase();
}

function identityFromParts(
  host: string,
  owner: string,
  repo: string,
): GitRemoteIdentity | null {
  const normalizedHost =
    host.toLowerCase();

  if (
    normalizedHost !==
    "github.com"
  ) {
    return null;
  }

  if (
    owner.length === 0 ||
    repo.length === 0 ||
    owner.includes("/") ||
    repo.includes("/")
  ) {
    return null;
  }

  return {
    host:
      normalizedHost,

    owner:
      normalizeRemotePart(
        owner,
      ),

    repo:
      normalizeRemotePart(
        repo,
      ),
  };
}

export function parseGitRemoteIdentity(
  remote: string,
): GitRemoteIdentity | null {
  const trimmed =
    remote.trim();

  const scpMatch =
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i
      .exec(trimmed);

  if (scpMatch) {
    const [, owner, repo] =
      scpMatch;

    if (
      !owner ||
      !repo
    ) {
      return null;
    }

    return identityFromParts(
      "github.com",
      owner,
      repo,
    );
  }

  let parsed: URL;

  try {
    parsed =
      new URL(trimmed);
  } catch {
    return null;
  }

  if (
    parsed.search ||
    parsed.hash ||
    parsed.port
  ) {
    return null;
  }

  if (
    parsed.password.length > 0
  ) {
    return null;
  }

  if (
    parsed.protocol ===
    "https:"
  ) {
    if (
      parsed.username.length > 0
    ) {
      return null;
    }
  } else if (
    parsed.protocol ===
    "ssh:"
  ) {
    if (
      parsed.username !==
      "git"
    ) {
      return null;
    }
  } else {
    return null;
  }

  const segments =
    parsed.pathname
      .split("/")
      .filter(Boolean);

  if (
    segments.length !== 2
  ) {
    return null;
  }

  const [owner, repo] =
    segments;

  if (
    !owner ||
    !repo
  ) {
    return null;
  }

  return identityFromParts(
    parsed.hostname,
    owner,
    repo,
  );
}

function remotesEqual(
  left: GitRemoteIdentity,
  right: GitRemoteIdentity,
): boolean {
  return (
    left.host === right.host &&
    left.owner === right.owner &&
    left.repo === right.repo
  );
}

function environmentHasKey(
  keys: readonly string[],
  required: string,
  mode: PathComparisonMode,
): boolean {
  if (
    mode ===
    "case-insensitive"
  ) {
    const normalized =
      required.toUpperCase();

    return keys.some(
      (key) =>
        key.toUpperCase() ===
        normalized,
    );
  }

  return keys.includes(
    required,
  );
}

export function isSafeVaultRelativeTarget(
  target: string,
): boolean {
  const normalized =
    target
      .trim()
      .replaceAll("\\", "/");

  if (!normalized) {
    return false;
  }

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(
      normalized,
    )
  ) {
    return false;
  }

  const segments =
    normalized.split("/");

  return !segments.some(
    (segment) =>
      segment === "" ||
      segment === "." ||
      segment === "..",
  );
}

export function evaluateIsolation(
  request: IsolationRequest,
  snapshot: IsolationSnapshot,
): IsolationDecision {
  if (
    request.project !==
    "ai-showroom"
  ) {
    return {
      ok: false,
      code:
        "PROJECT_MISMATCH",
    };
  }

  const mode =
    snapshot
      .pathComparisonMode;

  const repoCanonical =
    canonicalizePhysicalPath(
      snapshot.repoRoot,
      mode,
    );

  const vaultCanonical =
    canonicalizePhysicalPath(
      snapshot.vaultRoot,
      mode,
    );

  if (
    repoCanonical !==
    vaultCanonical
  ) {
    return {
      ok: false,
      code:
        "VAULT_ROOT_MISMATCH",
      path:
        snapshot.repoRoot,
    };
  }

  if (
    snapshot
      .targetAnchors
      .length !==
    request.targets.length
  ) {
    return {
      ok: false,
      code:
        "TARGET_PATH_ESCAPE",
    };
  }

  for (
    let index = 0;
    index <
    request.targets.length;
    index += 1
  ) {
    const expectedTarget =
      request.targets[index];

    const inspected =
      snapshot
        .targetAnchors[index];

    if (
      !expectedTarget ||
      !inspected ||
      inspected.target !==
        expectedTarget
    ) {
      return {
        ok: false,
        code:
          "TARGET_PATH_ESCAPE",
        path:
          expectedTarget,
      };
    }

    if (
      !isSameOrDescendant(
        snapshot.vaultRoot,
        inspected.resolvedAnchor,
        mode,
      )
    ) {
      return {
        ok: false,
        code:
          "TARGET_PATH_ESCAPE",
        path:
          expectedTarget,
      };
    }
  }

  if (
    snapshot
      .actualOriginUrl ===
    null
  ) {
    return {
      ok: false,
      code:
        "REMOTE_NOT_CONFIGURED",
    };
  }

  const approvedRemote =
    parseGitRemoteIdentity(
      request.approvedRemote,
    );

  const actualRemote =
    parseGitRemoteIdentity(
      snapshot
        .actualOriginUrl,
    );

  if (
    !approvedRemote ||
    !actualRemote
  ) {
    return {
      ok: false,
      code:
        "REMOTE_FORMAT_UNSUPPORTED",
    };
  }

  if (
    !remotesEqual(
      approvedRemote,
      actualRemote,
    )
  ) {
    return {
      ok: false,
      code:
        "REMOTE_IDENTITY_MISMATCH",
    };
  }

  const requiredKeys =
    request
      .requiredEnvironmentKeys ??
    [];

  for (
    const required of
    requiredKeys
  ) {
    if (
      !required.startsWith(
        AI_SHOWROOM_CREDENTIAL_PREFIX,
      ) ||
      !environmentHasKey(
        snapshot
          .environmentKeys,
        required,
        mode,
      )
    ) {
      return {
        ok: false,
        code:
          "REQUIRED_SHOWROOM_CREDENTIAL_MISSING",
        environmentKey:
          required,
      };
    }
  }

  return {
    ok: true,
    code:
      "ISOLATION_VERIFIED",

    vaultRoot:
      snapshot.vaultRoot,

    repoRoot:
      snapshot.repoRoot,

    remote:
      actualRemote,
  };
}