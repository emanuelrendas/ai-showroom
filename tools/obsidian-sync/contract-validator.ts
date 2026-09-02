import {
  AI_SHOWROOM_PROJECT,
  type ArtifactPolicyState,
  type AuthorizedTaskScope,
  type ContractDecision,
  type VaultMutationRequest,
} from "./types";

export const AI_SHOWROOM_SHARED_VAULT_NAMESPACE =
  "04 - AI WORKSPACE/AI-SHOWROOM/" as const;

const SOL_WRITE_PREFIXES = [
  `${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SOL/`,
] as const;

const SPARK_WRITE_PREFIXES = [
  `${AI_SHOWROOM_SHARED_VAULT_NAMESPACE}SPARK/`,
] as const;

const TIAGO_WRITE_PREFIXES = [
  AI_SHOWROOM_SHARED_VAULT_NAMESPACE,
] as const;

type ValidationInput = {
  request: VaultMutationRequest;
  artifact: ArtifactPolicyState;
  taskScope: AuthorizedTaskScope;
};

export function normalizeVaultTarget(
  target: string,
): string | null {
  const normalized =
    target
      .trim()
      .replaceAll("\\", "/");

  if (!normalized) {
    return null;
  }

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(
      normalized,
    )
  ) {
    return null;
  }

  const segments =
    normalized.split("/");

  if (
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === "..",
    )
  ) {
    return null;
  }

  return segments.join("/");
}

function normalizePrefix(
  prefix: string,
): string | null {
  const normalized =
    prefix
      .trim()
      .replaceAll("\\", "/");

  if (!normalized) {
    return null;
  }

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(
      normalized,
    )
  ) {
    return null;
  }

  const withoutTrailingSlash =
    normalized.endsWith("/")
      ? normalized.slice(0, -1)
      : normalized;

  const segments =
    withoutTrailingSlash.split(
      "/",
    );

  if (
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === "..",
    )
  ) {
    return null;
  }

  return `${segments.join("/")}/`;
}

function isWithinPrefix(
  target: string,
  prefix: string,
): boolean {
  return target.startsWith(
    prefix,
  );
}

function isInsideTaskScope(
  target: string,
  taskScope:
    AuthorizedTaskScope,
): boolean {
  return taskScope
    .allowedTargetPrefixes
    .some(
      (configuredPrefix) => {
        const prefix =
          normalizePrefix(
            configuredPrefix,
          );

        return (
          prefix !== null &&
          isWithinPrefix(
            target,
            prefix,
          )
        );
      },
    );
}

function isInsideShowroomNamespace(
  target: string,
): boolean {
  return isWithinPrefix(
    target,
    AI_SHOWROOM_SHARED_VAULT_NAMESPACE,
  );
}

function isRolePathAllowed(
  request:
    VaultMutationRequest,
  target: string,
): boolean {
  switch (
    request.actor
  ) {
    case "sol":
      return SOL_WRITE_PREFIXES
        .some(
          (prefix) =>
            isWithinPrefix(
              target,
              prefix,
            ),
        );

    case "spark":
      return SPARK_WRITE_PREFIXES
        .some(
          (prefix) =>
            isWithinPrefix(
              target,
              prefix,
            ),
        );

    case "tiago":
      return TIAGO_WRITE_PREFIXES
        .some(
          (prefix) =>
            isWithinPrefix(
              target,
              prefix,
            ),
        );

    case "flash":
      return false;
  }
}

export function validateVaultMutation({
  request,
  artifact,
  taskScope,
}: ValidationInput): ContractDecision {
  const target =
    normalizeVaultTarget(
      request.target,
    );

  if (!target) {
    return {
      ok: false,
      code:
        "INVALID_TARGET",
    };
  }

  if (
    request.project !==
    AI_SHOWROOM_PROJECT
  ) {
    return {
      ok: false,
      code:
        "PROJECT_MISMATCH",
      target,
    };
  }

  if (
    request.task !==
      taskScope.task ||
    taskScope.project !==
      AI_SHOWROOM_PROJECT
  ) {
    return {
      ok: false,
      code:
        "TASK_SCOPE_MISMATCH",
      target,
    };
  }

  if (
    request.actor ===
    "flash"
  ) {
    return {
      ok: false,
      code:
        "FLASH_READ_ONLY",
      target,
    };
  }

  if (
    !isInsideShowroomNamespace(
      target,
    )
  ) {
    return {
      ok: false,
      code:
        "ROLE_PATH_FORBIDDEN",
      target,
    };
  }

  if (
    !isInsideTaskScope(
      target,
      taskScope,
    )
  ) {
    return {
      ok: false,
      code:
        "TARGET_OUTSIDE_TASK_SCOPE",
      target,
    };
  }

  if (
    !isRolePathAllowed(
      request,
      target,
    )
  ) {
    return {
      ok: false,
      code:
        "ROLE_PATH_FORBIDDEN",
      target,
    };
  }

  if (artifact.frozen) {
    return {
      ok: false,
      code:
        "FROZEN_ARTIFACT",
      target,
    };
  }

  if (
    artifact.activeWriter !==
      null &&
    artifact.activeWriter !==
      request.actor
  ) {
    return {
      ok: false,
      code:
        "WRITE_LOCKED_BY_OTHER_ACTOR",
      target,
    };
  }

  if (
    artifact.writeLockTask !==
      null &&
    artifact.writeLockTask !==
      request.task
  ) {
    return {
      ok: false,
      code:
        "WRITE_LOCKED_BY_OTHER_TASK",
      target,
    };
  }

  if (
    artifact.status ===
    "review"
  ) {
    const permittedSparkStateUpdate =
      request.actor ===
        "spark" &&
      request.mutationKind ===
        "state-metadata" &&
      (
        artifact.type ===
          "task" ||
        artifact.type ===
          "command-state"
      );

    if (
      !permittedSparkStateUpdate
    ) {
      return {
        ok: false,
        code:
          "REVIEW_WRITE_FORBIDDEN",
        target,
      };
    }
  }

  return {
    ok: true,
    code:
      "AUTHORIZED",
    target,
  };
}