import { IJobResponse, ITaskResponse, OperationStatus } from "@map-colonies/mc-priority-queue";

export function isInitialWorkflowCompleted(job: IJobResponse<unknown, unknown>, initTask: ITaskResponse<unknown>): boolean {
    return job.completedTasks === job.taskCount && initTask.status === OperationStatus.COMPLETED;
}
