import { IJobResponse, ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { Logger } from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { IngestionValidationTaskParameters, ingestionValidationTaskParamsSchema } from '../../handlers/ingestion/ingestionHandler';
import { TaskProceedRule } from '../../handlers/interfaces';

export class ValidationProceedRule implements TaskProceedRule<IngestionValidationTaskParameters> {
  public isProceedable(
    task: ITaskResponse<IngestionValidationTaskParameters>,
    context: { logger: Logger; job: IJobResponse<unknown, unknown> }
  ): boolean {
    const result = ingestionValidationTaskParamsSchema.safeParse(task.parameters);

    if (!result.success) {
      const errorMessage = `Failed to parse validation task parameters: ${result.error.message}`;
      context.logger.error({ msg: errorMessage });
      throw new BadRequestError(errorMessage);
    }

    context.logger.info({
      msg: 'Checking if validation task is valid in order to proceed',
      jobId: context.job.id,
      jobType: context.job.type,
    });

    return task.status === OperationStatus.COMPLETED && result.data.isValid;
  }
}
