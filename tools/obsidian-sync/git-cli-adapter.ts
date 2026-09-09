import {
  execFile,
} from "node:child_process";

import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import type {
  GitAdapter,
  TransactionWorktree,
} from "./git-adapter";

class GitCliError
  extends Error {
  constructor(
    command: string,
  ) {
    super(
      `Git command failed: ${command}`,
    );

    this.name =
      "GitCliError";
  }
}

function runGit(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  return new Promise(
    (resolvePromise, reject) => {
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
            reject(
              new GitCliError(
                args[0] ??
                  "unknown",
              ),
            );

            return;
          }

          resolvePromise(stdout);
        },
      );
    },
  );
}

function normalizeGitPath(
  value: string,
): string {
  return value.replaceAll(
    "\\",
    "/",
  );
}

function splitNulList(
  value: string,
): string[] {
  return value
    .split("\0")
    .filter(
      (entry) =>
        entry.length > 0,
    )
    .map(
      normalizeGitPath,
    );
}

function resolveTargetPath(
  worktreePath: string,
  target: string,
): string {
  const root =
    resolve(worktreePath);

  const destination =
    resolve(
      root,
      ...target.split("/"),
    );

  const relativePath =
    relative(
      root,
      destination,
    );

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(
      `..${process.platform === "win32" ? "\\" : "/"}`,
    ) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(
      "Target escapes transaction worktree",
    );
  }

  return destination;
}

export class GitCliAdapter
  implements GitAdapter {
  async isClean(
    repoPath: string,
  ): Promise<boolean> {
    const output =
      await runGit(
        repoPath,
        [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ],
      );

    return (
      output.length === 0
    );
  }

  async getLocalHead(
    repoPath: string,
    branch: string,
  ): Promise<string> {
    const output =
      await runGit(
        repoPath,
        [
          "rev-parse",
          `refs/heads/${branch}`,
        ],
      );

    return output.trim();
  }

  // FIND-AS-001 (independent review, blocker 1): the actual checked-out
  // commit, as distinct from getLocalHead's branch-ref tip lookup above.
  // Extra method on this class, not part of the shared GitAdapter
  // interface — only ApplicationPreflightGitAdapter needs it.
  async getCurrentHead(
    repoPath: string,
  ): Promise<string> {
    const output =
      await runGit(
        repoPath,
        [
          "rev-parse",
          "HEAD",
        ],
      );

    return output.trim();
  }

  async getRemoteHead(
    repoPath: string,
    branch: string,
  ): Promise<string> {
    const output =
      await runGit(
        repoPath,
        [
          "ls-remote",
          "--heads",
          "origin",
          `refs/heads/${branch}`,
        ],
      );

    const firstLine =
      output
        .trim()
        .split("\n")[0];

    if (!firstLine) {
      throw new Error(
        "Remote branch head not found",
      );
    }

    const [
      sha,
    ] = firstLine.split(
      /\s+/,
    );

    if (!sha) {
      throw new Error(
        "Remote branch SHA not found",
      );
    }

    return sha;
  }

  async getRemoteUrl(
    repoPath: string,
  ): Promise<string> {
    const output =
      await runGit(
        repoPath,
        [
          "remote",
          "get-url",
          "origin",
        ],
      );

    return output.trim();
  }

  async createTransactionWorktree(
    repoPath: string,
    baseSha: string,
  ): Promise<TransactionWorktree> {
    const cleanupRoot =
      await mkdtemp(
        join(
          tmpdir(),
          "ai-showroom-obsidian-sync-",
        ),
      );

    const worktreePath =
      join(
        cleanupRoot,
        "worktree",
      );

    try {
      await runGit(
        repoPath,
        [
          "worktree",
          "add",
          "--detach",
          worktreePath,
          baseSha,
        ],
      );
    } catch (error) {
      await rm(
        cleanupRoot,
        {
          recursive: true,
          force: true,
        },
      );

      throw error;
    }

    return {
      path: worktreePath,
      cleanupRoot,
    };
  }

  async writeFile(
    worktreePath: string,
    target: string,
    content: string,
  ): Promise<void> {
    const destination =
      resolveTargetPath(
        worktreePath,
        target,
      );

    await mkdir(
      dirname(destination),
      {
        recursive: true,
      },
    );

    await writeFile(
      destination,
      content,
      "utf8",
    );
  }

  async getChangedPaths(
    worktreePath: string,
  ): Promise<readonly string[]> {
    const tracked =
      await runGit(
        worktreePath,
        [
          "diff",
          "--name-only",
          "-z",
          "HEAD",
          "--",
        ],
      );

    const untracked =
      await runGit(
        worktreePath,
        [
          "ls-files",
          "--others",
          "--exclude-standard",
          "-z",
        ],
      );

    return [
      ...new Set([
        ...splitNulList(
          tracked,
        ),
        ...splitNulList(
          untracked,
        ),
      ]),
    ].sort();
  }

  async stagePaths(
    worktreePath: string,
    paths: readonly string[],
  ): Promise<void> {
    await runGit(
      worktreePath,
      [
        "add",
        "--",
        ...paths,
      ],
    );
  }

  async commit(
    worktreePath: string,
    message: string,
  ): Promise<string> {
    await runGit(
      worktreePath,
      [
        "-c",
        "user.name=AI Showroom Sync",
        "-c",
        "user.email=ai-showroom-sync@localhost",
        "-c",
        "commit.gpgSign=false",
        "commit",
        "-m",
        message,
      ],
    );

    return (
      await runGit(
        worktreePath,
        [
          "rev-parse",
          "HEAD",
        ],
      )
    ).trim();
  }

  async getCommitParent(
    worktreePath: string,
    sha: string,
  ): Promise<string> {
    return (
      await runGit(
        worktreePath,
        [
          "rev-parse",
          `${sha}^`,
        ],
      )
    ).trim();
  }

  async pushCommit(
    repoPath: string,
    sha: string,
    branch: string,
  ): Promise<void> {
    await runGit(
      repoPath,
      [
        "push",
        "origin",
        `${sha}:refs/heads/${branch}`,
      ],
    );
  }

  async removeTransactionWorktree(
    repoPath: string,
    transaction: TransactionWorktree,
  ): Promise<void> {
    let cleanupFailure:
      unknown = null;

    try {
      await rm(
        transaction.cleanupRoot,
        {
          recursive: true,
          force: true,
        },
      );
    } catch (error) {
      cleanupFailure =
        error;
    }

    try {
      await runGit(
        repoPath,
        [
          "worktree",
          "prune",
        ],
      );
    } catch (error) {
      cleanupFailure ??=
        error;
    }

    if (cleanupFailure) {
      throw cleanupFailure;
    }
  }
}