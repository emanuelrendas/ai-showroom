// FIND-AS-001 — Live Application Preflight.
//
// Closes the gap where a Foundation review could certify against an
// "application SHA" that was only ever a static reference, never
// independently verified against the live ai-showroom checkout doing the
// certifying. This module performs that live verification.
//
// Fail-closed by construction: every branch that is not the exact,
// fully-verified success path returns `ok: false` with a deterministic
// failure code. Dependency-injected and read-only — it never writes to
// the repository it inspects.

export type ApplicationPreflightGitAdapter = {
  isClean: (repoPath: string) => Promise<boolean>;

  // FIND-AS-001 (independent review, blocker 1): must return the ACTUAL
  // checked-out commit (`git rev-parse HEAD`), not a branch ref tip. A
  // branch-ref lookup (`refs/heads/<branch>`) can silently diverge from
  // what is really checked out — e.g. a detached HEAD, or a worktree that
  // is behind its own branch tip — which would let this preflight verify
  // a commit that was never actually inspected.
  getCurrentHead: (repoPath: string) => Promise<string>;

  getRemoteUrl: (repoPath: string) => Promise<string>;
};

export type ApplicationPreflightRequest = {
  // The authorized application SHA this run is required to verify against.
  // Must be supplied explicitly by the caller — never derived from
  // whatever HEAD happens to be at runtime.
  expectedApplicationSha: string | null | undefined;

  repoPath: string;

  // Expected GitHub repository identity, e.g. "emanuelrendas" / "ai-showroom".
  expectedOwner: string;
  expectedRepo: string;
};

export type ApplicationPreflightFailureCode =
  | "APPLICATION_PREFLIGHT_SHA_MISSING"
  | "APPLICATION_PREFLIGHT_SHA_MALFORMED"
  | "APPLICATION_PREFLIGHT_REPOSITORY_MISMATCH"
  | "APPLICATION_PREFLIGHT_WORKTREE_DIRTY"
  | "APPLICATION_PREFLIGHT_HEAD_MISMATCH";

export type ApplicationPreflightResult =
  | {
      ok: true;
      code: "APPLICATION_PREFLIGHT_VERIFIED";
      verifiedApplicationSha: string;
    }
  | {
      ok: false;
      code: ApplicationPreflightFailureCode;
    };

// Full 40-character lowercase hex SHA-1, exactly as `git rev-parse` returns
// it. Anything else (short SHA, uppercase, non-hex characters, wrong
// length) is treated as malformed rather than normalized, so an ambiguous
// or truncated reference is never silently accepted.
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;

const OWNER_REPO_PATTERNS: readonly RegExp[] = [
  /^https:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
  /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
  /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i,
];

function parseGithubOwnerRepo(
  remoteUrl: string,
): { owner: string; repo: string } | null {
  const trimmed = remoteUrl.trim();

  for (const pattern of OWNER_REPO_PATTERNS) {
    const match = trimmed.match(pattern);

    if (match && match[1] && match[2]) {
      return { owner: match[1], repo: match[2] };
    }
  }

  return null;
}

export async function runApplicationPreflight(
  request: ApplicationPreflightRequest,
  gitAdapter: ApplicationPreflightGitAdapter,
): Promise<ApplicationPreflightResult> {
  if (!request.expectedApplicationSha) {
    return {
      ok: false,
      code: "APPLICATION_PREFLIGHT_SHA_MISSING",
    };
  }

  if (!FULL_SHA_PATTERN.test(request.expectedApplicationSha)) {
    return {
      ok: false,
      code: "APPLICATION_PREFLIGHT_SHA_MALFORMED",
    };
  }

  const remoteUrl = await gitAdapter.getRemoteUrl(request.repoPath);
  const identity = parseGithubOwnerRepo(remoteUrl);

  if (
    !identity ||
    identity.owner.toLowerCase() !== request.expectedOwner.toLowerCase() ||
    identity.repo.toLowerCase() !== request.expectedRepo.toLowerCase()
  ) {
    return {
      ok: false,
      code: "APPLICATION_PREFLIGHT_REPOSITORY_MISMATCH",
    };
  }

  const clean = await gitAdapter.isClean(request.repoPath);

  if (!clean) {
    return {
      ok: false,
      code: "APPLICATION_PREFLIGHT_WORKTREE_DIRTY",
    };
  }

  const currentHead = await gitAdapter.getCurrentHead(request.repoPath);

  if (currentHead !== request.expectedApplicationSha) {
    return {
      ok: false,
      code: "APPLICATION_PREFLIGHT_HEAD_MISMATCH",
    };
  }

  return {
    ok: true,
    code: "APPLICATION_PREFLIGHT_VERIFIED",
    verifiedApplicationSha: currentHead,
  };
}
