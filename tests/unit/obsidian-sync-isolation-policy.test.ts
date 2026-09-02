import {
  describe,
  expect,
  it,
} from "vitest";

import {
  evaluateIsolation,
  isSameOrDescendant,
  parseGitRemoteIdentity,
  rootsOverlap,
} from "@/tools/obsidian-sync/isolation-policy";

import type {
  IsolationRequest,
  IsolationSnapshot,
} from "@/tools/obsidian-sync/isolation-types";

const SHOWROOM =
  "C:\\Projects\\AI-Showroom-Vault";

const RAIOC =
  "C:\\Projects\\RAIOC-V2";

const TARGET =
  "03 - TASKS/ACTIVE/TASK-AS-0003.md";

const APPROVED_REMOTE =
  "https://github.com/tiago/ai-showroom-vault.git";

function request(
  overrides:
    Partial<IsolationRequest> = {},
): IsolationRequest {
  return {
    project:
      "ai-showroom",

    repoPath:
      SHOWROOM,

    approvedVaultRoot:
      SHOWROOM,

    forbiddenRaiocRoots: [
      RAIOC,
    ],

    approvedRemote:
      APPROVED_REMOTE,

    targets: [
      TARGET,
    ],

    requiredEnvironmentKeys:
      [],

    ...overrides,
  };
}

function snapshot(
  overrides:
    Partial<IsolationSnapshot> = {},
): IsolationSnapshot {
  return {
    pathComparisonMode:
      "case-insensitive",

    repoRoot:
      SHOWROOM,

    vaultRoot:
      SHOWROOM,

    raiocRoots: [
      RAIOC,
    ],

    targetAnchors: [
      {
        target: TARGET,
        resolvedAnchor:
          `${SHOWROOM}\\03 - TASKS\\ACTIVE`,
      },
    ],

    actualOriginUrl:
      APPROVED_REMOTE,

    environmentKeys: [
      "PATH",
      "AI_SHOWROOM_VAULT_PATH",
    ],

    ...overrides,
  };
}

describe(
  "Gate D physical path policy",
  () => {
    it(
      "treats Windows case variants as the same physical root",
      () => {
        expect(
          rootsOverlap(
            "C:\\Projects\\Vault",
            "c:\\projects\\vault",
            "case-insensitive",
          ),
        ).toBe(true);
      },
    );

    it(
      "does not confuse similar path prefixes with ancestry",
      () => {
        expect(
          rootsOverlap(
            "C:\\Projects\\vault",
            "C:\\Projects\\vault-old",
            "case-insensitive",
          ),
        ).toBe(false);
      },
    );

    it(
      "detects a descendant",
      () => {
        expect(
          isSameOrDescendant(
            SHOWROOM,
            `${SHOWROOM}\\folder\\file.md`,
            "case-insensitive",
          ),
        ).toBe(true);
      },
    );

    it(
      "allows physically separate sibling project roots",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot(),
          ),
        ).toMatchObject({
          ok: true,
          code:
            "ISOLATION_VERIFIED",
        });
      },
    );

    it(
      "rejects identical Showroom and RAIOC roots",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              raiocRoots: [
                SHOWROOM,
              ],
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "PROJECT_ROOT_OVERLAP",
        });
      },
    );

    it(
      "rejects RAIOC nested inside Showroom",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              raiocRoots: [
                `${SHOWROOM}\\RAIOC`,
              ],
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "PROJECT_ROOT_OVERLAP",
        });
      },
    );

    it(
      "rejects Showroom nested inside RAIOC",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              raiocRoots: [
                "C:\\Projects",
              ],
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "PROJECT_ROOT_OVERLAP",
        });
      },
    );

    it(
      "requires repository physical root to equal the approved vault root",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              repoRoot:
                `${SHOWROOM}\\nested`,
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "VAULT_ROOT_MISMATCH",
        });
      },
    );

    it(
      "rejects a target whose physical anchor escapes the Showroom vault",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              targetAnchors: [
                {
                  target:
                    TARGET,
                  resolvedAnchor:
                    `${RAIOC}\\secret`,
                },
              ],
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "TARGET_PATH_ESCAPE",
          path:
            TARGET,
        });
      },
    );
  },
);

