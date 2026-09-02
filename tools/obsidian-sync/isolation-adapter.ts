import type {
  PathComparisonMode,
} from "./isolation-types";

export interface IsolationAdapter {
  realpath(
    path: string,
  ): Promise<string>;

  resolveTargetPhysicalAnchor(
    repoPath: string,
    target: string,
  ): Promise<string>;

  getOriginUrl(
    repoPath: string,
  ): Promise<string | null>;

  listEnvironmentKeys():
    readonly string[];

  getPathComparisonMode():
    PathComparisonMode;
}