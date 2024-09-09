import { Logger } from '@map-colonies/js-logger';
import { BoundCounter, Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';

import { IJobsModel, JobsManager } from '../models/jobsManager';

interface taskId {
  jobId: string;
  taskId: string;
}

type CreateResourceHandler = RequestHandler<taskId, IJobsModel, IJobsModel>;
type GetResourceHandler = RequestHandler<undefined, IJobsModel>;

@injectable()
export class JobsController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JobsManager) private readonly manager: JobsManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

  public getResource: GetResourceHandler = (req, res) => {
    return res.status(httpStatus.OK).json(this.manager.getResource());
  };

  public createResource: CreateResourceHandler = (req, res) => {
    return res.status(httpStatus.NOT_IMPLEMENTED).json();
  };
}
