import type {
  AppendOnlyDecision,
  AppendOnlyValidationInput,
  SyncActor,
} from "./types";

const STATE_UPDATE_PREFIX = "## State Update — ";
const STATE_CORRECTION_PREFIX = "## State Correction — ";
const EVENT_HEADING_PATTERN = /^## State (?:Update|Correction) — /gm;
const ISO_8601_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

const ACTOR_LABELS: Record<SyncActor, string> = {
  sol: "Sol",
  spark: "Spark",
  flash: "Flash",
  tiago: "Tiago",
};

type EventKind = "update" | "correction";

type ExtractedEvent = {
  kind: EventKind;
  content: string;
};

function normalizeEventLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function readFieldValues(content: string, field: string): string[] {
  const prefix = `${field}:`;
  return content
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
}

function hasExactlyOneNonEmptyField(content: string, field: string): boolean {
  const values = readFieldValues(content, field);
  return values.length === 1 && values[0].length > 0;
}

function readSingleRequiredField(content: string, field: string): string | null {
  const values = readFieldValues(content, field);
  if (values.length !== 1 || values[0].length === 0) {
    return null;
  }
  return values[0];
}

function eventTimestamp(eventContent: string, prefix: string): string | null {
  const firstLine = eventContent.split("\n", 1)[0];
  if (!firstLine.startsWith(prefix)) {
    return null;
  }
  const timestamp = firstLine.slice(prefix.length).trim();
  if (!ISO_8601_TIMESTAMP_PATTERN.test(timestamp)) {
    return null;
  }
  return timestamp;
}

function extractEvent(currentContent: string, appendedRaw: string): ExtractedEvent | null {
  const appended = normalizeEventLineEndings(appendedRaw);
  let eventContent: string;

  if (currentContent.length === 0) {
    eventContent = appended;
  } else if (
    currentContent.endsWith("\n\n") ||
    currentContent.endsWith("\r\n\r\n")
  ) {
    eventContent = appended;
  } else if (
    currentContent.endsWith("\n") ||
    currentContent.endsWith("\r\n")
  ) {
    if (!appended.startsWith("\n")) {
      return null;
    }
    eventContent = appended.slice(1);
  } else {
    if (!appended.startsWith("\n\n")) {
      return null;
    }
    eventContent = appended.slice(2);
  }

  if (eventContent.startsWith(STATE_UPDATE_PREFIX)) {
    return {
      kind: "update",
      content: eventContent,
    };
  }

  if (eventContent.startsWith(STATE_CORRECTION_PREFIX)) {
    return {
      kind: "correction",
      content: eventContent,
    };
  }

  return null;
}

function validateUpdateStructure(
  request: AppendOnlyValidationInput["request"],
  content: string,
): AppendOnlyDecision | null {
  if (eventTimestamp(content, STATE_UPDATE_PREFIX) === null) {
    return {
      ok: false,
      code: "MALFORMED_STATE_EVENT",
    };
  }

  const requiredFields = [
    "Agent",
    "Task",
    "Previous Status",
    "New Status",
    "Reason",
    "Evidence",
  ] as const;

  for (const field of requiredFields) {
    if (!hasExactlyOneNonEmptyField(content, field)) {
      return {
        ok: false,
        code: "MALFORMED_STATE_EVENT",
      };
    }
  }

  const agent = readSingleRequiredField(content, "Agent");
  const expectedActor = ACTOR_LABELS[request.actor];
  if (agent !== expectedActor) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
    };
  }

  const task = readSingleRequiredField(content, "Task");
  if (task !== request.task) {
    return {
      ok: false,
      code: "TASK_MISMATCH",
    };
  }

  return null;
}

function validateCorrectionStructure(content: string): AppendOnlyDecision | null {
  if (eventTimestamp(content, STATE_CORRECTION_PREFIX) === null) {
    return {
      ok: false,
      code: "MALFORMED_STATE_EVENT",
    };
  }

  const requiredFields = [
    "Corrects",
    "Reason",
    "Correct State",
  ] as const;

  for (const field of requiredFields) {
    if (!hasExactlyOneNonEmptyField(content, field)) {
      return {
        ok: false,
        code: "MALFORMED_STATE_EVENT",
      };
    }
  }

  return null;
}
function validateReviewClosureEvent(
  request:
    AppendOnlyValidationInput["request"],
  event:
    ExtractedEvent,
): AppendOnlyDecision | null {
  const approval =
    request
      .reviewClosureApproval;

  if (!approval) {
    return null;
  }

  if (
    event.kind !==
    "update"
  ) {
    return {
      ok: false,
      code:
        "REVIEW_CLOSURE_EVENT_MISMATCH",
    };
  }

  const previousStatus =
    readSingleRequiredField(
      event.content,
      "Previous Status",
    );

  const newStatus =
    readSingleRequiredField(
      event.content,
      "New Status",
    );

  if (
    previousStatus !==
      approval.fromStatus ||
    newStatus !==
      approval.toStatus
  ) {
    return {
      ok: false,
      code:
        "REVIEW_CLOSURE_EVENT_MISMATCH",
    };
  }

  return null;
}
export function validateAppendOnlyMutation({
  request,
  currentContent,
  proposedContent,
}: AppendOnlyValidationInput): AppendOnlyDecision {
  if (request.mutationKind !== "append-state") {
    return {
      ok: false,
      code: "NOT_APPEND_STATE_OPERATION",
    };
  }

  if (proposedContent.length < currentContent.length) {
    return {
      ok: false,
      code: "CURRENT_HISTORY_DELETED",
    };
  }

  if (proposedContent === currentContent) {
    return {
      ok: false,
      code: "NO_CONTENT_APPENDED",
    };
  }

  if (!proposedContent.startsWith(currentContent)) {
    return {
      ok: false,
      code: "CURRENT_HISTORY_MODIFIED",
    };
  }

  const appendedRaw = proposedContent.slice(currentContent.length);
  const extracted = extractEvent(currentContent, appendedRaw);

  if (!extracted) {
    return {
      ok: false,
      code: "INVALID_APPEND_BOUNDARY",
    };
  }

  const eventHeadings = extracted.content.match(EVENT_HEADING_PATTERN) ?? [];

  if (eventHeadings.length > 1) {
    return {
      ok: false,
      code: "MULTIPLE_STATE_EVENTS",
    };
  }

  if (eventHeadings.length !== 1) {
    return {
      ok: false,
      code: "INVALID_APPEND_BOUNDARY",
    };
  }

  const structuralFailure =
    extracted.kind === "update"
      ? validateUpdateStructure(request, extracted.content)
      : validateCorrectionStructure(extracted.content);

if (structuralFailure) {
  return structuralFailure;
}

const reviewClosureFailure =
  validateReviewClosureEvent(
    request,
    extracted,
  );

if (
  reviewClosureFailure
) {
  return reviewClosureFailure;
}

return {
  ok: true,
  code: "APPEND_ONLY_VALID",
  appendedContent: extracted.content,
};
}