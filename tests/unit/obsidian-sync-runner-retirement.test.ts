import {
  spawnSync,
} from "node:child_process";

import {
  resolve,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import * as canaryRunner
  from "@/tools/obsidian-sync/canary-runner";

import * as reviewClosureRunner
  from "@/tools/obsidian-sync/review-closure-runner";

type RetiredRunner = {
  readonly label:
    string;

  readonly module:
    Record<string, unknown>;

  readonly productionFactory:
    string;

  readonly path:
    string;
};

const RETIRED_RUNNERS:
  readonly RetiredRunner[] = [
    {
      label:
        "Gate G canary",

      module:
        canaryRunner,

      productionFactory:
        "createProductionGateGDependencies",

      path:
        resolve(
          "tools/obsidian-sync/canary-runner.ts",
        ),
    },
    {
      label:
        "review closure",

      module:
        reviewClosureRunner,

      productionFactory:
        "createProductionReviewClosureDependencies",

      path:
        resolve(
          "tools/obsidian-sync/review-closure-runner.ts",
        ),
    },
  ];

describe.each(
  RETIRED_RUNNERS,
)(
  "$label TASK-AS-0003 runner retirement",
  (
    runner,
  ) => {
    it(
      "does not expose a production dependency factory",
      () => {
        expect(
          runner.module,
        ).not.toHaveProperty(
          runner.productionFactory,
        );
      },
    );

    it(
      "does not expose a main execution function",
      () => {
        expect(
          runner.module,
        ).not.toHaveProperty(
          "main",
        );
      },
    );

    it(
      "has no direct CLI execution path",
      () => {
        const result =
          spawnSync(
            process.execPath,
            [
              "--import",
              "tsx",
              runner.path,
            ],
            {
              cwd:
                process.cwd(),

              encoding:
                "utf8",
            },
          );

        expect.soft(
          result.status,
        ).toBe(0);

        expect.soft(
          result.signal,
        ).toBeNull();

        expect.soft(
          result.stdout,
        ).toBe("");

        expect(
          result.stderr,
        ).toBe("");
      },
    );
  },
);
