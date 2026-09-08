import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  GATE_G_TASK,
  runGateGCanary,
} from "@/tools/obsidian-sync/canary-runner";

import {
  runReviewClosure,
} from "@/tools/obsidian-sync/review-closure-runner";

import {
  CLOSED_TASKS,
} from "@/tools/obsidian-sync/closed-tasks";

const EXPECTED_CLOSED_RESULT = {
  status:
    "TASK_CLOSED",

  task:
    "TASK-AS-0003",
} as const;

type DependencySpy =
  ReturnType<typeof vi.fn>;

type NamedDependencySpy =
  readonly [string, DependencySpy];

function addThrowingSpy(
  spies: NamedDependencySpy[],
  name: string,
): DependencySpy {
  const spy =
    vi.fn(
      () => {
        throw new Error(
          `Operational dependency accessed: ${name}`,
        );
      },
    );

  spies.push([
    name,
    spy,
  ]);

  return spy;
}

function addThrowingObject(
  spies: NamedDependencySpy[],
  prefix: string,
  methods: readonly string[],
): Record<string, DependencySpy> {
  return Object.fromEntries(
    methods.map(
      (method) => [
        method,
        addThrowingSpy(
          spies,
          `${prefix}.${method}`,
        ),
      ],
    ),
  );
}

function addThrowingEnvironment(
  spies: NamedDependencySpy[],
): Record<string, string | undefined> {
  const access =
    addThrowingSpy(
      spies,
      "environment",
    );

  return new Proxy(
    {},
    {
      get(
        _target,
        property,
      ) {
        return access(
          String(property),
        );
      },
    },
  );
}

function createCanaryDependencies(
  environment?:
    Record<string, string | undefined>,
) {
  const spies:
    NamedDependencySpy[] = [];

  const dependencies = {
    environment:
      environment ??
      addThrowingEnvironment(
        spies,
      ),

    isolationAdapter:
      addThrowingObject(
        spies,
        "filesystem/isolation",
        [
          "realpath",
          "resolveTargetPhysicalAnchor",
          "getOriginUrl",
          "listEnvironmentKeys",
          "getPathComparisonMode",
        ],
      ),

    transactionAdapter:
      addThrowingObject(
        spies,
        "application/remote-git",
        [
          "isClean",
          "getLocalHead",
          "getRemoteHead",
          "createTransactionWorktree",
          "writeFile",
          "getChangedPaths",
          "stagePaths",
          "commit",
          "getCommitParent",
          "pushCommit",
          "removeTransactionWorktree",
        ],
      ),

    pullAdapter:
      addThrowingObject(
        spies,
        "local-git",
        [
          "isClean",
          "getCurrentBranch",
          "getOperationState",
          "getHead",
          "fetchBranch",
          "isAncestor",
          "fastForward",
        ],
      ),

    verifyIsolationFn:
      addThrowingSpy(
        spies,
        "verifyIsolation",
      ),

    executeMutationPipelineFn:
      addThrowingSpy(
        spies,
        "mutationPipeline",
      ),

    executeLocalObsidianPullFn:
      addThrowingSpy(
        spies,
        "localPull",
      ),

    getApplicationState:
      addThrowingSpy(
        spies,
        "filesystem/application-state",
      ),

    readTarget:
      addThrowingSpy(
        spies,
        "vault/filesystem",
      ),

    readOnlyGit:
      addThrowingSpy(
        spies,
        "application-git",
      ),

    now:
      addThrowingSpy(
        spies,
        "clock",
      ),

    emitEvidence:
      addThrowingSpy(
        spies,
        "evidence-emitter",
      ),
  };

  return {
    dependencies:
      dependencies as unknown as
        Parameters<
          typeof runGateGCanary
        >[0],

    spies,
  };
}

function createReviewClosureDependencies(
  environment?:
    Record<string, string | undefined>,
) {
  const spies:
    NamedDependencySpy[] = [];

  const dependencies = {
    environment:
      environment ??
      addThrowingEnvironment(
        spies,
      ),

    transactionAdapter:
      addThrowingObject(
        spies,
        "local/remote-git",
        [
          "getLocalHead",
          "getRemoteHead",
        ],
      ),

    isolationAdapter:
      addThrowingObject(
        spies,
        "filesystem/isolation",
        [
          "realpath",
          "resolveTargetPhysicalAnchor",
          "getOriginUrl",
          "listEnvironmentKeys",
          "getPathComparisonMode",
        ],
      ),

    pullAdapter:
      addThrowingObject(
        spies,
        "local-git",
        [
          "isClean",
          "getCurrentBranch",
          "getOperationState",
          "getHead",
          "fetchBranch",
          "isAncestor",
          "fastForward",
        ],
      ),

    readTarget:
      addThrowingSpy(
        spies,
        "vault/filesystem",
      ),

    now:
      addThrowingSpy(
        spies,
        "clock",
      ),

    executeMutationPipelineFn:
      addThrowingSpy(
        spies,
        "mutationPipeline",
      ),

    executeLocalObsidianPullFn:
      addThrowingSpy(
        spies,
        "localPull",
      ),
  };

  return {
    dependencies:
      dependencies as unknown as
        Parameters<
          typeof runReviewClosure
        >[0],

    spies,
  };
}

