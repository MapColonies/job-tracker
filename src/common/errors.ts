export class IrrelevantOperationStatusError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'IrrelevantOperationStatusError';
  }
}

export class TasksNotFoundError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'TasksNotFoundError';
  }
}

export class invalidArgumentError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'invalidArgumentError';
  }
}
