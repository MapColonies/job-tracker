import { IJobResponse, ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';

export function isInitialWorkflowCompleted(job: IJobResponse<unknown, unknown>, initTasks: ITaskResponse<unknown>[]): boolean {
  return job.completedTasks === job.taskCount && initTasks.every((task) => task.status === OperationStatus.COMPLETED);
}
