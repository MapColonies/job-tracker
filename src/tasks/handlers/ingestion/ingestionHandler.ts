import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';
import { BaseIngestionValidationTaskParams } from '@map-colonies/raster-shared';

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
    this.excludedTypes = [this.jobDefinitions.tasks.merge, this.jobDefinitions.tasks.seed];
    this.blockedDuplicationTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts];

    // Initialize task operations after setting up the flow properties
    this.initializeTaskOperations();
  }

  protected override areInitialTasksReady(initTasksOfJob: ITaskResponse<BaseIngestionValidationTaskParams>[] | undefined): boolean {
    if (initTasksOfJob === undefined || initTasksOfJob.length === 0) {
      this.logger.warn({
        msg: `Cannot proceed with task creation for job ${this.job.id}, initial tasks of ingestion job were not found`,
        jobId: this.job.id,
        taskType: this.task.type,
        jobType: this.job.type,
      });
      return false;
    }
    this.logger.info({
      msg: `checking if init tasks completed for job ${this.job.id}`,
      jobId: this.job.id,
      taskId: this.task.id,
      taskType: this.task.type,
    });
    const isInitialCompleted = this.taskWorker?.isInitialWorkflowCompleted(initTasksOfJob) ?? false;
    const isValid = initTasksOfJob.some((initTask) => initTask.parameters.isValid === false);

    return isInitialCompleted && isValid;
  }
}
