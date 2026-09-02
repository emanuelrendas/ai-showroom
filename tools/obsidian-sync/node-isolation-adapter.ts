import {
  execFile,
} from "node:child_process";

import {
  lstat,
  realpath as fsRealpath,
} from "node:fs/promises";

import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";

import type {
  IsolationAdapter,
} from "./isolation-adapter";

import type {
  PathComparisonMode,
} from "./isolation-types";

function gitRemoteOrigin(
  cwd: string,
): Promise<string | null> {
  return new Promise(
    (
      resolvePromise,
      reject,
    ) => {
      execFile(
        "git",
        [
          "remote",
          "get-url",
          "origin",
        ],
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
            resolvePromise(null);
            return;
          }

          resolvePromise(
            stdout.trim() || null,
          );
        },
      ).once(
        "error",
        reject,
      );
    },
  );
}

function ensureLexicallyInside(
  root: string,
  candidate: string,
): void {
  const rel =
    relative(
      root,
      candidate,
    );

  if (
    rel === ".." ||
    rel.startsWith(
      `..${process.platform === "win32" ? "\\" : "/"}`,
    ) ||
    isAbsolute(rel)
  ) {
    throw new Error(
      "Target escapes repository root",
    );
  }
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

export class NodeIsolationAdapter
  implements IsolationAdapter {
  async realpath(
    path: string,
  ): Promise<string> {
    return fsRealpath(path);
  }

  async resolveTargetPhysicalAnchor(
    repoPath: string,
    target: string,
  ): Promise<string> {
    const lexicalRoot =
      resolve(repoPath);

    const normalizedTarget =
      target.replaceAll(
        "\\",
        "/",
      );

    if (
      !normalizedTarget ||
      normalizedTarget.startsWith(
        "/",
      ) ||
      /^[A-Za-z]:\//.test(
        normalizedTarget,
      )
    ) {
      throw new Error(
        "Target is not vault-relative",
      );
    }

    const segments =
      normalizedTarget.split(
        "/",
      );

    if (
      segments.some(
        (segment) =>
          segment === "" ||
          segment === "." ||
          segment === "..",
      )
    ) {
      throw new Error(
        "Unsafe target segments",
      );
    }

    const candidate =
      resolve(
        lexicalRoot,
        ...segments,
      );

    ensureLexicallyInside(
      lexicalRoot,
      candidate,
    );

    let probe =
      candidate;

    while (true) {
      if (
        await exists(probe)
      ) {
        return fsRealpath(
          probe,
        );
      }

      const parent =
        dirname(probe);

      if (parent === probe) {
        throw new Error(
          "No existing physical anchor",
        );
      }

      probe = parent;
    }
  }

  async getOriginUrl(
    repoPath: string,
  ): Promise<string | null> {
    return gitRemoteOrigin(
      repoPath,
    );
  }

  listEnvironmentKeys():
    readonly string[] {
    return Object.keys(
      process.env,
    );
  }

  getPathComparisonMode():
    PathComparisonMode {
    return (
      process.platform ===
      "win32"
    )
      ? "case-insensitive"
      : "case-sensitive";
  }
}