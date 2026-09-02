import {
  execFile,
} from "node:child_process";

import {
  mkdtemp,
  rm,
  stat,
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
  GitCliAdapter,
} from "@/tools/obsidian-sync/git-cli-adapter";

import {
  executeGitTransaction,
} from "@/tools/obsidian-sync/git-transaction";

import type {
  GitTransactionRequest,
} from "@/tools/obsidian-sync/types";

type Fixture = {
  root: string;
  remotePath: string;
  workerPath: string;
  baseSha: string;
};

const roots:
  string[] = [];

function git(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
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

          resolve(stdout);
        },
      );
    },
  );
}

async function commit(
  cwd: string,
  message: string,
): Promise<string> {
  await git(
    cwd,
    [
      "-c",
      "user.name=Offline Test",
      "-c",
      "user.email=offline-test@localhost",
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

async function createFixture():
  Promise<Fixture> {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "ai-showroom-gate-c-test-",
      ),
    );

  roots.push(root);

  const remotePath =
    join(
      root,
      "remote.git",
    );

  const workerPath =
    join(
      root,
      "worker",
    );

  await git(
    root,
    [
      "init",
      "--bare",
      "--initial-branch=main",
      remotePath,
    ],
  );

  await git(
    root,
    [
      "clone",
      remotePath,
      workerPath,
    ],
  );

  await writeFile(
    join(
      workerPath,
      "README.md",
    ),
    "base\n",
    "utf8",
  );

  await git(
    workerPath,
    [
      "add",
      "--",
      "README.md",
    ],
  );

  const baseSha =
    await commit(
      workerPath,
      "initial",
    );

  await git(
    workerPath,
    [
      "push",
      "origin",
      "main",
    ],
  );

  return {
    root,
    remotePath,
    workerPath,
    baseSha,
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
  "GitCliAdapter offline transaction",
  () => {
    it(
      "creates, commits and pushes an isolated local transaction",
      async () => {
        const fixture =
          await createFixture();

        const adapter =
          new GitCliAdapter();

        expect(
          await adapter.isClean(
            fixture.workerPath,
          ),
        ).toBe(true);

        expect(
          await adapter.getLocalHead(
            fixture.workerPath,
            "main",
          ),
        ).toBe(
          fixture.baseSha,
        );

        expect(
          await adapter.getRemoteHead(
            fixture.workerPath,
            "main",
          ),
        ).toBe(
          fixture.baseSha,
        );

        const transaction =
          await adapter
            .createTransactionWorktree(
              fixture.workerPath,
              fixture.baseSha,
            );

        try {
          await adapter.writeFile(
            transaction.path,
            "03 - TASKS/ACTIVE/test.md",
            "hello\n",
          );

          expect(
            await adapter.getChangedPaths(
              transaction.path,
            ),
          ).toEqual([
            "03 - TASKS/ACTIVE/test.md",
          ]);

          await adapter.stagePaths(
            transaction.path,
            [
              "03 - TASKS/ACTIVE/test.md",
            ],
          );

          const resultSha =
            await adapter.commit(
              transaction.path,
              "chore(obsidian): TASK-AS-0003 offline test",
            );

          expect(
            resultSha,
          ).toMatch(
            /^[0-9a-f]{40}$/,
          );

          expect(
            await adapter
              .getCommitParent(
                transaction.path,
                resultSha,
              ),
          ).toBe(
            fixture.baseSha,
          );

          await adapter.pushCommit(
            fixture.workerPath,
            resultSha,
            "main",
          );

          expect(
            await adapter.getRemoteHead(
              fixture.workerPath,
              "main",
            ),
          ).toBe(
            resultSha,
          );
        } finally {
          await adapter
            .removeTransactionWorktree(
              fixture.workerPath,
              transaction,
            );
        }

        await expect(
          stat(
            transaction.cleanupRoot,
          ),
        ).rejects.toThrow();
      },
    );

    it(
      "rejects a real non-fast-forward collision without force pushing",
      async () => {
        const fixture =
          await createFixture();

        const adapter =
          new GitCliAdapter();

        const transaction =
          await adapter
            .createTransactionWorktree(
              fixture.workerPath,
              fixture.baseSha,
            );

        try {
          await adapter.writeFile(
            transaction.path,
            "candidate.md",
            "candidate\n",
          );

          await adapter.stagePaths(
            transaction.path,
            [
              "candidate.md",
            ],
          );

          const candidateSha =
            await adapter.commit(
              transaction.path,
              "candidate",
            );

          const competitorPath =
            join(
              fixture.root,
              "competitor",
            );

          await git(
            fixture.root,
            [
              "clone",
              fixture.remotePath,
              competitorPath,
            ],
          );

          await writeFile(
            join(
              competitorPath,
              "competitor.md",
            ),
            "competitor\n",
            "utf8",
          );

          await git(
            competitorPath,
            [
              "add",
              "--",
              "competitor.md",
            ],
          );

          const competitorSha =
            await commit(
              competitorPath,
              "competitor",
            );

          await git(
            competitorPath,
            [
              "push",
              "origin",
              "main",
            ],
          );

          expect(
            await adapter.getRemoteHead(
              fixture.workerPath,
              "main",
            ),
          ).toBe(
            competitorSha,
          );

          await expect(
            adapter.pushCommit(
              fixture.workerPath,
              candidateSha,
              "main",
            ),
          ).rejects.toThrow();

          expect(
            await adapter.getRemoteHead(
              fixture.workerPath,
              "main",
            ),
          ).toBe(
            competitorSha,
          );
        } finally {
          await adapter
            .removeTransactionWorktree(
              fixture.workerPath,
              transaction,
            );
        }
      },
    );
  },
);

describe(
  "Gate C end-to-end offline orchestration",
  () => {
    it(
      "runs Gate A, Gate B and local SHA-CAS before publishing one commit",
      async () => {
        const fixture =
          await createFixture();

        const adapter =
          new GitCliAdapter();

        const target =
          "04 - AI WORKSPACE/SPARK/STATE-UPDATES/TASK-AS-0003.md";

        const event = `## State Update — 2026-09-02T18:30+04:00

Agent: Spark
Task: TASK-AS-0003
Previous Status: active
New Status: active
Reason: Gate C offline integration.
Evidence: e46bdd1af071610fc27a7a71767eb003e071c060`;

        const transaction:
          GitTransactionRequest = {
          project:
            "ai-showroom",

          task:
            "TASK-AS-0003",

          repoPath:
            fixture.workerPath,

          targetBranch:
            "main",

          expectedBaseSha:
            fixture.baseSha,

          commitMessage:
            "chore(obsidian): TASK-AS-0003 offline Gate C",

          changes: [
            {
              request: {
                project:
                  "ai-showroom",
                task:
                  "TASK-AS-0003",
                actor:
                  "spark",
                operation:
                  "append",
                mutationKind:
                  "append-state",
                target,
              },

              artifact: {
                exists: false,
                type: "task",
                status: "active",
                frozen: false,
                owner: "sol",
                activeWriter: null,
                writeLockTask: null,
              },

              taskScope: {
                project:
                  "ai-showroom",
                task:
                  "TASK-AS-0003",
                allowedTargetPrefixes: [
                  "04 - AI WORKSPACE/SPARK/",
                ],
              },

              currentContent:
                "",

              proposedContent:
                event,
            },
          ],
        };

        const result =
          await executeGitTransaction(
            transaction,
            adapter,
          );

        expect(result).toMatchObject({
          ok: true,
          code:
            "COMMITTED_AND_PUSHED",
          baseSha:
            fixture.baseSha,
          targetBranch:
            "main",
          changedPaths: [
            target,
          ],
        });

        if (!result.ok) {
          throw new Error(
            "Expected successful transaction",
          );
        }

        expect(
          await adapter.getRemoteHead(
            fixture.workerPath,
            "main",
          ),
        ).toBe(
          result.resultSha,
        );
      },
    );
  },
);