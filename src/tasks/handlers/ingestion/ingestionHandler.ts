import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import {
  IngestionValidationTaskParams,
  ingestionValidationTaskParamsSchema as baseIngestionValidationTaskParamsSchema,
} from '@map-colonies/raster-shared';
import { BadRequestError } from '@map-colonies/error-types';
import { IConfig, TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';

export type IngestionValidationTaskParameters = Pick<IngestionValidationTaskParams, 'isValid'>;
export const ingestionValidationTaskParamsSchema = baseIngestionValidationTaskParamsSchema
  .pick({
    isValid: true,
  })
  .required({ isValid: true });

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

  public isProceedable(task: ITaskResponse<IngestionValidationTaskParameters>): boolean {
    if (task.type !== this.jobDefinitions.tasks.validation) {
      return true;
    }

    const result = ingestionValidationTaskParamsSchema.safeParse(task.parameters);
    if (!result.success) {
      const errorMessage = `Failed to parse validation task parameters: ${result.error.message}`;
      this.logger.error({ message: errorMessage });
      throw new BadRequestError(errorMessage);
    }
    const taskParams = result.data;

    this.logger.info({
      msg: 'Checking if validation task is valid in order to proceed',
      jobId: this.job.id,
      jobType: this.job.type,
    });
    const isValid = task.status === OperationStatus.COMPLETED && taskParams.isValid;

    return isValid;
  }
}
