import { NotFoundError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import {
  IFindTaskRequest,
  IJobResponse,
  ITaskResponse,
  JobManagerClient,
  OperationStatus,
  TaskHandler as QueueClient,
} from '@map-colonies/mc-priority-queue';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IrrelevantOperationStatusError } from '../../common/errors';
import { IConfig, IJobDefinitionsConfig } from '../../common/interfaces';
import { getJobHandler } from '../handlers/jobHandlerFactory';

@injectable()
export class TasksManager {
  private readonly jobManager: JobManagerClient;
  private readonly jobDefinitions: IJobDefinitionsConfig;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.QUEUE_CLIENT) private readonly queueClient: QueueClient,
    @inject(SERVICES.CONFIG) private readonly config: IConfig
  ) {
    this.jobManager = this.queueClient.jobManagerClient;
    this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
  }

  public async handleTaskNotification(taskId: string): Promise<void> {
    this.logger.info({ msg: `Handling task notification for task id: ${taskId}` });
    const task = await this.findTask({ id: taskId });

    if (!task) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }

    // Early terminate if status is not COMPLETED or FAILED
    if (task.status !== OperationStatus.FAILED && task.status !== OperationStatus.COMPLETED) {
      throw new IrrelevantOperationStatusError(`Expected to get a 'Completed' or 'Failed' task' but instead got '${task.status}'`);
    }

    const job = await this.getJob(task.jobId);
    const handler = getJobHandler(job.type, this.jobDefinitions, this.logger, this.queueClient, this.config, job, task);

    if (task.status === OperationStatus.FAILED) {
      await handler.handleFailedTask();
    } else {
      await handler.handleCompletedNotification();
    }
  }

  private async findTask(body: IFindTaskRequest<unknown>): Promise<ITaskResponse<unknown> | undefined> {
    const task = await this.jobManager.findTasks(body);
    return task?.[0];
  }

  private async getJob(jobId: string): Promise<IJobResponse<unknown, unknown>> {
    return this.jobManager.getJob(jobId);
  }
}
