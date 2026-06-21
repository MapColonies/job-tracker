import type { Logger } from '@map-colonies/js-logger';
import type { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { ExportFinalizeType } from '@map-colonies/raster-shared';
import type { ConfigType } from '@src/common/config';
import type { TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';

@injectable()
export class ExportJobHandler extends JobHandler {
  protected readonly tasksFlow: TaskTypes;
  protected readonly excludedTypes: TaskTypes;
  protected readonly blockedDuplicationTypes: TaskTypes;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: ConfigType,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManagerClient, job, task);
    this.tasksFlow = this.config.get('taskFlowManager.exportTasksFlow') as unknown as TaskTypes;
    this.excludedTypes = [this.jobDefinitions.tasks.export];
    this.blockedDuplicationTypes = [this.jobDefinitions.tasks.export];

    this.initializeTaskOperations();
  }

  public override async handleFailedTask(): Promise<void> {
    // For export tasks, create a finalize error callback task and fail the job
    if (this.task.type === this.jobDefinitions.tasks.export) {
      const createTaskBody = {
        parameters: { callbacksSent: false, type: ExportFinalizeType.Error_Callback },
        type: this.jobDefinitions.tasks.finalize,
        blockDuplication: false,
      };
      await this.jobManager.createTaskForJob(this.job.id, createTaskBody);

      await this.failJob(this.task.reason);
    } else {
      // For other task types, use the default implementation
      return super.handleFailedTask();
    }
  }
}
