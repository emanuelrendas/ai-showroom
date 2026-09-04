import {
  readFile,
} from "node:fs/promises";

import {
  resolve,
} from "node:path";

import {
  pathToFileURL,
} from "node:url";

import {
  executeMutationPipeline,
  type MutationPipelineRequest,
} from "./mutation-pipeline";

import {
  executeLocalObsidianPull,
} from "./local-pull";

import {
  NodeIsolationAdapter,
} from "./node-isolation-adapter";

import {
  GitCliAdapter as GitCliTransactionAdapter,
} from "./git-cli-adapter";

import {
  GitCliPullAdapter,
} from "./git-cli-pull-adapter";

export type FoundationDossierCreateEvidence = {
  FINAL_VERDICT: "PASS" | "HOLD";
  FAILURE_CODE: string | null;
};

type TargetSnapshot = {
  exists: boolean;
  content: string;
};

export type FoundationDossierCreateDependencies = {
  environment:
    Record<string, string | undefined>;

  transactionAdapter?: {
    getLocalHead:
      (
        repoPath: string,
        branch: string,
      ) => Promise<string>;

    getRemoteHead:
      (
        repoPath: string,
        branch: string,
      ) => Promise<string>;
  };

  readTarget?:
    (
      vaultRoot: string,
    ) => Promise<TargetSnapshot>;

  executeMutationPipelineFn?:
    (
      request: MutationPipelineRequest,
      pipelineDependencies: {
        isolationAdapter: unknown;
        gitAdapter: unknown;
      },
    ) => Promise<unknown>;

  isolationAdapter?: unknown;
  pullAdapter?: unknown;

  executeLocalObsidianPullFn?: (
    pullRequest: unknown,
    pullDependencies: {
      isolationAdapter: unknown;
      pullAdapter: unknown;
    },
  ) => Promise<unknown>;
};

const ARM_KEY =
  "AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM";

const REQUIRED_ARM =
  "AUTHORIZED_BY_TIAGO";

const TASK =
  "TASK-AS-0004" as const;

const TARGET =
  "04 - AI WORKSPACE/AI-SHOWROOM/SOL/FOUNDATION/OBSIDIAN-AI-SYNC-FOUNDATION.md" as const;

const VAULT_ROOT =
  String.raw`C:\Users\diore\Documents\RAIOC V2`;

const REMOTE =
  "https://github.com/emanuelrendas/raioc-obsidian-vault2.git" as const;

const BASE_SHA =
  "5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7" as const;

