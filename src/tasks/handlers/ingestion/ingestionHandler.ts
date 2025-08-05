import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { WorkflowJobHandler } from '../jobHandler';

@injectable()
export class IngestionJobHandler extends WorkflowJobHandler {
  protected readonly tasksFlow: TaskTypes;
  protected readonly excludedTypes: TaskTypes;
  protected readonly shouldBlockDuplicationForTypes: TaskTypes;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManagerClient, job, task);
    this.tasksFlow = this.config.get<TaskTypes>('taskFlowManager.ingestionTasksFlow');
    this.excludedTypes = this.config.get<TaskTypes>('taskFlowManager.ingestionCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts];

    // Initialize task operations after setting up the flow properties
    this.initializeTaskOperations();
  }
}
