import { Logger } from '@map-colonies/js-logger';
import { ICreateTaskBody, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { ExportFinalizeErrorCallbackParams, exportFinalizeTaskParamsSchema, ExportFinalizeType } from '@map-colonies/raster-shared';
import { IJobDefinitionsConfig, TaskTypeArray } from '../../../common/interfaces';
import { ITaskValidationStrategy } from '../interfaces';

export class FinalizeValidationStrategy implements ITaskValidationStrategy {
  public constructor(
    private readonly task: ITaskResponse<unknown>,
    private readonly baseCanProceed: () => Promise<boolean>,
    private readonly baseHandleFailedTask: () => Promise<void>
  ) {}

  public async canProceed(): Promise<boolean> {
    const validFinalizeTaskParams = exportFinalizeTaskParamsSchema.parse(this.task.parameters);
    if (validFinalizeTaskParams.type === ExportFinalizeType.Error_Callback) {
      return false;
    }
    return this.baseCanProceed();
  }

  public async handleFailedTask(): Promise<void> {
    return this.baseHandleFailedTask();
  }
}

export class DefaultValidationStrategy implements ITaskValidationStrategy {
  private readonly jobDefinitions: IJobDefinitionsConfig;
  private readonly shouldBlockDuplicationForTypes: TaskTypeArray;

  public constructor(
    private readonly logger: Logger,
    private readonly jobManager: JobManagerClient,
    private readonly task: ITaskResponse<unknown>,
    private readonly baseCanProceed: () => Promise<boolean>,
    private readonly updateJobForHavingNewTask: (taskType: string) => Promise<void>,
    private readonly failJob: () => Promise<void>,
    shouldBlockDuplicationForTypes: TaskTypeArray,
    jobDefinitions: IJobDefinitionsConfig
  ) {
    this.jobDefinitions = jobDefinitions;
    this.shouldBlockDuplicationForTypes = shouldBlockDuplicationForTypes;
  }

  public async canProceed(): Promise<boolean> {
    return this.baseCanProceed();
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
}
