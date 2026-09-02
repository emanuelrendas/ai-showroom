import {
  execFile,
} from "node:child_process";

import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
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
  GitCliPullAdapter,
} from "@/tools/obsidian-sync/git-cli-pull-adapter";

import {
  executeLocalObsidianPull,
} from "@/tools/obsidian-sync/local-pull";

import type {
  IsolationAdapter,
} from "@/tools/obsidian-sync/isolation-adapter";

import type {
  IsolationDecision,
  PathComparisonMode,
} from "@/tools/obsidian-sync/isolation-types";

const roots:
  string[] = [];

function git(
  cwd: string,
  args: readonly string[],
): Promise<string> {
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
          encoding: "utf8",
          windowsHide: true,
        },
        (
          error,
          stdout,
        ) => {
          if (error) {
            reject(error);

            return;
          }

          resolvePromise(
            stdout,
          );
        },
      );
    },
  );
}

async function commitAll(
  cwd: string,
  message: string,
): Promise<string> {
  await git(
    cwd,
    [
      "add",
      "--",
      ".",
    ],
  );

  await git(
    cwd,
    [
      "-c",
      "user.name=Offline Test",
      "-c",
      "user.email=offline@localhost",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "-m",
      message,
    ],
  );

  return (
    await git(
      cwd,
      [
        "rev-parse",
        "HEAD",
      ],
    )
  ).trim();
}

async function createFixture() {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "ai-showroom-gate-f-",
      ),
    );

  roots.push(root);

  const remote =
    join(
      root,
      "remote.git",
    );

  const writer =
    join(
      root,
      "writer",
    );

  const vault =
    join(
      root,
      "vault",
    );

  await git(
    root,
    [
      "init",
      "--bare",
      "--initial-branch=main",
      remote,
    ],
  );

  await git(
    root,
    [
      "clone",
      remote,
      writer,
    ],
  );

  await writeFile(
    join(
      writer,
      "note.md",
    ),
    "A\n",
    "utf8",
  );

  const baseSha =
    await commitAll(
      writer,
      "A",
    );

  await git(
    writer,
    [
      "push",
      "origin",
      "main",
    ],
  );

  await git(
    root,
    [
      "clone",
      remote,
      vault,
    ],
  );

  return {
    root,
    remote,
    writer,
    vault,
    baseSha,
  };
}

class NeverUsedIsolationAdapter
  implements IsolationAdapter {
  async realpath(
    path: string,
  ): Promise<string> {
    return path;
  }

  async resolveTargetPhysicalAnchor(
    repoPath: string,
  ): Promise<string> {
    return repoPath;
  }

  async getOriginUrl():
    Promise<string | null> {
    return null;
  }

  listEnvironmentKeys():
    readonly string[] {
    return [];
  }

  getPathComparisonMode():
    PathComparisonMode {
    return "case-sensitive";
  }
}

function isolationPass(
  repoPath: string,
): Extract<
  IsolationDecision,
  { ok: true }
> {
  return {
    ok: true,
    code:
      "ISOLATION_VERIFIED",

    vaultRoot:
      repoPath,

    repoRoot:
      repoPath,

    remote: {
      host:
        "github.com",

      owner:
        "offline-test",

      repo:
        "ai-showroom-vault",
    },
  };
}

