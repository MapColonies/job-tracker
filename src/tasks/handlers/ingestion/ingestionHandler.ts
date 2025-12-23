import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import {
  IngestionValidationTaskParams,
  ingestionValidationTaskParamsSchema as baseIngestionValidationTaskParamsSchema,
} from '@map-colonies/raster-shared';
import { IConfig, TaskTypes } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { JobHandler } from '../jobHandler';
import { ValidationProceedRule } from '../../rules/ingestion/validationProceedRule';
import { TaskProceedRule } from '../interfaces';

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

    this.proceedRules.set(this.jobDefinitions.tasks.validation, new ValidationProceedRule() as TaskProceedRule);
  }
}
