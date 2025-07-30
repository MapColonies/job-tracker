import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { exportFinalizeTaskParamsSchema, ExportFinalizeType } from '@map-colonies/raster-shared';
import { IConfig } from '../../../common/interfaces';
import { ITaskHandler } from '../interfaces/ITaskHandler';

export class FinalizeExportTaskHandler implements ITaskHandler {
  protected readonly jobManager: JobManagerClient;

  public constructor(
    protected readonly logger: Logger,
    protected readonly config: IConfig,
    protected readonly jobManagerClient: JobManagerClient,
    protected readonly job: IJobResponse<unknown, unknown>,
    protected readonly task: ITaskResponse<unknown>
  ) {
    this.jobManager = jobManagerClient;
  }

  public async handleFailedTask(): Promise<void> {
    // Use base handler's implementation for failed tasks
    return Promise.resolve();
  }

  public async canProceed(): Promise<boolean> {
    const validFinalizeTaskParams = exportFinalizeTaskParamsSchema.parse(this.task.parameters);
    return Promise.resolve(validFinalizeTaskParams.type !== ExportFinalizeType.Error_Callback);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public shouldSkipTaskCreation(taskType: string): boolean {
    return false;
  }
}
