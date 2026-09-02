import {
  execFile,
} from "node:child_process";

import {
  lstat,
} from "node:fs/promises";

import {
  isAbsolute,
  resolve,
} from "node:path";

import type {
  LocalPullAdapter,
} from "./local-pull-adapter";

import type {
  LocalGitOperationState,
} from "./local-pull-types";

type GitResult = {
  code: number;
  stdout: string;
};

class LocalPullGitError
  extends Error {
  constructor(
    command: string,
  ) {
    super(
      `Local pull Git command failed: ${command}`,
    );

    this.name =
      "LocalPullGitError";
  }
}

function runGitResult(
  cwd: string,
  args: readonly string[],
): Promise<GitResult> {
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
          if (!error) {
            resolvePromise({
              code: 0,
              stdout,
            });

            return;
          }

          if (
            typeof error.code ===
            "number"
          ) {
            resolvePromise({
              code:
                error.code,
              stdout:
                stdout ?? "",
            });

            return;
          }

          reject(
            new LocalPullGitError(
              args[0] ??
                "unknown",
            ),
          );
        },
      );
    },
  );
}

async function runGit(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const result =
    await runGitResult(
      cwd,
      args,
    );

  if (result.code !== 0) {
    throw new LocalPullGitError(
      args[0] ??
        "unknown",
    );
  }

  return result.stdout;
}

async function exists(
  path: string,
): Promise<boolean> {
  try {
    await lstat(path);

    return true;
  } catch (
    error: unknown
  ) {
    if (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

async function gitPath(
  repoPath: string,
  name: string,
): Promise<string> {
  const value =
    (
      await runGit(
        repoPath,
        [
          "rev-parse",
          "--git-path",
          name,
        ],
      )
    ).trim();

  return isAbsolute(value)
    ? value
    : resolve(
        repoPath,
        value,
      );
}

export class GitCliPullAdapter
  implements LocalPullAdapter {
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

    return output.length === 0;
  }

  async getCurrentBranch(
    repoPath: string,
  ): Promise<string | null> {
    const result =
      await runGitResult(
        repoPath,
        [
          "symbolic-ref",
          "--quiet",
          "--short",
          "HEAD",
        ],
      );

    if (result.code === 0) {
      return (
        result.stdout.trim() ||
        null
      );
    }

    if (result.code === 1) {
      return null;
    }

    throw new LocalPullGitError(
      "symbolic-ref",
    );
  }

  async getOperationState(
    repoPath: string,
  ): Promise<LocalGitOperationState> {
    const mergeHead =
      await gitPath(
        repoPath,
        "MERGE_HEAD",
      );

    if (
      await exists(
        mergeHead,
      )
    ) {
      return "merge";
    }

    const rebaseMerge =
      await gitPath(
        repoPath,
        "rebase-merge",
      );

    const rebaseApply =
      await gitPath(
        repoPath,
        "rebase-apply",
      );

    if (
      await exists(
        rebaseMerge,
      ) ||
      await exists(
        rebaseApply,
      )
    ) {
      return "rebase";
    }

    const cherryPick =
      await gitPath(
        repoPath,
        "CHERRY_PICK_HEAD",
      );

    if (
      await exists(
        cherryPick,
      )
    ) {
      return "cherry-pick";
    }

    const revertHead =
      await gitPath(
        repoPath,
        "REVERT_HEAD",
      );

    if (
      await exists(
        revertHead,
      )
    ) {
      return "revert";
    }

    return "none";
  }

  async getHead(
    repoPath: string,
  ): Promise<string> {
    return (
      await runGit(
        repoPath,
        [
          "rev-parse",
          "HEAD",
        ],
      )
    ).trim();
  }

  async fetchBranch(
    repoPath: string,
    branch: string,
  ): Promise<string> {
    await runGit(
      repoPath,
      [
        "fetch",
        "--no-tags",
        "origin",
        branch,
      ],
    );

    return (
      await runGit(
        repoPath,
        [
          "rev-parse",
          "FETCH_HEAD",
        ],
      )
    ).trim();
  }

  async isAncestor(
    repoPath: string,
    ancestor: string,
    descendant: string,
  ): Promise<boolean> {
    const result =
      await runGitResult(
        repoPath,
        [
          "merge-base",
          "--is-ancestor",
          ancestor,
          descendant,
        ],
      );

    if (result.code === 0) {
      return true;
    }

    if (result.code === 1) {
      return false;
    }

    throw new LocalPullGitError(
      "merge-base",
    );
  }

  async fastForward(
    repoPath: string,
    sha: string,
  ): Promise<void> {
    await runGit(
      repoPath,
      [
        "merge",
        "--ff-only",
        sha,
      ],
    );
  }
}