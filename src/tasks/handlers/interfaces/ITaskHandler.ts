export interface ITaskHandler {
  handleFailedTask: () => Promise<void>;
  canProceed: () => Promise<boolean>;
  shouldSkipTaskCreation: (taskType: string) => boolean;
}
