import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { TaskTypes } from '@map-colonies/raster-shared';
import { calculateJobPercentage } from '../../utils/jobUtils';
import { TaskType } from '../../common/interfaces';
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
      percentage: 100,
    });
  };

  public failJob = async (reason?: string): Promise<void> => {
    const jobReason = reason ?? 'Job failed for unknown reason';
    this.logger.warn({ msg: `Failing job: ${this.job.id}`, jobId: this.job.id, reason: jobReason });
    await this.jobManager.updateJob(this.job.id, {
      status: OperationStatus.FAILED,
      reason: jobReason,
    });
  };

  public suspendJob = async (reason?: string): Promise<void> => {
    const jobReason = reason ?? 'Job suspended for unknown reason';
    this.logger.warn({ msg: `Suspending job: ${this.job.id}`, jobId: this.job.id, reason: jobReason });
    await this.jobManager.updateJob(this.job.id, {
      status: OperationStatus.SUSPENDED,
      reason: jobReason,
    });
  };

  public updateJobProgress = async (): Promise<void> => {
    const actualPercentage = calculateJobPercentage(this.job.completedTasks, this.job.taskCount);
    this.logger.info({
      msg: `Updated job percentage with (${actualPercentage}%) for job: ${this.job.id}`,
      jobId: this.job.id,
      percentage: actualPercentage,
    });
    await this.jobManager.updateJob(this.job.id, { percentage: actualPercentage });
  };

  public isJobCompleted = (taskType: TaskType): boolean => {
    return this.job.completedTasks === this.job.taskCount && taskType === TaskTypes.Finalize;
  };

  // Abstract methods that concrete handlers must implement
  public abstract handleCompletedNotification(): Promise<void>;
  public abstract handleFailedTask(): Promise<void>;
}
