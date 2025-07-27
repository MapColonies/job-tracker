import { OperationStatus } from '@map-colonies/mc-priority-queue';

export interface IJobHandler {
  failJob: (jobId: string, reason: string) => Promise<void>;
  suspendJob: (jobId: string, reason: string) => Promise<void>;
  completeJob: (jobId: string) => Promise<void>;
  updateJobPercentage: (jobId: string, desiredPercentage: number) => Promise<void>;
  updateJobForHavingNewTask: (jobId: string, completedTasks: number, totalTasks: number, nextTaskType: string) => Promise<void>;
  isAllTasksCompleted: (completedTasks: number, totalTasks: number) => boolean;
  isInitialWorkflowCompleted: (completedTasks: number, totalTasks: number, initTasks: { status: OperationStatus }[]) => boolean;
}
