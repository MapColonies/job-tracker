export class IrrelevantOperationStatusError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'IrrelevantOperationStatusError';
  }
}
