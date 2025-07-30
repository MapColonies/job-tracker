import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypeArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { WorkflowJobHandler } from '../workflowJobHandler';

@injectable()
export class IngestionJobHandler extends WorkflowJobHandler {
  protected readonly tasksFlow: TaskTypeArray;
  protected readonly excludedTypes: TaskTypeArray;
  protected readonly shouldBlockDuplicationForTypes: TaskTypeArray;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManagerClient, job, task);
    this.tasksFlow = this.config.get<TaskTypeArray>('taskFlowManager.ingestionTasksFlow');
    this.excludedTypes = this.config.get<TaskTypeArray>('taskFlowManager.ingestionCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts];
  }
}
