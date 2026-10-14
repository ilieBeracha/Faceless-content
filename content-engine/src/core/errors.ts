/** A problem the person running the engine can fix. Printed without a stack trace. */
export class EngineError extends Error {
  constructor(
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/** Raised when a generation step would read files outside the allowed context. */
export class IsolationError extends EngineError {
  constructor(message: string) {
    super(message, "Each generation step may load only AGENTS.md, the target channel's files and the skills its series uses.");
    this.name = "IsolationError";
  }
}

/** Validation failed; `report` is the formatted list of issues. */
export class ValidationError extends EngineError {
  constructor(
    message: string,
    public readonly report: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** A pipeline step paused. Not an error: the CLI prints what happens next. */
export class PipelinePause extends Error {
  constructor(
    public readonly kind: "waiting-for-agent" | "awaiting-approval" | "needs-fix",
    public readonly lines: string[],
  ) {
    super(kind);
    this.name = "PipelinePause";
  }
}
