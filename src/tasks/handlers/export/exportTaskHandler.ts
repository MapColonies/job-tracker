import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypeArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { BaseTaskHandler } from '../baseTaskHandler';

/**
 * Task handler specific to export operations
 */
@injectable()
export class ExportTaskHandler extends BaseTaskHandler {
  protected readonly shouldBlockDuplicationForTypes: TaskTypeArray;
  protected readonly tasksFlow: TaskTypeArray;
  protected readonly excludedTypes: TaskTypeArray;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    jobManagerClient: JobManagerClient,
    task: ITaskResponse<unknown>,
    @inject(SERVICES.CONFIG) config: IConfig
  ) {
    super(logger, jobManagerClient, task, config);

    this.tasksFlow = this.config.get<TaskTypeArray>('taskFlowManager.exportTasksFlow');
    this.excludedTypes = this.config.get<TaskTypeArray>('taskFlowManager.exportCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.export];
  }

  public handleTaskCompletion = async (): Promise<void> => {
    this.logger.info({
      msg: `Handling export task completion`,
      taskId: this.task.id,
      taskType: this.task.type,
    });
    // Implementation for export-specific task completion logic
    await Promise.resolve();
  };

  public handleTaskFailure = async (): Promise<void> => {
    this.logger.info({
      msg: `Handling export task failure`,
      taskId: this.task.id,
      taskType: this.task.type,
    });
    // Implementation for export-specific task failure logic
    await Promise.resolve();
  };
}
