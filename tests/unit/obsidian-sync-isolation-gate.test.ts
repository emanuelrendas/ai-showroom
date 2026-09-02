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

const SHARED_VAULT =
  "/projects/raioc-v2";

const TARGET =
  "04 - AI WORKSPACE/SPARK/STATE-UPDATES/TASK-AS-0003.md";

const REMOTE =
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
        SHARED_VAULT,
        SHARED_VAULT,
      ],
    ]);

  targetAnchor =
    `${SHARED_VAULT}/04 - AI WORKSPACE/SPARK/STATE-UPDATES`;

  origin:
    string | null =
      REMOTE;

  environmentKeys:
    readonly string[] = [
      "PATH",
      "RAIOC_GITHUB_TOKEN",
      "RAIOC_PROGRESS_SECRET",
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
      "passes an isolated shared vault configuration",
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
                "../escape/secret.md",
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
              "../escape/secret.md",
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
            SHARED_VAULT,
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
              SHARED_VAULT,
          });
      },
    );

    it(
      "rejects a physical target escape",
      async () => {
        const adapter =
          new FakeIsolationAdapter();

        adapter.targetAnchor =
          "/some/other/folder";

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
          "https://github.com/emanuelrendas/raioc-os.git";

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

              return "action-executed";
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
              "action-executed",
          });
      },
    );
  },
);