const DOSSIER =
  String.raw`# Obsidian AI Sync Foundation

## Canonical Identity

Subsystem: Obsidian AI Sync Foundation
Project: AI Showroom
Artifact Owner: Sol
Lifecycle Authority: Tiago
Current Status: ACTIVE
Milestone 2: STRICT HOLD

Canonical Vault:
C:\Users\diore\Documents\RAIOC V2

Canonical Tenant:
04 - AI WORKSPACE/AI-SHOWROOM/

Canonical Foundation Artifact:
04 - AI WORKSPACE/AI-SHOWROOM/SOL/FOUNDATION/OBSIDIAN-AI-SYNC-FOUNDATION.md

Foundation Creation Base:
5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7

Application Baseline Anchor:
df87a2bd96b2c22d3da1931cb1f2aec7788b1c8f

Milestone 1:
FROZEN

Milestone 2:
STRICT HOLD

---

## Governance Model

One Project → One Operational Chat → One Source of Truth → No Cross-Chat Execution Drift.

Code Truth:
GitHub / ai-showroom repository

Operational Vault Truth:
RAIOC V2 shared vault

AI Showroom Tenant Boundary:
04 - AI WORKSPACE/AI-SHOWROOM/

Human Freeze Authority:
Tiago

Foundation Owner:
Sol

Independent Architecture Challenger:
Spark

Independent Forensic Auditor:
Flash

Flash Write Authority:
NONE — STRICT READ-ONLY

---

## Tenant Write Boundaries

Sol:
04 - AI WORKSPACE/AI-SHOWROOM/SOL/

Spark:
04 - AI WORKSPACE/AI-SHOWROOM/SPARK/

Flash:
ZERO WRITES

No AI Showroom automation is authorized to write outside:

04 - AI WORKSPACE/AI-SHOWROOM/

Existing RAIOC runtime, n8n governance, missions, canaries, and Emanuel-owned operational authority remain outside AI Showroom scope.

---

## Foundation Gate Reconciliation

### Gate A — Authorization & Lifecycle Control

Status: COMPLETE

Verified controls:
- tenant authorization
- role authorization
- task scope
- lifecycle enforcement
- writer locks
- Flash read-only invariant
- human-approved review closure authority

Evidence Anchor:
cd438b607334906aeaeb34eef0bfbbc97112398d

### Gate B — Append-Only State Integrity

Status: COMPLETE

Verified controls:
- append-only lifecycle validation
- exact state-transition event binding
- review-closure event validation

Evidence Anchor:
e46bdd1af071610fc27a7a71767eb003e071c060

### Gate C — Git SHA-CAS Transaction Safety

Status: COMPLETE

Verified controls:
- exact base SHA binding
- exact path binding
- isolated transaction
- commit-parent verification
- remote verification
- no force
- no rebase
- no stash
- no reset
- no silent retry

Evidence Anchor:
fb79278b31dbe32f2fc07989f5c2fe74b38e205a

### Gate D — Vault Identity & Physical Containment

Status: COMPLETE

Verified controls:
- exact vault identity
- exact tenant path containment
- exact Git remote identity
- required environment key names
- no secret values persisted

Evidence Anchor:
16ac13bcc0b22f5eccc77d9238cbfc9f3937fc2f

### Gate E — Flash Read-Only

Status: COMPLETE

Invariant:
Flash has zero write authority.

Evidence Anchor:
54aaaf9705334853139ce867a49e363064afd670

### Gate F — Local / Remote Convergence

Status: COMPLETE

Verified sequence:
fetch → ancestry verification → merge --ff-only → final SHA verification → clean worktree verification

Evidence Anchor:
a0d7660b66faec46c5be4c55a9421e6715e6ebfb

### Gate G — Controlled Live Canary

Status: CERTIFIED

Harness Anchor:
a8ea0ae90f2aeb12ac7235bd9b8d94403ddb0d03

Live Canary Commit:
eb21bb583b4264c99a69c91f1fe486ebe4b4639b

Application Evidence Anchor:
df87a2bd96b2c22d3da1931cb1f2aec7788b1c8f

Independent Flash Verdict:
PASS

---

## TASK-AS-0003 Closure

Task:
TASK-AS-0003

Lifecycle:
ACTIVE → REVIEW → DONE

Final Status:
DONE

Closure Commit:
37b64df88dad23a9c5fc674a4f0236c5619e5bf2

Closure Authority:
Tiago

Closure Validation:
- exact approved base SHA
- single-file blast radius
- governed review → done transition
- Flash PASS
- Spark PASS
- local/remote convergence
- clean final worktree

TASK-AS-0003 is closed and must not be reused as the Foundation lifecycle owner.

---

## Foundation Reconciliation Verdict

The Obsidian AI Sync Foundation has established:

- governed logical authorization
- append-only lifecycle integrity
- SHA-CAS Git transactions
- physical vault and tenant containment
- strict Flash read-only enforcement
- deterministic local/remote convergence
- controlled live canary execution
- human-approved review closure
- production execution wiring
- successful governed TASK-AS-0003 closure

Current Foundation lifecycle state remains:

ACTIVE

Creation of this dossier does NOT constitute:

ACTIVE → REVIEW

and does NOT authorize:

REVIEW → FROZEN

---

## Foundation Review Preconditions

Before ACTIVE → REVIEW:

- this canonical dossier must exist through a governed create-once transaction
- creation commit must modify exactly this one file
- creation commit parent must equal the approved creation base
- local and remote vault must converge on the creation commit
- worktree must be clean
- Flash must independently audit the creation commit
- Spark must independently challenge the Foundation reconciliation
- no unresolved P0/P1/P2 governance findings may remain

---

## Freeze Preconditions

Foundation REVIEW → FROZEN requires:

- Foundation already in REVIEW
- successful final Foundation reconciliation
- Flash PASS
- Spark PASS
- exact review base SHA binding
- explicit Tiago freeze authorization
- governed append-only REVIEW → FROZEN event
- local/remote convergence
- clean worktree

No automated agent may infer freeze authority.

---

## Milestone 2 Boundary

Milestone 2 Status:
STRICT HOLD

Milestone 2 may not begin merely because:

- Gates A–G are complete
- TASK-AS-0003 is DONE
- this dossier exists
- the Foundation enters REVIEW

Milestone 2 can only be considered after:

Obsidian AI Sync Foundation = FROZEN

with explicit Tiago freeze authority.

---

## Initial State Record

Foundation Status: ACTIVE
Recorded By: Sol
Creation Authority: Tiago-approved Foundation architecture
Creation Base: 5e9884aa9ae0c16d1bab74f2c44201ff29bcf1f7
TASK-AS-0003: DONE
TASK-AS-0003 Closure: 37b64df88dad23a9c5fc674a4f0236c5619e5bf2
Application Baseline: df87a2bd96b2c22d3da1931cb1f2aec7788b1c8f
Milestone 2: STRICT HOLD`;

