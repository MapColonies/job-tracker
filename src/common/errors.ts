export class IrrelevantOperationStatusError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'IrrelevantOperationStatusError';
  }
}

export class InvalidArgumentError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'invalidArgumentError';
  }
}
