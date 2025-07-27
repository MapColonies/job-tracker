import { Logger } from '@map-colonies/js-logger';
import { ICreateTaskBody, IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { ExportFinalizeErrorCallbackParams, exportFinalizeTaskParamsSchema, ExportFinalizeType } from '@map-colonies/raster-shared';
import { IConfig, TaskTypeArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { BaseHandler } from '../baseJobHandler';
import { ITaskHandler } from '../interfaces/ITaskHandler';
import { FinalizeExportTaskHandler } from './taskHandlers/finalizeExportTaskHandler';
import { BaseExportTaskHandler } from './taskHandlers/baseExportTaskHandler';

@injectable()
export class ExportJobHandler extends BaseHandler {
  protected tasksFlow: TaskTypeArray;
  protected excludedTypes: TaskTypeArray;
  protected shouldBlockDuplicationForTypes: TaskTypeArray;
  private taskHandler: ITaskHandler;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, jobManagerClient, config, job, task);
    this.tasksFlow = this.config.get<TaskTypeArray>('taskFlowManager.exportTasksFlow');
    this.excludedTypes = this.config.get<TaskTypeArray>('taskFlowManager.exportCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.export];
    this.taskHandler = this.getTaskHandler();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public handleFailedTask = async (): Promise<void> => {
    throw new Error('handleFailedTask has failed to set.');
  };
  public canProceed = async (): Promise<boolean> => Promise.resolve(true);

  private readonly handleFailedExportTask = async (): Promise<void> => {
    this.logger.info({ msg: `Handling export failure with jobId: ${this.task.jobId}, and reason: ${this.task.reason}` });
    const taskParameters: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
    const taskType = this.jobDefinitions.tasks.finalize;
    const createTaskBody: ICreateTaskBody<ExportFinalizeErrorCallbackParams> = {
      type: taskType,
      parameters: taskParameters,
      blockDuplication: this.shouldBlockDuplicationForTypes.includes(taskType),
    };

    await this.jobManager.createTaskForJob(this.task.jobId, createTaskBody);
    this.logger.info({ msg: `Created ${taskType} task for job: ${this.task.jobId}` });
    await this.updateJobForHavingNewTask(taskType);

    await this.failJob();
  };

  private getTaskHandler(): ITaskHandler {
    switch (this.task.type) {
      case this.jobDefinitions.tasks.finalize:
        return this.taskHandler = new FinalizeExportTaskHandler(this.logger, this.config, this.jobManager, this.job, this.task);
      default:
        return this.taskHandler = new BaseExportTaskHandler(this.logger, this.config, this.jobManager, this.job, this.task);
    }
  }
}
