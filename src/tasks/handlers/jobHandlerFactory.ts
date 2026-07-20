import { BadRequestError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import type { IJobResponse, ITaskResponse, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import type { ConfigType } from '@src/common/config';
import type { IJobDefinitionsConfig } from '../../common/interfaces';
import type { JobHandler } from './jobHandler';
import { IngestionJobHandler } from './ingestion/ingestionHandler';
import { ExportJobHandler } from './export/exportHandler';
import { SeedJobHandler } from './seed/seedHandler';
import { DeleteLayerJobHandler } from './deleteLayer/deleteLayerHandler';

export function getJobHandler(
  jobHandlerType: string,
  jobDefinitions: IJobDefinitionsConfig,
  logger: Logger,
  queueClient: QueueClient,
  config: ConfigType,
  job: IJobResponse<unknown, unknown>,
  task: ITaskResponse<unknown>
): JobHandler {
  const jobManagerClient = queueClient.jobManagerClient;

  switch (jobHandlerType) {
    case jobDefinitions.jobs.new:
    case jobDefinitions.jobs.update:
    case jobDefinitions.jobs.swapUpdate: {
      return new IngestionJobHandler(logger, config, jobManagerClient, job, task);
    }
    case jobDefinitions.jobs.export: {
      return new ExportJobHandler(logger, config, jobManagerClient, job, task);
    }
    case jobDefinitions.jobs.seed: {
      return new SeedJobHandler(logger, config, jobManagerClient, job, task);
    }
    case jobDefinitions.jobs.deleteLayer: {
      return new DeleteLayerJobHandler(logger, config, jobManagerClient, job, task);
    }
    default:
      throw new BadRequestError(`${jobHandlerType} job type is invalid`);
  }
}
