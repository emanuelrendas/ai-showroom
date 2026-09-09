import { describe, expect, it, vi } from "vitest";

import {
  runApplicationPreflight,
  type ApplicationPreflightGitAdapter,
  type ApplicationPreflightRequest,
} from "../../tools/obsidian-sync/application-preflight";

const EXPECTED_SHA = "279dd001c971f93036bac472b10669033311e24c";
const EXPECTED_OWNER = "emanuelrendas";
const EXPECTED_REPO = "ai-showroom";
const REPO_PATH = "/home/tiago/ai-showroom";
const BRANCH = "feature/milestone-1-foundation";

function baseRequest(
  overrides: Partial<ApplicationPreflightRequest> = {},
): ApplicationPreflightRequest {
  return {
    expectedApplicationSha: EXPECTED_SHA,
    repoPath: REPO_PATH,
    branch: BRANCH,
    expectedOwner: EXPECTED_OWNER,
    expectedRepo: EXPECTED_REPO,
    ...overrides,
  };
}

function createAdapter(
  overrides: Partial<ApplicationPreflightGitAdapter> = {},
): ApplicationPreflightGitAdapter & {
  isClean: ReturnType<typeof vi.fn>;
  getLocalHead: ReturnType<typeof vi.fn>;
  getRemoteUrl: ReturnType<typeof vi.fn>;
} {
  return {
    isClean: vi.fn(async () => true),
    getLocalHead: vi.fn(async () => EXPECTED_SHA),
    getRemoteUrl: vi.fn(
      async () => `https://github.com/${EXPECTED_OWNER}/${EXPECTED_REPO}.git`,
    ),
    ...overrides,
  } as ApplicationPreflightGitAdapter & {
    isClean: ReturnType<typeof vi.fn>;
    getLocalHead: ReturnType<typeof vi.fn>;
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
    expect(adapter.getLocalHead).not.toHaveBeenCalled();
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
    expect(adapter.getLocalHead).not.toHaveBeenCalled();
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
    expect(adapter.getLocalHead).not.toHaveBeenCalled();
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

    expect(adapter.getLocalHead).not.toHaveBeenCalled();
  });

  it("fails closed when local HEAD does not exactly equal the authorized expected SHA", async () => {
    const adapter = createAdapter({
      getLocalHead: vi.fn(
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
    expect(adapter.getLocalHead).toHaveBeenCalledWith(REPO_PATH, BRANCH);
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
