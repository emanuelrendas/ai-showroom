import {
  describe,
  expect,
  it,
} from "vitest";

import {
  validateVaultMutation,
} from "@/tools/obsidian-sync/contract-validator";

import type {
  ArtifactPolicyState,
  MutationKind,
  SyncOperation,
  VaultMutationRequest,
} from "@/tools/obsidian-sync/types";

const TASK =
  "TASK-AS-0003";

const TARGET =
  "03 - TASKS/ACTIVE/TASK-AS-0003-AUTOMATED-OBSIDIAN-SYNC.md";

const artifact:
  ArtifactPolicyState = {
  exists: true,
  type: "task",
  status: "active",
  frozen: false,
  owner: "sol",
  activeWriter: null,
  writeLockTask: null,
};

function flashRequest(
  overrides:
    Partial<VaultMutationRequest> = {},
): VaultMutationRequest {
  return {
    project:
      "ai-showroom",

    task:
      TASK,

    actor:
      "flash",

    operation:
      "update",

    mutationKind:
      "substantive",

    target:
      TARGET,

    ...overrides,
  };
}

function validate(
  request:
    VaultMutationRequest,
  artifactOverride:
    Partial<ArtifactPolicyState> = {},
) {
  return validateVaultMutation({
    request,

    artifact: {
      ...artifact,
      ...artifactOverride,
    },

    taskScope: {
      project:
        "ai-showroom",

      task:
        TASK,

      allowedTargetPrefixes: [
        "03 - TASKS/",
      ],
    },
  });
}

describe(
  "Gate E — Flash mutation operations",
  () => {
    const operations:
      readonly SyncOperation[] = [
      "create",
      "update",
      "append",
      "move",
      "delete",
    ];

    it.each(
      operations,
    )(
      "rejects Flash operation %s with stable FLASH_READ_ONLY",
      (
        operation,
      ) => {
        expect(
          validate(
            flashRequest({
              operation,
            }),
          ),
        ).toEqual({
          ok: false,
          code:
            "FLASH_READ_ONLY",
          target:
            TARGET,
        });
      },
    );
  },
);

describe(
  "Gate E — Flash mutation kinds",
  () => {
    const mutationKinds:
      readonly MutationKind[] = [
      "substantive",
      "state-metadata",
      "append-state",
    ];

    it.each(
      mutationKinds,
    )(
      "rejects Flash mutation kind %s",
      (
        mutationKind,
      ) => {
        expect(
          validate(
            flashRequest({
              mutationKind,
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "FLASH_READ_ONLY",
        });
      },
    );
  },
);

describe(
  "Gate E — Flash write-lock authority",
  () => {
    it(
      "rejects Flash attempting state metadata mutation when no writer exists",
      () => {
        expect(
          validate(
            flashRequest({
              mutationKind:
                "state-metadata",
            }),
            {
              activeWriter:
                null,
            },
          ),
        ).toMatchObject({
          ok: false,
          code:
            "FLASH_READ_ONLY",
        });
      },
    );

    it(
      "returns FLASH_READ_ONLY even while Sol owns the write lock",
      () => {
        expect(
          validate(
            flashRequest({
              mutationKind:
                "state-metadata",
            }),
            {
              activeWriter:
                "sol",
            },
          ),
        ).toMatchObject({
          ok: false,
          code:
            "FLASH_READ_ONLY",
        });
      },
    );

    it(
      "returns FLASH_READ_ONLY even while Spark owns the write lock",
      () => {
        expect(
          validate(
            flashRequest({
              mutationKind:
                "state-metadata",
            }),
            {
              activeWriter:
                "spark",
            },
          ),
        ).toMatchObject({
          ok: false,
          code:
            "FLASH_READ_ONLY",
        });
      },
    );

    it(
      "rejects Flash attempting to append state while a task lock exists",
      () => {
        expect(
          validate(
            flashRequest({
              operation:
                "append",

              mutationKind:
                "append-state",
            }),
            {
              writeLockTask:
                TASK,
            },
          ),
        ).toMatchObject({
          ok: false,
          code:
            "FLASH_READ_ONLY",
        });
      },
    );

    it(
      "keeps FLASH_READ_ONLY stronger than another actor owning the artifact",
      () => {
        expect(
          validate(
            flashRequest({
              mutationKind:
                "state-metadata",
            }),
            {
              activeWriter:
                "sol",

              writeLockTask:
                "TASK-AS-9999",
            },
          ),
        ).toMatchObject({
          ok: false,
          code:
            "FLASH_READ_ONLY",
        });
      },
    );
  },
);