import { Logger } from "@map-colonies/js-logger";
import { IJobResponse, ITaskResponse, JobManagerClient, OperationStatus } from "@map-colonies/mc-priority-queue";
import { JOB_COMPLETED_MESSAGE } from "../../common/constants";

export function isInitialWorkflowCompleted(job: IJobResponse<unknown, unknown>, initTask: ITaskResponse<unknown>): boolean {
    return job.completedTasks === job.taskCount && initTask.status === OperationStatus.COMPLETED;
}