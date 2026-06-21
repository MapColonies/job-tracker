import type { Logger } from '@map-colonies/js-logger';
import type { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import type { ConfigType } from '@src/common/config';
import type { TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';

@injectable()
export class SeedJobHandler extends JobHandler {
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
    this.tasksFlow = this.config.get('taskFlowManager.seedTasksFlow') as unknown as TaskTypes;
    this.excludedTypes = [this.jobDefinitions.tasks.seed];
    this.blockedDuplicationTypes = [];

    this.initializeTaskOperations();
  }

  public override isJobCompleted = (): boolean => {
    return this.job.completedTasks === this.job.taskCount;
  };
}