describe(
  "Gate D Git remote identity",
  () => {
    it.each([
      [
        "https://github.com/Tiago/AI-Showroom-Vault.git",
      ],
      [
        "git@github.com:Tiago/AI-Showroom-Vault.git",
      ],
      [
        "ssh://git@github.com/Tiago/AI-Showroom-Vault.git",
      ],
    ])(
      "parses supported remote %s",
      (remote) => {
        expect(
          parseGitRemoteIdentity(
            remote,
          ),
        ).toEqual({
          host:
            "github.com",
          owner:
            "tiago",
          repo:
            "ai-showroom-vault",
        });
      },
    );

    it.each([
      "ftp://github.com/tiago/vault.git",
      "https://token@github.com/tiago/vault.git",
      "https://gitlab.com/tiago/vault.git",
      "https://github.com/tiago/a/b.git",
      "not-a-remote",
    ])(
      "rejects unsupported remote %s",
      (remote) => {
        expect(
          parseGitRemoteIdentity(
            remote,
          ),
        ).toBeNull();
      },
    );

    it(
      "rejects the RAIOC repository even when the host is correct",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              actualOriginUrl:
                "https://github.com/tiago/raioc-obsidian-vault2.git",
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "REMOTE_IDENTITY_MISMATCH",
        });
      },
    );

    it(
      "does not allow a deceptive repository-name substring",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              actualOriginUrl:
                "https://github.com/tiago/ai-showroom-vault-raioc.git",
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "REMOTE_IDENTITY_MISMATCH",
        });
      },
    );

    it(
      "rejects a missing origin",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              actualOriginUrl:
                null,
            }),
          ),
        ).toMatchObject({
          ok: false,
          code:
            "REMOTE_NOT_CONFIGURED",
        });
      },
    );
  },
);

describe(
  "Gate D credential namespace",
  () => {
    it(
      "allows AI_SHOWROOM-prefixed project environment names",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              environmentKeys: [
                "PATH",
                "AI_SHOWROOM_VAULT_PATH",
                "AI_SHOWROOM_VAULT_REMOTE",
              ],
            }),
          ),
        ).toMatchObject({
          ok: true,
          code:
            "ISOLATION_VERIFIED",
        });
      },
    );

    it.each([
      "RAIOC_GITHUB_TOKEN",
      "RAIOC_VAULT_TOKEN",
      "RAIOC_SUPABASE_SERVICE_ROLE_KEY",
      "RAIOC_PROGRESS_SECRET",
    ])(
      "rejects inherited forbidden environment key %s",
      (
        forbiddenKey,
      ) => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              environmentKeys: [
                "PATH",
                "AI_SHOWROOM_VAULT_TOKEN",
                forbiddenKey,
              ],
            }),
          ),
        ).toEqual({
          ok: false,
          code:
            "FORBIDDEN_CREDENTIAL_NAMESPACE",
          environmentKey:
            forbiddenKey,
        });
      },
    );

    it(
      "requires explicitly configured Showroom credential keys",
      () => {
        expect(
          evaluateIsolation(
            request({
              requiredEnvironmentKeys:
                [
                  "AI_SHOWROOM_VAULT_TOKEN",
                ],
            }),
            snapshot({
              environmentKeys: [
                "PATH",
              ],
            }),
          ),
        ).toEqual({
          ok: false,
          code:
            "REQUIRED_SHOWROOM_CREDENTIAL_MISSING",
          environmentKey:
            "AI_SHOWROOM_VAULT_TOKEN",
        });
      },
    );

    it(
      "never receives credential values as policy input",
      () => {
        const decision =
          evaluateIsolation(
            request(),
            snapshot({
              environmentKeys: [
                "RAIOC_GITHUB_TOKEN",
              ],
            }),
          );

        expect(
          JSON.stringify(
            decision,
          ),
        ).not.toContain(
          "SUPER_SECRET_VALUE",
        );
      },
    );
  },
);