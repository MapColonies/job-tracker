import { BadRequestError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { IConfig, IJobDefinitionsConfig } from '../../common/interfaces';
import { JobHandler } from './baseHandler';
import { IngestionJobHandler } from './ingestion/ingestionHandler';
import { ExportJobHandler } from './export/exportHandler';

export function initJobHandler(
  jobHandlerType: string,
  jobDefinitions: IJobDefinitionsConfig,
  logger: Logger,
  queueClient: QueueClient,
  config: IConfig,
  job: IJobResponse<unknown, unknown>,
  task: ITaskResponse<unknown>
): JobHandler {
  switch (jobHandlerType) {
    case jobDefinitions.jobs.new:
    case jobDefinitions.jobs.update:
    case jobDefinitions.jobs.swapUpdate:
    case jobDefinitions.jobs.seed:
      return new IngestionJobHandler(logger, queueClient, config, job, task);
    case jobDefinitions.jobs.export:
      return new ExportJobHandler(logger, queueClient, config, job, task);

    default:
      throw new BadRequestError(`${jobHandlerType} job type is invalid`);
  }
}
