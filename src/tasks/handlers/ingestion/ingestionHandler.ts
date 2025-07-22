import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypesArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../baseHandler';

@injectable()
export class IngestionJobHandler extends JobHandler {
  protected tasksFlow: TaskTypesArray;
  protected excludedTypes: TaskTypesArray;
  protected shouldBlockDuplicationForTypes: TaskTypesArray;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.QUEUE_CLIENT) queueClient: QueueClient,
    @inject(SERVICES.CONFIG) config: IConfig,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, queueClient, config, job, task);
    this.tasksFlow = this.config.get<TaskTypesArray>('taskFlowManager.ingestionTasksFlow');
    this.excludedTypes = this.config.get<TaskTypesArray>('taskFlowManager.ingestionCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts];
  }
}