function expectNoDependencyCalls(
  spies: readonly NamedDependencySpy[],
): void {
  for (
    const [name, spy]
    of spies
  ) {
    expect.soft(
      spy,
      name,
    ).toHaveBeenCalledTimes(0);
  }
}

async function captureResult<T>(
  operation: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await operation();
  } catch {
    return undefined;
  }
}

describe(
  "TASK-AS-0003 closed-task guard",
  () => {
    it(
      "returns TASK_CLOSED from the canary runner before every operational dependency",
      async () => {
        const {
          dependencies,
          spies,
        } =
          createCanaryDependencies();

        const result =
          await captureResult(
            () =>
              runGateGCanary(
                dependencies,
              ),
          );

        expect.soft(
          result,
        ).toEqual(
          EXPECTED_CLOSED_RESULT,
        );

        expectNoDependencyCalls(
          spies,
        );
      },
    );

    it(
      "returns TASK_CLOSED from the review-closure runner before every operational dependency",
      async () => {
        const {
          dependencies,
          spies,
        } =
          createReviewClosureDependencies();

        const result =
          await captureResult(
            () =>
              runReviewClosure(
                dependencies,
              ),
          );

        expect.soft(
          result,
        ).toEqual(
          EXPECTED_CLOSED_RESULT,
        );

        expectNoDependencyCalls(
          spies,
        );
      },
    );

    it(
      "does not let synthetic armed values bypass TASK_CLOSED",
      async () => {
        const syntheticEnvironment = {
          AI_SHOWROOM_GATE_G_ARM:
            "SYNTHETIC_ARMED_VALUE",

          AI_SHOWROOM_REVIEW_CLOSURE_ARM:
            "SYNTHETIC_ARMED_VALUE",
        };

        const canary =
          createCanaryDependencies(
            syntheticEnvironment,
          );

        const review =
          createReviewClosureDependencies(
            syntheticEnvironment,
          );

        expect.soft(
          await captureResult(
            () =>
              runGateGCanary(
                canary.dependencies,
              ),
          ),
        ).toEqual(
          EXPECTED_CLOSED_RESULT,
        );

        expect.soft(
          await captureResult(
            () =>
              runReviewClosure(
                review.dependencies,
              ),
          ),
        ).toEqual(
          EXPECTED_CLOSED_RESULT,
        );

        expectNoDependencyCalls([
          ...canary.spies,
          ...review.spies,
        ]);
      },
    );

    it(
      "keeps TASK-AS-0003 in a frozen closed-task registry",
      () => {
        expect.soft(
          Object.isFrozen(
            CLOSED_TASKS,
          ),
        ).toBe(true);

        expect(
          CLOSED_TASKS,
        ).toContain(
          GATE_G_TASK,
        );
      },
    );

    it(
      "performs zero environment property accesses before TASK_CLOSED",
      async () => {
        const propertyAccesses:
          PropertyKey[] = [];

        const environment =
          new Proxy(
            {
              AI_SHOWROOM_GATE_G_ARM:
                "SYNTHETIC_ARMED_VALUE",

              AI_SHOWROOM_REVIEW_CLOSURE_ARM:
                "SYNTHETIC_ARMED_VALUE",
            },
            {
              get(
                target,
                property,
                receiver,
              ) {
                propertyAccesses.push(
                  property,
                );

                return Reflect.get(
                  target,
                  property,
                  receiver,
                );
              },
            },
          );

        const canary =
          createCanaryDependencies(
            environment,
          );

        const review =
          createReviewClosureDependencies(
            environment,
          );

        expect.soft(
          await captureResult(
            () =>
              runGateGCanary(
                canary.dependencies,
              ),
          ),
        ).toEqual(
          EXPECTED_CLOSED_RESULT,
        );

        expect.soft(
          await captureResult(
            () =>
              runReviewClosure(
                review.dependencies,
              ),
          ),
        ).toEqual(
          EXPECTED_CLOSED_RESULT,
        );

        expect(
          propertyAccesses,
        ).toEqual([]);
      },
    );
  },
);
