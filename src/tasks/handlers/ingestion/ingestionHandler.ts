import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { BaseIngestionValidationTaskParams } from '@map-colonies/raster-shared';
import { IConfig, TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';

@injectable()
export class IngestionJobHandler extends JobHandler {
  protected readonly tasksFlow: TaskTypes;
  protected readonly excludedTypes: TaskTypes;
  protected readonly blockedDuplicationTypes: TaskTypes;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManagerClient, job, task);
    this.tasksFlow = this.config.get<TaskTypes>('taskFlowManager.ingestionTasksFlow');
    this.excludedTypes = [this.jobDefinitions.tasks.merge];
    this.blockedDuplicationTypes = [
      this.jobDefinitions.tasks.validation,
      this.jobDefinitions.tasks.mergeTaskCreation,
      this.jobDefinitions.tasks.finalize,
    ];

    // Initialize task operations after setting up the flow properties
    this.initializeTaskOperations();
  }

  public isProceedable(initTasks: ITaskResponse<BaseIngestionValidationTaskParams>[]): { result: boolean; reason?: string } {
    this.logger.info({
      msg: 'Checking if validation task is valid in order to proceed',
      jobId: this.job.id,
      jobType: this.job.type,
    });
    const areValid = initTasks.every((initTask) => initTask.parameters.isValid);
    const isProceedable = {
      result: areValid,
      ...(!areValid ? { reason: "Invalid validation task" } : {})
    };
    return isProceedable;
  }

  protected async getJobInitialTasks(): Promise<ITaskResponse<unknown>[] | undefined> {
    const tasks = await this.jobManager.findTasks({ jobId: this.job.id, type: this.jobDefinitions.tasks.validation });
    return tasks ?? undefined;
  }
}
