import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { HttpError } from 'express-openapi-validator/dist/framework/types';
import { SERVICES } from '../../common/constants';

import { TasksManager } from '../models/tasksManager';
import { TaskNotificationRequest } from '../../common/interfaces';
import { IrrelevantOperationStatusError, TasksNotFoundError } from '../../common/errors';

type TaskNotificationHandler = RequestHandler<TaskNotificationRequest, undefined, undefined>;

@injectable()
export class TasksController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METER) private readonly meter: Meter,
    @inject(TasksManager) private readonly manager: TasksManager
  ) {}

  public handleTaskNotification: TaskNotificationHandler = async (req, res, next) => {
    try {
      await this.manager.handleTaskNotification(req.params.taskId);
      return res.status(httpStatus.OK).json();
    } catch (error) {
      if (error instanceof IrrelevantOperationStatusError) {
        (error as HttpError).status = httpStatus.PRECONDITION_REQUIRED;
      }
      if (error instanceof TasksNotFoundError) {
        (error as HttpError).status = httpStatus.NOT_FOUND;
      }
      next(error);
    }
  };
}
