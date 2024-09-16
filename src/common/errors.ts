export class IrrelevantOperationStatusError extends Error {
  public constructor(message?: string) {
    super(message);
  }
}

export class TasksNotFoundError extends Error {
  public constructor(message?: string) {
    super(message);
  }
}
