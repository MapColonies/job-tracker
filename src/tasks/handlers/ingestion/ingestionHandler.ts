import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypesArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { isInitialWorkflowCompleted } from '../utils';
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
    this.tasksFlow = this.config.get<TaskTypesArray>('IngestionTasksFlow');
    this.excludedTypes = this.config.get<TaskTypesArray>('ingestionCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts];
  }

  public async canProceed(): Promise<boolean> {
    const initTaskOfJob = await this.findInitTasks();
    if (initTaskOfJob === undefined) {
      this.logger.warn({
        msg: `Skipping init tasks completed validation of job ${this.job.id} , init tasks were not found`,
        jobId: this.job.id,
        taskId: this.task.id,
        taskType: this.task.type,
        jobType: this.job.type,
      });
      return true;
    } else {
      return isInitialWorkflowCompleted(this.job, initTaskOfJob);
    }
  }

  protected shouldSkipTaskCreation(taskType: string): boolean {
    return this.excludedTypes.includes(taskType);
  }
}
