import {
  execFile,
} from "node:child_process";

import {
  mkdtemp,
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
  promisify,
} from "node:util";

import { describe, expect, it, vi } from "vitest";

import {
  runApplicationPreflight,
  type ApplicationPreflightGitAdapter,
  type ApplicationPreflightRequest,
} from "../../tools/obsidian-sync/application-preflight";

import {
  GitCliAdapter,
} from "../../tools/obsidian-sync/git-cli-adapter";

const execFileAsync = promisify(execFile);

const EXPECTED_SHA = "279dd001c971f93036bac472b10669033311e24c";
const EXPECTED_OWNER = "emanuelrendas";
const EXPECTED_REPO = "ai-showroom";
const REPO_PATH = "/home/tiago/ai-showroom";

function baseRequest(
  overrides: Partial<ApplicationPreflightRequest> = {},
): ApplicationPreflightRequest {
  return {
    expectedApplicationSha: EXPECTED_SHA,
    repoPath: REPO_PATH,
    expectedOwner: EXPECTED_OWNER,
    expectedRepo: EXPECTED_REPO,
    ...overrides,
  };
}

function createAdapter(
  overrides: Partial<ApplicationPreflightGitAdapter> = {},
): ApplicationPreflightGitAdapter & {
  isClean: ReturnType<typeof vi.fn>;
  getCurrentHead: ReturnType<typeof vi.fn>;
  getRemoteUrl: ReturnType<typeof vi.fn>;
} {
  return {
    isClean: vi.fn(async () => true),
    getCurrentHead: vi.fn(async () => EXPECTED_SHA),
    getRemoteUrl: vi.fn(
      async () => `https://github.com/${EXPECTED_OWNER}/${EXPECTED_REPO}.git`,
    ),
    ...overrides,
  } as ApplicationPreflightGitAdapter & {
    isClean: ReturnType<typeof vi.fn>;
    getCurrentHead: ReturnType<typeof vi.fn>;
    getRemoteUrl: ReturnType<typeof vi.fn>;
  };
}

describe("FIND-AS-001 Live Application Preflight", () => {
  it("fails closed when no expected application SHA is supplied", async () => {
    const adapter = createAdapter();

    const result = await runApplicationPreflight(
      baseRequest({ expectedApplicationSha: undefined }),
      adapter,
    );

    expect(result).toEqual({
      ok: false,
      code: "APPLICATION_PREFLIGHT_SHA_MISSING",
    });

    expect(adapter.getRemoteUrl).not.toHaveBeenCalled();
    expect(adapter.isClean).not.toHaveBeenCalled();
    expect(adapter.getCurrentHead).not.toHaveBeenCalled();
  });

  it("fails closed when the expected application SHA is not a full 40-character hex SHA", async () => {
    const adapter = createAdapter();

    const result = await runApplicationPreflight(
      baseRequest({ expectedApplicationSha: "279dd00" }),
      adapter,
    );

    expect(result).toEqual({
      ok: false,
      code: "APPLICATION_PREFLIGHT_SHA_MALFORMED",
    });

    expect(adapter.getRemoteUrl).not.toHaveBeenCalled();
    expect(adapter.isClean).not.toHaveBeenCalled();
    expect(adapter.getCurrentHead).not.toHaveBeenCalled();
  });

  it("fails closed when the expected application SHA contains non-hex characters", async () => {
    const adapter = createAdapter();

    const result = await runApplicationPreflight(
      baseRequest({
        expectedApplicationSha:
          "zzzzz01c971f93036bac472b10669033311e24c",
      }),
      adapter,
    );

    expect(result).toEqual({
      ok: false,
      code: "APPLICATION_PREFLIGHT_SHA_MALFORMED",
    });
  });

  it("fails closed when the origin remote does not identify emanuelrendas/ai-showroom", async () => {
    const adapter = createAdapter({
      getRemoteUrl: vi.fn(
        async () => "https://github.com/someone-else/ai-showroom.git",
      ),
    });

    const result = await runApplicationPreflight(baseRequest(), adapter);

    expect(result).toEqual({
      ok: false,
      code: "APPLICATION_PREFLIGHT_REPOSITORY_MISMATCH",
    });

    expect(adapter.isClean).not.toHaveBeenCalled();
    expect(adapter.getCurrentHead).not.toHaveBeenCalled();
  });

  it("fails closed when the application worktree is dirty", async () => {
    const adapter = createAdapter({
      isClean: vi.fn(async () => false),
    });

    const result = await runApplicationPreflight(baseRequest(), adapter);

    expect(result).toEqual({
      ok: false,
      code: "APPLICATION_PREFLIGHT_WORKTREE_DIRTY",
    });

    expect(adapter.getCurrentHead).not.toHaveBeenCalled();
  });

  it("fails closed when the actual checkout HEAD does not exactly equal the authorized expected SHA", async () => {
    const adapter = createAdapter({
      getCurrentHead: vi.fn(
        async () => "1111111111111111111111111111111111111111",
      ),
    });

    const result = await runApplicationPreflight(baseRequest(), adapter);

    expect(result).toEqual({
      ok: false,
      code: "APPLICATION_PREFLIGHT_HEAD_MISMATCH",
    });
  });

  it("verifies and returns the verified application SHA as evidence on an exact match", async () => {
    const adapter = createAdapter();

    const result = await runApplicationPreflight(baseRequest(), adapter);

    expect(result).toEqual({
      ok: true,
      code: "APPLICATION_PREFLIGHT_VERIFIED",
      verifiedApplicationSha: EXPECTED_SHA,
    });

    expect(adapter.getRemoteUrl).toHaveBeenCalledWith(REPO_PATH);
    expect(adapter.isClean).toHaveBeenCalledWith(REPO_PATH);

    // FIND-AS-001 independent review, blocker 1: the preflight must ask
    // for the ACTUAL checkout HEAD, repoPath only, never a named branch.
    // There is no branch parameter to pass here any more, by design.
    expect(adapter.getCurrentHead).toHaveBeenCalledWith(REPO_PATH);
  });

  it("accepts a git@github.com SSH-form origin remote for the same repository identity", async () => {
    const adapter = createAdapter({
      getRemoteUrl: vi.fn(
        async () => `git@github.com:${EXPECTED_OWNER}/${EXPECTED_REPO}.git`,
      ),
    });

    const result = await runApplicationPreflight(baseRequest(), adapter);

    expect(result).toEqual({
      ok: true,
      code: "APPLICATION_PREFLIGHT_VERIFIED",
      verifiedApplicationSha: EXPECTED_SHA,
    });
  });
});

