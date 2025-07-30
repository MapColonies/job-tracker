import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { JOB_COMPLETED_MESSAGE } from '../../common/constants';
import { calculateTaskPercentage } from '../../utils/taskUtils';
import { IJobHandler } from './interfaces';

/**
 * Base implementation for job-level operations
 */
export abstract class BaseJobHandler implements IJobHandler {
  protected constructor(
    protected readonly logger: Logger,
    protected readonly jobManager: JobManagerClient,
    protected readonly job: IJobResponse<unknown, unknown>
  ) {}

  public completeJob = async (): Promise<void> => {
    this.logger.info({ msg: `Completing job`, jobId: this.job.id });
    await this.jobManager.updateJob(this.job.id, {
      status: OperationStatus.COMPLETED,
      reason: JOB_COMPLETED_MESSAGE,
      percentage: 100,
    });
    this.logger.info({ msg: JOB_COMPLETED_MESSAGE, jobId: this.job.id });
  };

  public failJob = async (reason?: string): Promise<void> => {
    const jobReason = reason ?? 'Job failed';
    this.logger.info({ msg: `Failing job: ${this.job.id}`, reason: jobReason });
    await this.jobManager.updateJob(this.job.id, {
      status: OperationStatus.FAILED,
      reason: jobReason,
    });
  };

  public suspendJob = async (reason?: string): Promise<void> => {
    const jobReason = reason ?? 'Job suspended';
    this.logger.info({ msg: `Suspending job: ${this.job.id}`, reason: jobReason });
    await this.jobManager.updateJob(this.job.id, {
      status: OperationStatus.SUSPENDED,
      reason: jobReason,
    });
  };

  public updateJobProgress = async (percentage: number): Promise<void> => {
    await this.jobManager.updateJob(this.job.id, { percentage });
    this.logger.info({
      msg: `Updated progress (${percentage}%) for job: ${this.job.id}`,
      jobId: this.job.id,
      percentage,
    });
  };

  public updateJobForHavingNewTask = async (taskType: string): Promise<void> => {
    const newTaskCount = this.job.taskCount + 1;
    const percentage = calculateTaskPercentage(this.job.completedTasks, newTaskCount);

    this.logger.debug({
      msg: 'Task created, updating progress',
      jobId: this.job.id,
      taskType,
      percentage,
    });
    await this.updateJobProgress(percentage);
  };

  public isAllTasksCompleted = (): boolean => {
    return this.job.completedTasks === this.job.taskCount;
  };

  // Abstract methods that concrete handlers must implement
  public abstract handleCompletedNotification(): Promise<void>;
  public abstract handleFailedTask(): Promise<void>;
}
