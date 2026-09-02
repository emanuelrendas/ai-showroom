import {
  describe,
  expect,
  it,
} from "vitest";

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

import type {
  LocalPullAdapter,
} from "@/tools/obsidian-sync/local-pull-adapter";

import type {
  LocalGitOperationState,
  LocalPullRequest,
} from "@/tools/obsidian-sync/local-pull-types";

const LOCAL =
  "1111111111111111111111111111111111111111";

const REMOTE =
  "2222222222222222222222222222222222222222";

const OTHER =
  "3333333333333333333333333333333333333333";

const REPO =
  "/fake/ai-showroom-vault";

function request(
  overrides:
    Partial<LocalPullRequest> = {},
): LocalPullRequest {
  return {
    project:
      "ai-showroom",

    repoPath:
      REPO,

    targetBranch:
      "main",

    isolation: {
      approvedVaultRoot:
        REPO,

      forbiddenRaiocRoots: [
        "/fake/raioc",
      ],

      approvedRemote:
        "https://github.com/tiago/ai-showroom-vault.git",

      requiredEnvironmentKeys:
        [],
    },

    ...overrides,
  };
}

const isolationPass:
  Extract<
    IsolationDecision,
    { ok: true }
  > = {
  ok: true,
  code:
    "ISOLATION_VERIFIED",

  vaultRoot:
    REPO,

  repoRoot:
    REPO,

  remote: {
    host:
      "github.com",

    owner:
      "tiago",

    repo:
      "ai-showroom-vault",
  },
};

class UnusedIsolationAdapter
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

class FakePullAdapter
  implements LocalPullAdapter {
  calls: string[] = [];

  currentBranch:
    string | null =
      "main";

  operation:
    LocalGitOperationState =
      "none";

  cleanResults:
    boolean[] = [
      true,
      true,
      true,
    ];

  headResults:
    string[] = [
      LOCAL,
      LOCAL,
      REMOTE,
    ];

  fetchedSha =
    REMOTE;

  localIsAncestor =
    true;

  remoteIsAncestor =
    false;

  fetchShouldFail =
    false;

  fastForwardShouldFail =
    false;

  fetchCalls = 0;

  fastForwardCalls = 0;

  private cleanIndex =
    0;

  private headIndex =
    0;

  async isClean():
    Promise<boolean> {
    this.calls.push(
      "isClean",
    );

    const index =
      Math.min(
        this.cleanIndex,
        this.cleanResults.length - 1,
      );

    this.cleanIndex += 1;

    return (
      this.cleanResults[index] ??
      true
    );
  }

  async getCurrentBranch():
    Promise<string | null> {
    this.calls.push(
      "getCurrentBranch",
    );

    return this.currentBranch;
  }

  async getOperationState():
    Promise<LocalGitOperationState> {
    this.calls.push(
      "getOperationState",
    );

    return this.operation;
  }

  async getHead():
    Promise<string> {
    this.calls.push(
      "getHead",
    );

    const index =
      Math.min(
        this.headIndex,
        this.headResults.length - 1,
      );

    this.headIndex += 1;

    return (
      this.headResults[index] ??
      LOCAL
    );
  }

  async fetchBranch():
    Promise<string> {
    this.calls.push(
      "fetchBranch",
    );

    this.fetchCalls += 1;

    if (
      this.fetchShouldFail
    ) {
      throw new Error(
        "fetch failed",
      );
    }

    return this.fetchedSha;
  }

  async isAncestor(
    _repoPath: string,
    ancestor: string,
    descendant: string,
  ): Promise<boolean> {
    this.calls.push(
      `isAncestor:${ancestor}:${descendant}`,
    );

    if (
      ancestor === LOCAL &&
      descendant === REMOTE
    ) {
      return this.localIsAncestor;
    }

    return this.remoteIsAncestor;
  }

  async fastForward():
    Promise<void> {
    this.calls.push(
      "fastForward",
    );

    this.fastForwardCalls += 1;

    if (
      this.fastForwardShouldFail
    ) {
      throw new Error(
        "ff failed",
      );
    }
  }
}

function dependencies(
  adapter:
    FakePullAdapter,
  isolation:
    IsolationDecision =
      isolationPass,
) {
  return {
    isolationAdapter:
      new UnusedIsolationAdapter(),

    pullAdapter:
      adapter,

    verifyGateD:
      async () =>
        isolation,
  };
}

describe(
  "Gate F — Gate D ordering",
  () => {
    it(
      "stops before local Git or fetch when Gate D rejects isolation",
      async () => {
        const adapter =
          new FakePullAdapter();

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
              {
                ok: false,
                code:
                  "REMOTE_IDENTITY_MISMATCH",
              },
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "ISOLATION_REJECTED",
            isolationCode:
              "REMOTE_IDENTITY_MISMATCH",
          });

        expect(
          adapter.calls,
        ).toEqual([]);

        expect(
          adapter.fetchCalls,
        ).toBe(0);
      },
    );
  },
);