export async function runFoundationDossierCreate(
  dependencies:
    FoundationDossierCreateDependencies,
): Promise<FoundationDossierCreateEvidence> {
  if (
    dependencies.environment[ARM_KEY] !==
    REQUIRED_ARM
  ) {
    return {
      FINAL_VERDICT: "HOLD",
      FAILURE_CODE:
        "FOUNDATION_DOSSIER_CREATE_NOT_ARMED",
    };
  }

  if (
    dependencies.transactionAdapter
  ) {
    const localHead =
      await dependencies
        .transactionAdapter
        .getLocalHead(
          VAULT_ROOT,
          "main",
        );

    if (
      localHead !==
      BASE_SHA
    ) {
      return {
        FINAL_VERDICT: "HOLD",
        FAILURE_CODE:
          "INITIAL_CONVERGENCE_FAILURE",
      };
    }

    const remoteHead =
      await dependencies
        .transactionAdapter
        .getRemoteHead(
          VAULT_ROOT,
          "main",
        );

    if (
      remoteHead !==
      BASE_SHA
    ) {
      return {
        FINAL_VERDICT: "HOLD",
        FAILURE_CODE:
          "INITIAL_CONVERGENCE_FAILURE",
      };
    }
  }

  if (
    !dependencies.readTarget
  ) {
    return {
      FINAL_VERDICT: "HOLD",
      FAILURE_CODE:
        "FOUNDATION_DOSSIER_CREATE_DEPENDENCY_MISSING",
    };
  }

  const targetSnapshot =
    await dependencies.readTarget(
      VAULT_ROOT,
    );

  if (
    targetSnapshot.exists
  ) {
    return {
      FINAL_VERDICT: "HOLD",
      FAILURE_CODE:
        "FOUNDATION_DOSSIER_ALREADY_EXISTS",
    };
  }

  if (
    !dependencies.executeMutationPipelineFn
  ) {
    return {
      FINAL_VERDICT: "HOLD",
      FAILURE_CODE:
        "FOUNDATION_DOSSIER_CREATE_DEPENDENCY_MISSING",
    };
  }

  const mutationRequest:
    MutationPipelineRequest = {
    transaction: {
      project:
        "ai-showroom",

      task:
        TASK,

      repoPath:
        VAULT_ROOT,

      targetBranch:
        "main",

      expectedBaseSha:
        BASE_SHA,

      commitMessage:
        "docs(obsidian): establish canonical foundation dossier",

      changes: [
        {
          request: {
            project:
              "ai-showroom",

            task:
              TASK,

            actor:
              "sol",

            operation:
              "create",

            mutationKind:
              "substantive",

            target:
              TARGET,
          },

          artifact: {
            exists:
              false,

            type:
              "architecture",

            status:
              "active",

            frozen:
              false,

            owner:
              "sol",

            activeWriter:
              "sol",

            writeLockTask:
              TASK,
          },

          taskScope: {
            project:
              "ai-showroom",

            task:
              TASK,

            allowedTargetPrefixes: [
              "04 - AI WORKSPACE/AI-SHOWROOM/SOL/",
            ],
          },

          currentContent:
            "",

          proposedContent:
            DOSSIER,
        },
      ],
    },

    isolation: {
      approvedVaultRoot:
        VAULT_ROOT,

      approvedRemote:
        REMOTE,

      requiredEnvironmentKeys: [
        "AI_SHOWROOM_VAULT_PATH",
        "AI_SHOWROOM_VAULT_REMOTE",
      ],
    },
  };

  const mutationDecision =
    await dependencies
      .executeMutationPipelineFn(
        mutationRequest,
        {
          isolationAdapter:
            dependencies.isolationAdapter,

          gitAdapter:
            dependencies.transactionAdapter,
        },
      );

  if (
    typeof mutationDecision ===
      "object" &&
    mutationDecision !==
      null &&
    "ok" in mutationDecision &&
    mutationDecision.ok ===
      false
  ) {
    return {
      FINAL_VERDICT: "HOLD",
      FAILURE_CODE:
        "MUTATION_PIPELINE_REJECTED",
    };
  }

  if (
    dependencies.executeLocalObsidianPullFn
  ) {
    const pullDecision =
      await dependencies
        .executeLocalObsidianPullFn(
          {
            project:
              "ai-showroom",

            repoPath:
              VAULT_ROOT,

            targetBranch:
              "main",

            isolation: {
              approvedVaultRoot:
                VAULT_ROOT,

              approvedRemote:
                REMOTE,

              requiredEnvironmentKeys: [
                "AI_SHOWROOM_VAULT_PATH",
                "AI_SHOWROOM_VAULT_REMOTE",
              ],
            },
          },
          {
            isolationAdapter:
              dependencies.isolationAdapter,

            pullAdapter:
              dependencies.pullAdapter,
          },
        );

    if (
      typeof pullDecision === "object" &&
      pullDecision !== null &&
      "ok" in pullDecision &&
      pullDecision.ok === false
    ) {
      return {
        FINAL_VERDICT: "HOLD",
        FAILURE_CODE:
          "GATE_F_REJECTED",
      };
    }

    if (
      typeof pullDecision !== "object" ||
      pullDecision === null ||
      !("code" in pullDecision) ||
      pullDecision.code !== "FAST_FORWARDED"
    ) {
      return {
        FINAL_VERDICT: "HOLD",
        FAILURE_CODE:
          "GATE_F_NOT_FAST_FORWARDED",
      };
    }
  }

  return {
    FINAL_VERDICT: "PASS",
    FAILURE_CODE: null,
  };
}

