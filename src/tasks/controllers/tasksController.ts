import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';

import { TasksManager } from '../models/tasksManager';

interface TaskId {
  taskId: string;
}

type NotifyTaskFinishedHandler = RequestHandler<TaskId, undefined, undefined>;

@injectable()
export class TasksController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(TasksManager) private readonly manager: TasksManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {}

  public handleTaskNotification: NotifyTaskFinishedHandler = (req, res) => {
    return res.status(httpStatus.NOT_IMPLEMENTED).json();
  };
}
