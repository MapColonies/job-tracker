import type { Logger } from '@map-colonies/js-logger';
import type { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { BadRequestError } from '@map-colonies/error-types';
import { cacheDeletionJobParamsSchema } from '@map-colonies/raster-shared';
import type { ConfigType } from '@src/common/config';
import type { TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';

@injectable()
export class DeleteCacheJobHandler extends JobHandler {
  protected readonly tasksFlow: TaskTypes;
  protected readonly excludedTypes: TaskTypes;
  protected readonly blockedDuplicationTypes: TaskTypes;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: ConfigType,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManagerClient, job, task);
    this.tasksFlow = this.config.get('taskFlowManager.deleteCacheTasksFlow') as unknown as TaskTypes;
    this.excludedTypes = [this.jobDefinitions.tasks.tilesDeletion];
    this.blockedDuplicationTypes = [];

    this.initializeTaskOperations();
  }

  /**
   * Overseer streams the tasks onto the job in batches, so all known tasks being completed is not enough -
   * the job is completed only once overseer flags that it finished creating tasks.
   */
  public override isJobCompleted = (): boolean => {
    const result = cacheDeletionJobParamsSchema.safeParse(this.job.parameters);

    if (!result.success) {
      const errorMessage = `Failed to parse cache deletion job parameters: ${result.error.message}`;
      this.logger.error({ msg: errorMessage, jobId: this.job.id });
      throw new BadRequestError(errorMessage);
    }

    return this.job.completedTasks === this.job.taskCount && result.data.tasksCreationCompleted;
  };
}
