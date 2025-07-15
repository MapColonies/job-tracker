import { Logger } from '@map-colonies/js-logger';
import { ICreateTaskBody, IJobResponse, ITaskResponse, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { ExportFinalizeErrorCallbackParams, exportFinalizeTaskParamsSchema, ExportFinalizeType } from '@map-colonies/raster-shared';
import { IConfig, TaskTypesArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../baseHandler';
import { isInitialWorkflowCompleted } from '../utils';

@injectable()
export class ExportJobHandler extends JobHandler {
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
    this.tasksFlow = this.config.get<TaskTypesArray>('ExportTasksFlow');
    this.excludedTypes = this.config.get<TaskTypesArray>('exportCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.export];
    this.setValidations();
  }

  public handleFailedTask = async (): Promise<void> => {
    throw new Error('handleFailedTask has failed to set.');
    await Promise.resolve();
  };
  public canProceed = async (): Promise<boolean> => Promise.resolve(true);

  protected shouldSkipTaskCreation(taskType: string): boolean {
    return this.excludedTypes.includes(taskType);
  }

  private readonly handleFailedExportTask = async (): Promise<void> => {
    this.logger.info({ msg: `Handling Export Failure with jobId: ${this.task.jobId}, and reason: ${this.task.reason}` });
    const taskParameters: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
    const taskType = this.jobDefinitions.tasks.finalize;
    const createTaskBody: ICreateTaskBody<ExportFinalizeErrorCallbackParams> = {
      type: taskType,
      parameters: taskParameters,
      blockDuplication: this.shouldBlockDuplicationForTypes.includes(taskType),
    };

    await this.jobManager.createTaskForJob(this.task.jobId, createTaskBody);
    this.logger.info({ msg: `Created ${taskType} task for job: ${this.task.jobId}` });

    await this.failJob();
  };

  private readonly exportValidator = async (): Promise<boolean> => {
    const initTasksOfJob = await this.findInitTasks();
    if (initTasksOfJob === undefined) {
      this.logger.warn({
        msg: `Skipping init tasks completed validation of job ${this.job.id} , init tasks were not found`,
        jobId: this.job.id,
        taskId: this.task.id,
        taskType: this.task.type,
        jobType: this.job.type,
      });
      return true;
    } else {
      return isInitialWorkflowCompleted(this.job, initTasksOfJob);
    }
  };

  private readonly finalizeValidator = async (): Promise<boolean> => {
    const validFinalizeTaskParams = exportFinalizeTaskParamsSchema.parse(this.task.parameters);
    if (validFinalizeTaskParams.type === ExportFinalizeType.Error_Callback) {
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  };

  private setValidations(): void {
    switch (this.task.type) {
      case this.jobDefinitions.tasks.finalize:
        this.canProceed = this.finalizeValidator;
        this.handleFailedTask = super.handleFailedTask;
        break;
      default:
        this.canProceed = this.exportValidator;
        this.handleFailedTask = this.handleFailedExportTask;
        break;
    }
  }
}
