export type ClosedTask =
  "TASK-AS-0003";

export const CLOSED_TASKS:
  readonly ClosedTask[] =
  Object.freeze([
    "TASK-AS-0003",
  ]);

export type TaskClosedResult = {
  readonly status:
    "TASK_CLOSED";

  readonly task:
    ClosedTask;
};

export function isTaskClosed(
  task: string,
): task is ClosedTask {
  return (
    CLOSED_TASKS as
      readonly string[]
  ).includes(task);
}

export function createTaskClosedResult(
  task: ClosedTask,
): TaskClosedResult {
  return {
    status:
      "TASK_CLOSED",

    task,
  };
}
