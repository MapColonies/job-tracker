import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypeArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { BaseHandler } from '../baseHandler';

@injectable()
export class IngestionJobHandler extends BaseHandler {
  protected tasksFlow: TaskTypeArray;
  protected excludedTypes: TaskTypeArray;
  protected shouldBlockDuplicationForTypes: TaskTypeArray;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, jobManagerClient, config, job, task);
    this.tasksFlow = this.config.get<TaskTypeArray>('taskFlowManager.ingestionTasksFlow');
    this.excludedTypes = this.config.get<TaskTypeArray>('taskFlowManager.ingestionCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts];
  }
}
