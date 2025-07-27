import { Logger } from '@map-colonies/js-logger';
import { ICreateTaskBody, IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { IConfig } from '../../../../common/interfaces';
import { ITaskHandler } from '../../interfaces/ITaskHandler';
import { ExportFinalizeErrorCallbackParams, ExportFinalizeType } from '@map-colonies/raster-shared';
import { JobHandlerService } from '../../services/JobHandlerService';

export class BaseExportTaskHandler implements ITaskHandler {
  protected readonly jobManager: JobManagerClient;
  protected jobUtils: JobHandlerService;

  public constructor(
    protected readonly logger: Logger,
    protected readonly config: IConfig,
    protected readonly jobManagerClient: JobManagerClient,
    protected readonly job: IJobResponse<unknown, unknown>,
    protected readonly task: ITaskResponse<unknown>
  ) {
    this.jobManager = jobManagerClient;
    this.jobUtils = new JobHandlerService(logger, jobManagerClient);

  }

  public async handleFailedTask(): Promise<void> {
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
  }

  public canProceed(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public shouldSkipTaskCreation(taskType: string): boolean {
    return false;
  }
}
