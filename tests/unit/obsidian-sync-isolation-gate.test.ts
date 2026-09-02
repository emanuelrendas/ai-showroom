import {
  describe,
  expect,
  it,
} from "vitest";

import {
  executeAfterIsolation,
  verifyIsolation,
} from "@/tools/obsidian-sync/isolation-gate";

import type {
  IsolationAdapter,
} from "@/tools/obsidian-sync/isolation-adapter";

import type {
  IsolationRequest,
  PathComparisonMode,
} from "@/tools/obsidian-sync/isolation-types";

const SHOWROOM =
  "/projects/ai-showroom-vault";

const RAIOC =
  "/projects/raioc-vault";

const TARGET =
  "03 - TASKS/ACTIVE/task.md";

const REMOTE =
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
      REMOTE,

    targets: [
      TARGET,
    ],

    requiredEnvironmentKeys:
      [],

    ...overrides,
  };
}

class FakeIsolationAdapter
  implements IsolationAdapter {
  calls: string[] = [];

  realpaths =
    new Map<string, string>([
      [
        SHOWROOM,
        SHOWROOM,
      ],
      [
        RAIOC,
        RAIOC,
      ],
    ]);

  targetAnchor =
    `${SHOWROOM}/03 - TASKS/ACTIVE`;

  origin:
    string | null =
      REMOTE;

  environmentKeys:
    readonly string[] = [
      "PATH",
      "AI_SHOWROOM_VAULT_PATH",
    ];

  mode:
    PathComparisonMode =
      "case-sensitive";

  async realpath(
    path: string,
  ): Promise<string> {
    this.calls.push(
      `realpath:${path}`,
    );

    const result =
      this.realpaths.get(
        path,
      );

    if (!result) {
      throw new Error(
        "realpath failed",
      );
    }

    return result;
  }

  async resolveTargetPhysicalAnchor(
    _repoPath: string,
    target: string,
  ): Promise<string> {
    this.calls.push(
      `target:${target}`,
    );

    return this.targetAnchor;
  }

  async getOriginUrl():
    Promise<string | null> {
    this.calls.push(
      "getOriginUrl",
    );

    return this.origin;
  }

  listEnvironmentKeys():
    readonly string[] {
    this.calls.push(
      "listEnvironmentKeys",
    );

    return this.environmentKeys;
  }

  getPathComparisonMode():
    PathComparisonMode {
    this.calls.push(
      "getPathComparisonMode",
    );

    return this.mode;
  }
}

describe(
  "Gate D inspection orchestration",
  () => {
    it(
      "passes a completely isolated Showroom configuration",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        const result =
          await verifyIsolation(
            request(),
            adapter,
          );

        expect(result)
          .toMatchObject({
            ok: true,
            code:
              "ISOLATION_VERIFIED",
          });
      },
    );

    it(
      "rejects lexical traversal before target physical resolution",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        const result =
          await verifyIsolation(
            request({
              targets: [
                "../raioc/secret.md",
              ],
            }),
            adapter,
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "TARGET_PATH_ESCAPE",
            path:
              "../raioc/secret.md",
          });

        expect(
          adapter.calls,
        ).toEqual([]);
      },
    );

    it(
      "categorizes approved vault realpath failure",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        adapter.realpaths
          .delete(
            SHOWROOM,
          );

        const result =
          await verifyIsolation(
            request(),
            adapter,
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "VAULT_REALPATH_FAILED",
            path:
              SHOWROOM,
          });
      },
    );

    it(
      "categorizes RAIOC root resolution failure",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        adapter.realpaths
          .delete(
            RAIOC,
          );

        const result =
          await verifyIsolation(
            request(),
            adapter,
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "RAIOC_REALPATH_FAILED",
            path:
              RAIOC,
          });
      },
    );

    it(
      "rejects a physical target escape",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        adapter.targetAnchor =
          `${RAIOC}/secret`;

        const result =
          await verifyIsolation(
            request(),
            adapter,
          );

        expect(result)
          .toMatchObject({
            ok: false,
            code:
              "TARGET_PATH_ESCAPE",
          });
      },
    );

    it(
      "rejects an inherited RAIOC environment key",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        adapter.environmentKeys = [
          "PATH",
          "AI_SHOWROOM_VAULT_TOKEN",
          "RAIOC_GITHUB_TOKEN",
        ];

        const result =
          await verifyIsolation(
            request(),
            adapter,
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "FORBIDDEN_CREDENTIAL_NAMESPACE",
            environmentKey:
              "RAIOC_GITHUB_TOKEN",
          });
      },
    );
  },
);

describe(
  "Gate D pre-side-effect guard",
  () => {
    it(
      "does not execute the protected action when isolation fails",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        adapter.origin =
          "https://github.com/tiago/raioc-obsidian-vault2.git";

        let executed =
          false;

        const result =
          await executeAfterIsolation(
            request(),
            adapter,
            async () => {
              executed = true;

              return "should-not-run";
            },
          );

        expect(executed)
          .toBe(false);

        expect(result)
          .toMatchObject({
            ok: false,
            code:
              "ISOLATION_REJECTED",
            isolation: {
              code:
                "REMOTE_IDENTITY_MISMATCH",
            },
          });
      },
    );

    it(
      "executes the protected action only after isolation passes",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        let executed =
          false;

        const result =
          await executeAfterIsolation(
            request(),
            adapter,
            async () => {
              executed = true;

              return "gate-c";
            },
          );

        expect(executed)
          .toBe(true);

        expect(result)
          .toMatchObject({
            ok: true,
            code:
              "ISOLATION_VERIFIED_AND_EXECUTED",
            result:
              "gate-c",
          });
      },
    );
  },
);