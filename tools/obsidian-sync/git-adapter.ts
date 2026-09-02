export type TransactionWorktree = {
  path: string;
  cleanupRoot: string;
};

export interface GitAdapter {
  isClean(
    repoPath: string,
  ): Promise<boolean>;

  getLocalHead(
    repoPath: string,
    branch: string,
  ): Promise<string>;

  getRemoteHead(
    repoPath: string,
    branch: string,
  ): Promise<string>;

  createTransactionWorktree(
    repoPath: string,
    baseSha: string,
  ): Promise<TransactionWorktree>;

  writeFile(
    worktreePath: string,
    target: string,
    content: string,
  ): Promise<void>;

  getChangedPaths(
    worktreePath: string,
  ): Promise<readonly string[]>;

  stagePaths(
    worktreePath: string,
    paths: readonly string[],
  ): Promise<void>;

  commit(
    worktreePath: string,
    message: string,
  ): Promise<string>;

  getCommitParent(
    worktreePath: string,
    sha: string,
  ): Promise<string>;

  pushCommit(
    repoPath: string,
    sha: string,
    branch: string,
  ): Promise<void>;

  removeTransactionWorktree(
    repoPath: string,
    transaction: TransactionWorktree,
  ): Promise<void>;
}