function request(
  vault: string,
) {
  return {
    project:
      "ai-showroom",

    repoPath:
      vault,

    targetBranch:
      "main",

    isolation: {
      approvedVaultRoot:
        vault,

      forbiddenRaiocRoots:
        [] as readonly string[],

      approvedRemote:
        "https://github.com/offline-test/ai-showroom-vault.git",

      requiredEnvironmentKeys:
        [] as readonly string[],
    },
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
  "Gate F — offline real Git fast-forward",
  () => {
    it(
      "fast-forwards a clean local vault from a disposable local bare remote",
      async () => {
        const fixture =
          await createFixture();

        await writeFile(
          join(
            fixture.writer,
            "note.md",
          ),
          "B\n",
          "utf8",
        );

        const remoteSha =
          await commitAll(
            fixture.writer,
            "B",
          );

        await git(
          fixture.writer,
          [
            "push",
            "origin",
            "main",
          ],
        );

        const result =
          await executeLocalObsidianPull(
            request(
              fixture.vault,
            ),
            {
              isolationAdapter:
                new NeverUsedIsolationAdapter(),

              pullAdapter:
                new GitCliPullAdapter(),

              verifyGateD:
                async () =>
                  isolationPass(
                    fixture.vault,
                  ),
            },
          );

        expect(result)
          .toMatchObject({
            ok: true,
            code:
              "FAST_FORWARDED",
            fromSha:
              fixture.baseSha,
            toSha:
              remoteSha,
          });

        expect(
          (
            await git(
              fixture.vault,
              [
                "rev-parse",
                "HEAD",
              ],
            )
          ).trim(),
        ).toBe(
          remoteSha,
        );

        expect(
          await readFile(
            join(
              fixture.vault,
              "note.md",
            ),
            "utf8",
          ),
        ).toBe(
          "B\n",
        );
      },
    );
  },
);

describe(
  "Gate F — offline local edit protection",
  () => {
    it(
      "rejects a dirty local Obsidian file without clobbering it",
      async () => {
        const fixture =
          await createFixture();

        await writeFile(
          join(
            fixture.vault,
            "note.md",
          ),
          "LOCAL HUMAN EDIT\n",
          "utf8",
        );

        const result =
          await executeLocalObsidianPull(
            request(
              fixture.vault,
            ),
            {
              isolationAdapter:
                new NeverUsedIsolationAdapter(),

              pullAdapter:
                new GitCliPullAdapter(),

              verifyGateD:
                async () =>
                  isolationPass(
                    fixture.vault,
                  ),
            },
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_WORKTREE_DIRTY",
          });

        expect(
          await readFile(
            join(
              fixture.vault,
              "note.md",
            ),
            "utf8",
          ),
        ).toBe(
          "LOCAL HUMAN EDIT\n",
        );
      },
    );
  },
);

describe(
  "Gate F — offline local-ahead protection",
  () => {
    it(
      "rejects a local commit that is ahead of remote without resetting it",
      async () => {
        const fixture =
          await createFixture();

        await writeFile(
          join(
            fixture.vault,
            "local.md",
          ),
          "local\n",
          "utf8",
        );

        const localSha =
          await commitAll(
            fixture.vault,
            "local ahead",
          );

        const result =
          await executeLocalObsidianPull(
            request(
              fixture.vault,
            ),
            {
              isolationAdapter:
                new NeverUsedIsolationAdapter(),

              pullAdapter:
                new GitCliPullAdapter(),

              verifyGateD:
                async () =>
                  isolationPass(
                    fixture.vault,
                  ),
            },
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_AHEAD_OF_REMOTE",
          });

        expect(
          (
            await git(
              fixture.vault,
              [
                "rev-parse",
                "HEAD",
              ],
            )
          ).trim(),
        ).toBe(
          localSha,
        );
      },
    );
  },
);

describe(
  "Gate F — offline divergence protection",
  () => {
    it(
      "rejects diverged local and remote history without creating a merge commit",
      async () => {
        const fixture =
          await createFixture();

        await writeFile(
          join(
            fixture.vault,
            "local.md",
          ),
          "local\n",
          "utf8",
        );

        const localSha =
          await commitAll(
            fixture.vault,
            "local branch",
          );

        await writeFile(
          join(
            fixture.writer,
            "remote.md",
          ),
          "remote\n",
          "utf8",
        );

        await commitAll(
          fixture.writer,
          "remote branch",
        );

        await git(
          fixture.writer,
          [
            "push",
            "origin",
            "main",
          ],
        );

        const result =
          await executeLocalObsidianPull(
            request(
              fixture.vault,
            ),
            {
              isolationAdapter:
                new NeverUsedIsolationAdapter(),

              pullAdapter:
                new GitCliPullAdapter(),

              verifyGateD:
                async () =>
                  isolationPass(
                    fixture.vault,
                  ),
            },
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "HISTORY_DIVERGED",
          });

        expect(
          (
            await git(
              fixture.vault,
              [
                "rev-parse",
                "HEAD",
              ],
            )
          ).trim(),
        ).toBe(
          localSha,
        );

        const parents =
          (
            await git(
              fixture.vault,
              [
                "rev-list",
                "--parents",
                "-n",
                "1",
                "HEAD",
              ],
            )
          )
            .trim()
            .split(/\s+/);

        expect(
          parents.length,
        ).toBe(2);
      },
    );
  },
);