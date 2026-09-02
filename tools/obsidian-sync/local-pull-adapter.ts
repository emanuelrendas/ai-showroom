import type {
  LocalGitOperationState,
} from "./local-pull-types";

export interface LocalPullAdapter {
  isClean(
    repoPath: string,
  ): Promise<boolean>;

  getCurrentBranch(
    repoPath: string,
  ): Promise<string | null>;

  getOperationState(
    repoPath: string,
  ): Promise<LocalGitOperationState>;

  getHead(
    repoPath: string,
  ): Promise<string>;

  fetchBranch(
    repoPath: string,
    branch: string,
  ): Promise<string>;

  isAncestor(
    repoPath: string,
    ancestor: string,
    descendant: string,
  ): Promise<boolean>;

  fastForward(
    repoPath: string,
    sha: string,
  ): Promise<void>;
}