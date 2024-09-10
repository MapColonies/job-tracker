import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';

import { JobsManager } from '../models/jobsManager';

interface TaskId {
  jobId: string;
  taskId: string;
}

type NotifyTaskFinishedHandler = RequestHandler<TaskId, undefined, undefined>;

@injectable()
export class JobsController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JobsManager) private readonly manager: JobsManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {}

  public notifyTaskFinished: NotifyTaskFinishedHandler = (req, res) => {
    return res.status(httpStatus.NOT_IMPLEMENTED).json();
  };
}
