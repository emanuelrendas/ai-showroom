import type {
  IsolationAdapter,
} from "./isolation-adapter";

import {
  evaluateIsolation,
  isSafeVaultRelativeTarget,
} from "./isolation-policy";

import type {
  IsolationDecision,
  IsolationGuardDecision,
  IsolationRequest,
  IsolationSnapshot,
  TargetPhysicalAnchor,
} from "./isolation-types";

function deny(
  code:
    Extract<
      IsolationDecision,
      { ok: false }
    >["code"],
  options: {
    path?: string;
    environmentKey?: string;
  } = {},
): IsolationDecision {
  return {
    ok: false,
    code,
    ...options,
  };
}

export async function verifyIsolation(
  request: IsolationRequest,
  adapter: IsolationAdapter,
): Promise<IsolationDecision> {
  for (
    const target of
    request.targets
  ) {
    if (
      !isSafeVaultRelativeTarget(
        target,
      )
    ) {
      return deny(
        "TARGET_PATH_ESCAPE",
        {
          path: target,
        },
      );
    }
  }

  let vaultRoot: string;

  try {
    vaultRoot =
      await adapter.realpath(
        request
          .approvedVaultRoot,
      );
  } catch {
    return deny(
      "VAULT_REALPATH_FAILED",
      {
        path:
          request
            .approvedVaultRoot,
      },
    );
  }

  let repoRoot: string;

  try {
    repoRoot =
      await adapter.realpath(
        request.repoPath,
      );
  } catch {
    return deny(
      "REPO_REALPATH_FAILED",
      {
        path:
          request.repoPath,
      },
    );
  }

  const targetAnchors:
    TargetPhysicalAnchor[] =
      [];

  for (
    const target of
    request.targets
  ) {
    try {
      const resolvedAnchor =
        await adapter
          .resolveTargetPhysicalAnchor(
            request.repoPath,
            target,
          );

      targetAnchors.push({
        target,
        resolvedAnchor,
      });
    } catch {
      return deny(
        "TARGET_PATH_ESCAPE",
        {
          path: target,
        },
      );
    }
  }

  let actualOriginUrl:
    string | null;

  try {
    actualOriginUrl =
      await adapter
        .getOriginUrl(
          request.repoPath,
        );
  } catch {
    return deny(
      "ISOLATION_INSPECTION_FAILED",
    );
  }

  let environmentKeys:
    readonly string[];

  let pathComparisonMode:
    ReturnType<
      IsolationAdapter[
        "getPathComparisonMode"
      ]
    >;

  try {
    environmentKeys =
      adapter
        .listEnvironmentKeys();

    pathComparisonMode =
      adapter
        .getPathComparisonMode();
  } catch {
    return deny(
      "ISOLATION_INSPECTION_FAILED",
    );
  }

  const snapshot:
    IsolationSnapshot = {
    pathComparisonMode,
    repoRoot,
    vaultRoot,
    targetAnchors,
    actualOriginUrl,
    environmentKeys,
  };

  return evaluateIsolation(
    request,
    snapshot,
  );
}

export async function executeAfterIsolation<
  T,
>(
  request: IsolationRequest,
  adapter: IsolationAdapter,
  action: () => Promise<T>,
): Promise<
  IsolationGuardDecision<T>
> {
  const isolation =
    await verifyIsolation(
      request,
      adapter,
    );

  if (!isolation.ok) {
    return {
      ok: false,
      code:
        "ISOLATION_REJECTED",
      isolation,
    };
  }

  const result =
    await action();

  return {
    ok: true,
    code:
      "ISOLATION_VERIFIED_AND_EXECUTED",
    isolation,
    result,
  };
}