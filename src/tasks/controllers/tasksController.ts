import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { HttpError } from 'express-openapi-validator/dist/framework/types';

import { TasksManager } from '../models/tasksManager';
import { TaskNotificationRequest } from '../../common/interfaces';
import { IrrelevantOperationStatusError } from '../../common/errors';

type TaskNotificationHandler = RequestHandler<TaskNotificationRequest, undefined, undefined>;

@injectable()
export class TasksController {
  public constructor(@inject(TasksManager) private readonly taskManager: TasksManager) {}

  public handleTaskNotification: TaskNotificationHandler = async (req, res, next) => {
    try {
      await this.taskManager.handleTaskNotification(req.params.taskId);
      return res.status(httpStatus.OK).json();
    } catch (error) {
      if (error instanceof IrrelevantOperationStatusError) {
        (error as HttpError).status = httpStatus.PRECONDITION_REQUIRED;
      }
      next(error);
    }
  };
}