export function createProductionFoundationDossierCreateDependencies():
  FoundationDossierCreateDependencies {
  const isolationAdapter =
    new NodeIsolationAdapter();

  const transactionAdapter =
    new GitCliTransactionAdapter();

  const pullAdapter =
    new GitCliPullAdapter();

  return {
    environment:
      process.env,

    isolationAdapter,

    transactionAdapter,

    pullAdapter,

    readTarget:
      async (
        vaultRoot,
      ) => {
        try {
          return {
            exists:
              true,

            content:
              await readFile(
                resolve(
                  vaultRoot,
                  TARGET,
                ),
                "utf8",
              ),
          };
        } catch (
          error
        ) {
          if (
            (
              error as NodeJS.ErrnoException
            ).code ===
            "ENOENT"
          ) {
            return {
              exists:
                false,

              content:
                "",
            };
          }

          throw error;
        }
      },

    executeMutationPipelineFn:
      async (
        request,
      ) =>
        executeMutationPipeline(
          request,
          {
            isolationAdapter,

            gitAdapter:
              transactionAdapter,
          },
        ),

    executeLocalObsidianPullFn:
      async (
        request,
      ) =>
        executeLocalObsidianPull(
          request as Parameters<
            typeof executeLocalObsidianPull
          >[0],
          {
            isolationAdapter,
            pullAdapter,
          },
        ),
  };
}

export async function main():
  Promise<void> {
  const evidence =
    await runFoundationDossierCreate(
      createProductionFoundationDossierCreateDependencies(),
    );

  console.log(
    JSON.stringify(
      evidence,
      null,
      2,
    ),
  );

  if (
    evidence.FINAL_VERDICT !==
    "PASS"
  ) {
    process.exitCode =
      1;
  }
}

const entry =
  process.argv[1];

if (
  entry &&
  pathToFileURL(
    resolve(
      entry,
    ),
  ).href ===
    import.meta.url
) {
  void main();
}
