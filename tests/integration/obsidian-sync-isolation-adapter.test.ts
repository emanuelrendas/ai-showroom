import {
  execFile,
} from "node:child_process";

import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  NodeIsolationAdapter,
} from "@/tools/obsidian-sync/node-isolation-adapter";

import {
  verifyIsolation,
} from "@/tools/obsidian-sync/isolation-gate";

const roots:
  string[] = [];

function git(
  cwd: string,
  args: readonly string[],
): Promise<void> {
  return new Promise(
    (
      resolvePromise,
      reject,
    ) => {
      execFile(
        "git",
        [...args],
        {
          cwd,
          windowsHide: true,
        },
        (
          error,
        ) => {
          if (error) {
            reject(error);
            return;
          }

          resolvePromise();
        },
      );
    },
  );
}

async function fixture() {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "ai-showroom-isolation-",
      ),
    );

  roots.push(root);

  const vault =
    join(
      root,
      "raioc-v2",
    );

  const outside =
    join(
      root,
      "outside-folder",
    );

  await mkdir(
    vault,
    {
      recursive: true,
    },
  );

  await mkdir(
    outside,
    {
      recursive: true,
    },
  );

  await git(
    vault,
    [
      "init",
      "--initial-branch=main",
    ],
  );

  return {
    root,
    vault,
    outside,
  };
}

afterEach(
  async () => {
    while (
      roots.length > 0
    ) {
      const root =
        roots.pop();

      if (!root) {
        continue;
      }

      await rm(
        root,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

describe(
  "NodeIsolationAdapter real filesystem inspection",
  () => {
    it(
      "resolves physical repository and vault roots locally",
      async () => {
        const {
          vault,
        } =
          await fixture();

        const adapter =
          new NodeIsolationAdapter();

        expect(
          await adapter.realpath(
            vault,
          ),
        ).toBeTruthy();
      },
    );

    it(
      "uses the nearest existing physical parent for a new target",
      async () => {
        const {
          vault,
        } =
          await fixture();

        const parent =
          join(
            vault,
            "04 - AI WORKSPACE",
            "SPARK",
            "STATE-UPDATES",
          );

        await mkdir(
          parent,
          {
            recursive: true,
          },
        );

        const adapter =
          new NodeIsolationAdapter();

        const anchor =
          await adapter
            .resolveTargetPhysicalAnchor(
              vault,
              "04 - AI WORKSPACE/SPARK/STATE-UPDATES/new-task.md",
            );

        expect(anchor)
          .toBe(
            await adapter.realpath(
              parent,
            ),
          );
      },
    );

    it(
      "physically follows a local symlink or junction escape",
      async () => {
        const {
          vault,
          outside,
        } =
          await fixture();

        const escape =
          join(
            vault,
            "escape",
          );

        const type =
          process.platform ===
          "win32"
            ? "junction"
            : "dir";

        try {
          await symlink(
            outside,
            escape,
            type,
          );
        } catch (
          error: unknown
        ) {
          const code =
            typeof error ===
              "object" &&
            error !== null &&
            "code" in error
              ? error.code
              : undefined;

          if (
            code === "EPERM" ||
            code === "EACCES"
          ) {
            return;
          }

          throw error;
        }

        const adapter =
          new NodeIsolationAdapter();

        const anchor =
          await adapter
            .resolveTargetPhysicalAnchor(
              vault,
              "escape/new-secret.md",
            );

        expect(anchor)
          .toBe(
            await adapter.realpath(
              outside,
            ),
          );
      },
    );
  },
);

describe(
  "NodeIsolationAdapter local Git remote inspection",
  () => {
    it(
      "reads approved origin URL entirely from local Git configuration",
      async () => {
        const {
          vault,
        } =
          await fixture();

        const adapter =
          new NodeIsolationAdapter();

        const remote =
          "https://github.com/emanuelrendas/raioc-obsidian-vault2.git";

        await git(
          vault,
          [
            "remote",
            "add",
            "origin",
            remote,
          ],
        );

        expect(
          await adapter
            .getOriginUrl(
              vault,
            ),
        ).toBe(
          remote,
        );
      },
    );

    it(
      "verifies complete isolation against approved remote identity",
      async () => {
        const {
          vault,
        } =
          await fixture();

        const approvedRemote =
          "https://github.com/emanuelrendas/raioc-obsidian-vault2.git";

        await git(
          vault,
          [
            "remote",
            "add",
            "origin",
            approvedRemote,
          ],
        );

        const result =
          await verifyIsolation(
            {
              project:
                "ai-showroom",

              repoPath:
                vault,

              approvedVaultRoot:
                vault,

              approvedRemote,

              targets: [],

              requiredEnvironmentKeys:
                [],
            },
            new NodeIsolationAdapter(),
          );

        expect(result)
          .toMatchObject({
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
      "returns null when origin is not configured",
      async () => {
        const {
          vault,
        } =
          await fixture();

        const adapter =
          new NodeIsolationAdapter();

        expect(
          await adapter
            .getOriginUrl(
              vault,
            ),
        ).toBeNull();
      },
    );
  },
);

describe(
  "NodeIsolationAdapter credential inspection",
  () => {
    it(
      "exposes environment names without requiring their values",
      () => {
        const adapter =
          new NodeIsolationAdapter();

        const keys =
          adapter
            .listEnvironmentKeys();

        expect(
          Array.isArray(keys),
        ).toBe(true);

        expect(
          keys.includes("PATH") ||
          keys.includes("Path"),
        ).toBe(true);
      },
    );
  },
);