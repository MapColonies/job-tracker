import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';

@injectable()
export class SeedJobHandler extends JobHandler {
  protected readonly tasksFlow: TaskTypes;
  protected readonly excludedTypes: TaskTypes;
  protected readonly blockedDuplicationTypes: TaskTypes;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManagerClient, job, task);
    this.tasksFlow = this.config.get<TaskTypes>('taskFlowManager.seedTasksFlow');
    this.excludedTypes = [this.jobDefinitions.tasks.seed];
    this.blockedDuplicationTypes = [];

    // Initialize task operations after setting up the flow properties
    this.initializeTaskOperations();
  }

  public isProceedable(): { result: boolean; reason?: string } {
    return { result: true };
  }

  public isJobCompleted = (): boolean => {
    return this.job.completedTasks === this.job.taskCount;
  };
}
