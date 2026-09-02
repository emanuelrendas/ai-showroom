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

  const showroom =
    join(
      root,
      "ai-showroom-vault",
    );

  const raioc =
    join(
      root,
      "raioc-vault",
    );

  await mkdir(
    showroom,
    {
      recursive: true,
    },
  );

  await mkdir(
    raioc,
    {
      recursive: true,
    },
  );

  await git(
    showroom,
    [
      "init",
      "--initial-branch=main",
    ],
  );

  return {
    root,
    showroom,
    raioc,
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
      "resolves physical repository and project roots locally",
      async () => {
        const {
          showroom,
          raioc,
        } =
          await fixture();

        const adapter =
          new NodeIsolationAdapter();

        expect(
          await adapter.realpath(
            showroom,
          ),
        ).toBeTruthy();

        expect(
          await adapter.realpath(
            raioc,
          ),
        ).toBeTruthy();
      },
    );

    it(
      "uses the nearest existing physical parent for a new target",
      async () => {
        const {
          showroom,
        } =
          await fixture();

        const parent =
          join(
            showroom,
            "03 - TASKS",
            "ACTIVE",
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
              showroom,
              "03 - TASKS/ACTIVE/new-task.md",
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
          showroom,
          raioc,
        } =
          await fixture();

        const escape =
          join(
            showroom,
            "escape",
          );

        const type =
          process.platform ===
          "win32"
            ? "junction"
            : "dir";

        try {
          await symlink(
            raioc,
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
              showroom,
              "escape/new-secret.md",
            );

        expect(anchor)
          .toBe(
            await adapter.realpath(
              raioc,
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
      "reads origin URL entirely from local Git configuration",
      async () => {
        const {
          showroom,
        } =
          await fixture();

        const adapter =
          new NodeIsolationAdapter();

        const remote =
          "https://github.com/example/ai-showroom-vault.git";

        await git(
          showroom,
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
              showroom,
            ),
        ).toBe(
          remote,
        );
      },
    );

    it(
      "reads a RAIOC remote identity without contacting it",
      async () => {
        const {
          showroom,
        } =
          await fixture();

        const adapter =
          new NodeIsolationAdapter();

        const remote =
          "https://github.com/example/raioc-obsidian-vault2.git";

        await git(
          showroom,
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
              showroom,
            ),
        ).toBe(
          remote,
        );
      },
    );

    it(
      "returns null when origin is not configured",
      async () => {
        const {
          showroom,
        } =
          await fixture();

        const adapter =
          new NodeIsolationAdapter();

        expect(
          await adapter
            .getOriginUrl(
              showroom,
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