// FIND-AS-001 independent review, blocker 1: an earlier version of this
// preflight asked GitCliAdapter for `getLocalHead(repoPath, branch)`,
// which resolves `refs/heads/<branch>` — the tip of a named branch ref.
// That is NOT necessarily the commit actually checked out: a worktree
// can be on a detached HEAD, on an older commit than its branch's tip,
// or simply on a different ref than `branch` names, while the branch
// ref itself still resolves to some other, unrelated commit. This suite
// proves, against a REAL git repository (no mocks), that
// `getCurrentHead` and `getLocalHead` are genuinely different
// operations and must not be conflated.
describe(
  "GitCliAdapter.getCurrentHead vs getLocalHead (real repository, FIND-AS-001 blocker 1)",
  () => {
    async function git(
      repoPath: string,
      args: readonly string[],
    ): Promise<string> {
      const { stdout } = await execFileAsync(
        "git",
        [...args],
        { cwd: repoPath },
      );

      return stdout.trim();
    }

    async function makeRepoWithDivergedCheckout(): Promise<{
      repoPath: string;
      branchTipSha: string;
      checkedOutSha: string;
      cleanup: () => Promise<void>;
    }> {
      const repoPath = await mkdtemp(
        join(tmpdir(), "find-as-001-blocker1-"),
      );

      await git(repoPath, ["init", "--initial-branch=main"]);
      await git(repoPath, ["config", "user.name", "Test"]);
      await git(
        repoPath,
        ["config", "user.email", "test@example.com"],
      );
      await git(repoPath, ["config", "commit.gpgSign", "false"]);

      await writeFile(
        join(repoPath, "file.txt"),
        "first\n",
        "utf8",
      );

      await git(repoPath, ["add", "--", "file.txt"]);
      await git(repoPath, ["commit", "-m", "first"]);

      const checkedOutSha = await git(
        repoPath,
        ["rev-parse", "HEAD"],
      );

      // Advance the branch ref past the commit we are about to check
      // out, so `refs/heads/main` (the branch ref) and the actual
      // checkout diverge.
      await writeFile(
        join(repoPath, "file.txt"),
        "second\n",
        "utf8",
      );

      await git(repoPath, ["add", "--", "file.txt"]);
      await git(repoPath, ["commit", "-m", "second"]);

      const branchTipSha = await git(
        repoPath,
        ["rev-parse", "HEAD"],
      );

      expect(branchTipSha).not.toBe(checkedOutSha);

      // Detach HEAD onto the earlier commit. `refs/heads/main` still
      // points at branchTipSha; the actual checkout is checkedOutSha.
      await git(repoPath, ["checkout", "--detach", checkedOutSha]);

      return {
        repoPath,
        branchTipSha,
        checkedOutSha,
        cleanup: async () => {
          await rm(repoPath, { recursive: true, force: true });
        },
      };
    }

    it(
      "getLocalHead(repoPath, branch) returns the branch tip, NOT the actual checked-out commit, once they diverge",
      async () => {
        const {
          repoPath,
          branchTipSha,
          checkedOutSha,
          cleanup,
        } = await makeRepoWithDivergedCheckout();

        try {
          const adapter = new GitCliAdapter();

          const localHead = await adapter.getLocalHead(
            repoPath,
            "main",
          );

          expect(localHead).toBe(branchTipSha);
          expect(localHead).not.toBe(checkedOutSha);
        } finally {
          await cleanup();
        }
      },
    );

    it(
      "getCurrentHead(repoPath) returns the actual checked-out commit, NOT the branch tip, once they diverge",
      async () => {
        const {
          repoPath,
          branchTipSha,
          checkedOutSha,
          cleanup,
        } = await makeRepoWithDivergedCheckout();

        try {
          const adapter = new GitCliAdapter();

          const currentHead = await adapter.getCurrentHead(
            repoPath,
          );

          expect(currentHead).toBe(checkedOutSha);
          expect(currentHead).not.toBe(branchTipSha);
        } finally {
          await cleanup();
        }
      },
    );

    it(
      "runApplicationPreflight holds with APPLICATION_PREFLIGHT_HEAD_MISMATCH when authorized against the branch tip while the actual checkout is an older commit (authorized SHA = branch ref tip, actual checkout HEAD = an earlier commit)",
      async () => {
        const {
          repoPath,
          branchTipSha,
          checkedOutSha,
          cleanup,
        } = await makeRepoWithDivergedCheckout();

        try {
          const adapter = new GitCliAdapter();

          // Authority mistakenly (or maliciously) authorizes the
          // branch tip, believing it to be what is checked out. The
          // actual checkout is the earlier commit. This must fail
          // closed, not pass because "the branch ref matches".
          const result = await runApplicationPreflight(
            {
              expectedApplicationSha: branchTipSha,
              repoPath,
              expectedOwner: EXPECTED_OWNER,
              expectedRepo: EXPECTED_REPO,
            },
            {
              isClean: async () => true,
              getCurrentHead: (path) =>
                adapter.getCurrentHead(path),
              getRemoteUrl: async () =>
                `https://github.com/${EXPECTED_OWNER}/${EXPECTED_REPO}.git`,
            },
          );

          expect(result).toEqual({
            ok: false,
            code: "APPLICATION_PREFLIGHT_HEAD_MISMATCH",
          });

          expect(branchTipSha).not.toBe(checkedOutSha);
        } finally {
          await cleanup();
        }
      },
    );

    it(
      "runApplicationPreflight verifies successfully when the authorized SHA exactly equals the actual checkout HEAD",
      async () => {
        const {
          repoPath,
          checkedOutSha,
          cleanup,
        } = await makeRepoWithDivergedCheckout();

        try {
          const adapter = new GitCliAdapter();

          const result = await runApplicationPreflight(
            {
              expectedApplicationSha: checkedOutSha,
              repoPath,
              expectedOwner: EXPECTED_OWNER,
              expectedRepo: EXPECTED_REPO,
            },
            {
              isClean: async () => true,
              getCurrentHead: (path) =>
                adapter.getCurrentHead(path),
              getRemoteUrl: async () =>
                `https://github.com/${EXPECTED_OWNER}/${EXPECTED_REPO}.git`,
            },
          );

          expect(result).toEqual({
            ok: true,
            code: "APPLICATION_PREFLIGHT_VERIFIED",
            verifiedApplicationSha: checkedOutSha,
          });
        } finally {
          await cleanup();
        }
      },
    );
  },
);
