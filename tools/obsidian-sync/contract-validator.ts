import {
  AI_SHOWROOM_PROJECT,
  type ArtifactPolicyState,
  type AuthorizedTaskScope,
  type ContractDecision,
  type VaultMutationRequest,
} from "./types";

type ValidationInput = {
  request: VaultMutationRequest;
  artifact: ArtifactPolicyState;
  taskScope: AuthorizedTaskScope;
};

const SOL_WRITE_PREFIXES = [
  "00 - COMMAND CENTER/",
  "01 - ARCHITECTURE/",
  "02 - MILESTONES/",
  "03 - TASKS/ACTIVE/",
  "03 - TASKS/BLOCKED/",
  "03 - TASKS/REVIEW/",
  "04 - AI WORKSPACE/SOL/",
  "05 - REVIEWS/ARCHITECTURE-REVIEWS/",
  "06 - KNOWLEDGE/",
  "07 - HANDOFFS/",
  "08 - EVIDENCE/",
] as const;

const SPARK_WRITE_PREFIXES = [
  "00 - COMMAND CENTER/",
  "03 - TASKS/",
  "04 - AI WORKSPACE/SPARK/",
  "07 - HANDOFFS/",
  "08 - EVIDENCE/",
] as const;

export function normalizeVaultTarget(
  target: string,
): string | null {
  const trimmed = target.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replaceAll("\\", "/");

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    return null;
  }

  const segments = normalized.split("/");

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

function isUnderAnyPrefix(
  target: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some(
    (prefix) => target.startsWith(prefix),
  );
}

function roleMayWrite(
  request: VaultMutationRequest,
  target: string,
): boolean {
  switch (request.actor) {
    case "flash":
      return false;

    case "tiago":
      return true;

    case "sol":
      return isUnderAnyPrefix(
        target,
        SOL_WRITE_PREFIXES,
      );

    case "spark":
      if (
        target.startsWith("01 - ARCHITECTURE/") ||
        target.startsWith("02 - MILESTONES/")
      ) {
        return false;
      }

      return isUnderAnyPrefix(
        target,
        SPARK_WRITE_PREFIXES,
      );

    default:
      return false;
  }
}

export function validateVaultMutation({
  request,
  artifact,
  taskScope,
}: ValidationInput): ContractDecision {
  const target = normalizeVaultTarget(
    request.target,
  );

  if (!target) {
    return {
      ok: false,
      code: "INVALID_TARGET",
    };
  }

  if (
    request.project !== AI_SHOWROOM_PROJECT ||
    taskScope.project !== AI_SHOWROOM_PROJECT
  ) {
    return {
      ok: false,
      code: "PROJECT_MISMATCH",
      target,
    };
  }

  if (request.task !== taskScope.task) {
    return {
      ok: false,
      code: "TASK_SCOPE_MISMATCH",
      target,
    };
  }

  if (request.actor === "flash") {
    return {
      ok: false,
      code: "FLASH_READ_ONLY",
      target,
    };
  }

  if (
    !isUnderAnyPrefix(
      target,
      taskScope.allowedTargetPrefixes,
    )
  ) {
    return {
      ok: false,
      code: "TARGET_OUTSIDE_TASK_SCOPE",
      target,
    };
  }

  if (!roleMayWrite(request, target)) {
    return {
      ok: false,
      code: "ROLE_PATH_FORBIDDEN",
      target,
    };
  }

  if (artifact.frozen) {
    return {
      ok: false,
      code: "FROZEN_ARTIFACT",
      target,
    };
  }

  if (
    artifact.activeWriter !== null &&
    artifact.activeWriter !== request.actor
  ) {
    return {
      ok: false,
      code: "WRITE_LOCKED_BY_OTHER_ACTOR",
      target,
    };
  }

  if (
    artifact.writeLockTask !== null &&
    artifact.writeLockTask !== request.task
  ) {
    return {
      ok: false,
      code: "WRITE_LOCKED_BY_OTHER_TASK",
      target,
    };
  }

  if (artifact.status === "review") {
    const sparkReviewStateUpdate =
      request.actor === "spark" &&
      request.mutationKind === "state-metadata" &&
      (
        artifact.type === "task" ||
        artifact.type === "command-state"
      );

    if (!sparkReviewStateUpdate) {
      return {
        ok: false,
        code: "REVIEW_WRITE_FORBIDDEN",
        target,
      };
    }
  }

  return {
    ok: true,
    code: "AUTHORIZED",
    target,
  };
}