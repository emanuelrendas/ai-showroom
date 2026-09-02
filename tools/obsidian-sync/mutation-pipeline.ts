import type {
  AppendOnlyDenyCode,
  ContractDenyCode,
  GitTransactionDecision,
  GitTransactionRequest,
} from "./types";

import type {
  GitAdapter,
} from "./git-adapter";

import type {
  IsolationAdapter,
} from "./isolation-adapter";

import type {
  IsolationDecision,
  IsolationRequest,
} from "./isolation-types";

import {
  validateVaultMutation,
} from "./contract-validator";

import {
  validateAppendOnlyMutation,
} from "./append-only-validator";

import {
  verifyIsolation,
} from "./isolation-gate";

import {
  executeGitTransaction,
} from "./git-transaction";

export type MutationPipelineIsolationConfig =
  Omit<
    IsolationRequest,
    "project" | "repoPath" | "targets"
  >;

export type MutationPipelineRequest = {
  transaction:
    GitTransactionRequest;

  isolation:
    MutationPipelineIsolationConfig;
};

export type MutationPipelineDecision =
  | {
      ok: true;
      code:
        "MUTATION_COMMITTED";
      transaction:
        Extract<
          GitTransactionDecision,
          { ok: true }
        >;
      isolation:
        Extract<
          IsolationDecision,
          { ok: true }
        >;
    }
  | {
      ok: false;
      code:
        "FLASH_READ_ONLY";
    }
  | {
      ok: false;
      code:
        "GATE_A_REJECTED";
      policyCode:
        ContractDenyCode;
    }
  | {
      ok: false;
      code:
        "GATE_B_REJECTED";
      policyCode:
        AppendOnlyDenyCode;
    }
  | {
      ok: false;
      code:
        "GATE_D_REJECTED";
      isolationCode:
        Extract<
          IsolationDecision,
          { ok: false }
        >["code"];
    }
  | {
      ok: false;
      code:
        "GATE_C_REJECTED";
      transactionCode:
        Extract<
          GitTransactionDecision,
          { ok: false }
        >["code"];
    };

type GateAValidator =
  typeof validateVaultMutation;

type GateBValidator =
  typeof validateAppendOnlyMutation;

type GateDVerifier =
  typeof verifyIsolation;

type GateCExecutor =
  typeof executeGitTransaction;

export type MutationPipelineDependencies = {
  isolationAdapter:
    IsolationAdapter;

  gitAdapter:
    GitAdapter;

  validateGateA?:
    GateAValidator;

  validateGateB?:
    GateBValidator;

  verifyGateD?:
    GateDVerifier;

  executeGateC?:
    GateCExecutor;
};

export async function executeMutationPipeline(
  request:
    MutationPipelineRequest,
  dependencies:
    MutationPipelineDependencies,
): Promise<MutationPipelineDecision> {
  const validateGateA =
    dependencies.validateGateA ??
    validateVaultMutation;

  const validateGateB =
    dependencies.validateGateB ??
    validateAppendOnlyMutation;

  const runGateD =
    dependencies.verifyGateD ??
    verifyIsolation;

  const runGateC =
    dependencies.executeGateC ??
    executeGitTransaction;

  const transaction =
    request.transaction;

  if (
    transaction.project !==
    "ai-showroom"
  ) {
    return {
      ok: false,
      code:
        "GATE_A_REJECTED",
      policyCode:
        "PROJECT_MISMATCH",
    };
  }

  const authorizedTargets:
    string[] = [];

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
        code:
          "GATE_A_REJECTED",
        policyCode:
          "TASK_SCOPE_MISMATCH",
      };
    }

    const gateA =
      validateGateA({
        request:
          change.request,

        artifact:
          change.artifact,

        taskScope:
          change.taskScope,
      });

    if (!gateA.ok) {
      if (
        gateA.code ===
        "FLASH_READ_ONLY"
      ) {
        return {
          ok: false,
          code:
            "FLASH_READ_ONLY",
        };
      }

      return {
        ok: false,
        code:
          "GATE_A_REJECTED",
        policyCode:
          gateA.code,
      };
    }

    if (
      change.request
        .mutationKind ===
      "append-state"
    ) {
      const gateB =
        validateGateB({
          request:
            change.request,

          currentContent:
            change.currentContent,

          proposedContent:
            change.proposedContent,
        });

      if (!gateB.ok) {
        return {
          ok: false,
          code:
            "GATE_B_REJECTED",
          policyCode:
            gateB.code,
        };
      }
    }

    authorizedTargets.push(
      gateA.target,
    );
  }

  const isolationRequest:
    IsolationRequest = {
    ...request.isolation,

    project:
      transaction.project,

    repoPath:
      transaction.repoPath,

    targets:
      authorizedTargets,
  };

  const gateD =
    await runGateD(
      isolationRequest,
      dependencies
        .isolationAdapter,
    );

  if (!gateD.ok) {
    return {
      ok: false,
      code:
        "GATE_D_REJECTED",
      isolationCode:
        gateD.code,
    };
  }

  const gateC =
    await runGateC(
      transaction,
      dependencies.gitAdapter,
    );

  if (!gateC.ok) {
    return {
      ok: false,
      code:
        "GATE_C_REJECTED",
      transactionCode:
        gateC.code,
    };
  }

  return {
    ok: true,
    code:
      "MUTATION_COMMITTED",
    isolation:
      gateD,
    transaction:
      gateC,
  };
}