describe(
  "Gate F — local preflight",
  () => {
    it(
      "rejects the wrong local branch before fetch",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.currentBranch =
          "feature/test";

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_BRANCH_MISMATCH",
          });

        expect(
          adapter.fetchCalls,
        ).toBe(0);
      },
    );

    it(
      "rejects detached HEAD before fetch",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.currentBranch =
          null;

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_BRANCH_MISMATCH",
          });

        expect(
          adapter.fetchCalls,
        ).toBe(0);
      },
    );

    it.each([
      "merge",
      "rebase",
      "cherry-pick",
      "revert",
    ] as const)(
      "rejects Git operation in progress: %s",
      async (
        operation,
      ) => {
        const adapter =
          new FakePullAdapter();

        adapter.operation =
          operation;

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_OPERATION_IN_PROGRESS",
          });

        expect(
          adapter.fetchCalls,
        ).toBe(0);
      },
    );

    it(
      "rejects a dirty local working tree before fetch",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.cleanResults = [
          false,
        ];

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_WORKTREE_DIRTY",
          });

        expect(
          adapter.fetchCalls,
        ).toBe(0);
      },
    );

    it(
      "rejects an invalid local SHA",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.headResults = [
          "short-sha",
        ];

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_HEAD_INVALID",
          });

        expect(
          adapter.fetchCalls,
        ).toBe(0);
      },
    );
  },
);

describe(
  "Gate F — fetch and second preflight",
  () => {
    it(
      "returns FETCH_FAILED without attempting fast-forward",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.fetchShouldFail =
          true;

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "FETCH_FAILED",
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(0);
      },
    );

    it(
      "rejects malformed fetched SHA",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.fetchedSha =
          "bad";

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "FETCHED_HEAD_INVALID",
          });
      },
    );

    it(
      "rejects local HEAD changing during fetch",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.headResults = [
          LOCAL,
          OTHER,
        ];

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_HEAD_CHANGED",
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(0);
      },
    );

    it(
      "rejects local files becoming dirty during fetch",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.cleanResults = [
          true,
          false,
        ];

        adapter.headResults = [
          LOCAL,
          LOCAL,
        ];

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_WORKTREE_DIRTY_AFTER_FETCH",
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(0);
      },
    );
  },
);

describe(
  "Gate F — history classification",
  () => {
    it(
      "returns UP_TO_DATE without running merge when both SHAs match",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.fetchedSha =
          LOCAL;

        adapter.headResults = [
          LOCAL,
          LOCAL,
        ];

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toMatchObject({
            ok: true,
            code:
              "UP_TO_DATE",
            localSha:
              LOCAL,
            remoteSha:
              LOCAL,
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(0);
      },
    );

    it(
      "rejects local history ahead of remote",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.localIsAncestor =
          false;

        adapter.remoteIsAncestor =
          true;

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "LOCAL_AHEAD_OF_REMOTE",
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(0);
      },
    );

    it(
      "rejects diverged history",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.localIsAncestor =
          false;

        adapter.remoteIsAncestor =
          false;

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "HISTORY_DIVERGED",
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(0);
      },
    );
  },
);

describe(
  "Gate F — fast-forward and post-verification",
  () => {
    it(
      "fast-forwards only a valid remote-ahead history",
      async () => {
        const adapter =
          new FakePullAdapter();

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toMatchObject({
            ok: true,
            code:
              "FAST_FORWARDED",
            fromSha:
              LOCAL,
            toSha:
              REMOTE,
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(1);
      },
    );

    it(
      "surfaces fast-forward command failure without recovery",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.fastForwardShouldFail =
          true;

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "FAST_FORWARD_FAILED",
          });

        expect(
          adapter.fastForwardCalls,
        ).toBe(1);
      },
    );

    it(
      "rejects unexpected HEAD after fast-forward",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.headResults = [
          LOCAL,
          LOCAL,
          OTHER,
        ];

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "POST_PULL_HEAD_MISMATCH",
          });
      },
    );

    it(
      "rejects a dirty worktree after fast-forward",
      async () => {
        const adapter =
          new FakePullAdapter();

        adapter.cleanResults = [
          true,
          true,
          false,
        ];

        const result =
          await executeLocalObsidianPull(
            request(),
            dependencies(
              adapter,
            ),
          );

        expect(result)
          .toEqual({
            ok: false,
            code:
              "POST_PULL_WORKTREE_DIRTY",
          });
      },
    );
  },
);