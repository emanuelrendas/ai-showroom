import {
  describe,
  expect,
  it,
} from "vitest";

import {
  canonicalizePhysicalPath,
  evaluateIsolation,
  isSameOrDescendant,
  parseGitRemoteIdentity,
} from "@/tools/obsidian-sync/isolation-policy";

import type {
  IsolationRequest,
  IsolationSnapshot,
} from "@/tools/obsidian-sync/isolation-types";

const SHARED_VAULT =
  "C:\\Users\\diore\\Documents\\RAIOC V2";

const TARGET =
  "04 - AI WORKSPACE/SPARK/STATE-UPDATES/TASK-AS-0003.md";

const APPROVED_REMOTE =
  "https://github.com/emanuelrendas/raioc-obsidian-vault2.git";

function request(
  overrides:
    Partial<IsolationRequest> = {},
): IsolationRequest {
  return {
    project:
      "ai-showroom",

    repoPath:
      SHARED_VAULT,

    approvedVaultRoot:
      SHARED_VAULT,

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
      SHARED_VAULT,

    vaultRoot:
      SHARED_VAULT,

    targetAnchors: [
      {
        target:
          TARGET,

        resolvedAnchor:
          `${SHARED_VAULT}\\04 - AI WORKSPACE\\SPARK\\STATE-UPDATES`,
      },
    ],

    actualOriginUrl:
      APPROVED_REMOTE,

    environmentKeys: [
      "PATH",
      "RAIOC_GITHUB_TOKEN",
      "RAIOC_SUPABASE_KEY",
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
          canonicalizePhysicalPath(
            "C:\\Users\\DIORE\\Documents\\RAIOC V2",
            "case-insensitive",
          ),
        ).toBe(
          canonicalizePhysicalPath(
            "c:\\users\\diore\\documents\\raioc v2",
            "case-insensitive",
          ),
        );
      },
    );

    it(
      "does not confuse similar path prefixes with ancestry",
      () => {
        expect(
          isSameOrDescendant(
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
            SHARED_VAULT,
            `${SHARED_VAULT}\\folder\\file.md`,
            "case-insensitive",
          ),
        ).toBe(true);
      },
    );

    it(
      "accepts the real shared RAIOC V2 vault identity",
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

          remote: {
            host:
              "github.com",

            owner:
              "emanuelrendas",

            repo:
              "raioc-obsidian-vault2",
          },
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
                `${SHARED_VAULT}\\nested`,
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
      "rejects a physical target anchor outside the shared vault",
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
                    "C:\\Users\\diore\\Some Other Folder",
                },
              ],
            }),
          ),
        ).toEqual({
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
        "https://github.com/emanuelrendas/raioc-obsidian-vault2.git",
      ],
      [
        "git@github.com:emanuelrendas/raioc-obsidian-vault2.git",
      ],
      [
        "ssh://git@github.com/emanuelrendas/raioc-obsidian-vault2.git",
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
            "emanuelrendas",
          repo:
            "raioc-obsidian-vault2",
        });
      },
    );

    it.each([
      "ftp://github.com/emanuelrendas/vault.git",
      "https://token@github.com/emanuelrendas/vault.git",
      "https://gitlab.com/emanuelrendas/vault.git",
      "https://github.com/emanuelrendas/a/b.git",
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
      "rejects a different repository even under Emanuel's GitHub account",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              actualOriginUrl:
                "https://github.com/emanuelrendas/raioc-os.git",
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
      "rejects the same repo name under a different owner",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              actualOriginUrl:
                "https://github.com/someoneelse/raioc-obsidian-vault2.git",
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
                "https://github.com/emanuelrendas/raioc-obsidian-vault2-sub.git",
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
      "allows legitimate ambient RAIOC environment namespaces",
      () => {
        expect(
          evaluateIsolation(
            request(),
            snapshot({
              environmentKeys: [
                "PATH",
                "RAIOC_GITHUB_TOKEN",
                "RAIOC_PROGRESS_SECRET",
                "RAIOC_SUPABASE_SERVICE_ROLE_KEY",
                "AI_SHOWROOM_VAULT_PATH",
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

    it(
      "still requires an explicitly required AI_SHOWROOM credential",
      () => {
        expect(
          evaluateIsolation(
            request({
              requiredEnvironmentKeys: [
                "AI_SHOWROOM_VAULT_TOKEN",
              ],
            }),
            snapshot({
              environmentKeys: [
                "PATH",
                "RAIOC_GITHUB_TOKEN",
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
  },
);