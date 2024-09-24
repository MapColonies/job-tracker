import { IConfig } from 'config';
import { Logger } from '@map-colonies/js-logger';
import {
  TaskHandler as QueueClient,
  OperationStatus,
  ICreateTaskBody,
  ITaskResponse,
  IFindTaskRequest,
  JobManagerClient,
  IJobResponse,
} from '@map-colonies/mc-priority-queue';
import { NotFoundError } from '@map-colonies/error-types';
import { IngestionNewFinalizeTaskParams } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ITaskTypesConfig } from '../../common/interfaces';
import { InvalidArgumentError, IrrelevantOperationStatusError } from '../../common/errors';
import { calculateTaskPercentage } from '../../utils/taskUtils';

@injectable()
export class TasksManager {
  private readonly jobManager: JobManagerClient;
  private readonly taskTypes: ITaskTypesConfig;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.QUEUE_CLIENT) private readonly queueClient: QueueClient,
    @inject(SERVICES.CONFIG) private readonly config: IConfig
  ) {
    this.jobManager = this.queueClient.jobManagerClient;
    this.taskTypes = this.config.get<ITaskTypesConfig>('taskTypes');
  }

  public async handleTaskNotification(taskId: string): Promise<void> {
    this.logger.info({ msg: `Handling task notification for task id: ${taskId}` });
    const task = await this.findTask({ id: taskId });
    if (!task) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    if (task.status === OperationStatus.FAILED) {
      await this.failJob(task.jobId);
    } else if (task.status === OperationStatus.COMPLETED) {
      const job = await this.jobManager.getJob(task.jobId);
      await this.handleCompletedTask(job, task);
    } else {
      throw new IrrelevantOperationStatusError(`Expected to get a 'Completed' or 'Failed' task' but instead got '${task.status}'`);
    }
  }

  public async handleCompletedTask(job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>): Promise<void> {
    const initTask = await this.findTask({ jobId: job.id, type: this.taskTypes.init });

    if (!initTask) {
      this.logger.debug({ msg: 'Skipping because init task was not found' });
      return;
    }

    if (initTask.status !== OperationStatus.COMPLETED) {
      this.logger.debug({ msg: 'Skipping because init task is not completed' });
      return;
    }

    const taskHasSubsequentTask = task.type === this.taskTypes.tilesMerging || task.type === this.taskTypes.polygonParts;

    if (job.completedTasks === job.taskCount && taskHasSubsequentTask) {
      await this.createNextTask(task.type, job);
    } else {
      this.logger.debug({ msg: 'Updating job percentage; no need for task creation' });
      await this.updateJobPercentage(job.id, calculateTaskPercentage(job.completedTasks, job.taskCount));
    }
  }

  public async failJob(jobId: string): Promise<void> {
    await this.jobManager.updateJob(jobId, { status: OperationStatus.FAILED });
    this.logger.info({ msg: `Failed job: ${jobId}` });
  }

  public async createTask(jobId: string, taskType: string): Promise<void> {
    let createTaskBody: ICreateTaskBody<unknown>;
    if (taskType === this.taskTypes.finalize) {
      const taskParameters: IngestionNewFinalizeTaskParams = { insertedToCatalog: false, insertedToGeoServer: false, insertedToMapproxy: false };
      createTaskBody = { type: taskType, parameters: taskParameters };
    } else {
      createTaskBody = { type: taskType, parameters: {} };
    }
    await this.jobManager.createTaskForJob(jobId, createTaskBody);
    this.logger.info({ msg: `Created ${taskType} task for job: ${jobId}` });
  }

  public async findTask(body: IFindTaskRequest<unknown>): Promise<ITaskResponse<unknown> | undefined> {
    const task = await this.jobManager.findTasks(body);
    return task?.[0];
  }

  public async updateJobPercentage(jobId: string, desiredPercentage: number): Promise<void> {
    await this.jobManager.updateJob(jobId, { percentage: desiredPercentage });
    this.logger.info({ msg: `Updated percentages for job: ${jobId}` });
  }

  public async createNextTask(currentTaskType: string, job: IJobResponse<unknown, unknown>): Promise<void> {
    let nextTaskType: string;
    switch (currentTaskType) {
      case this.taskTypes.tilesMerging:
        nextTaskType = this.taskTypes.polygonParts;
        break;
      case this.taskTypes.polygonParts:
        nextTaskType = this.taskTypes.finalize;
        break;
      default:
        throw new InvalidArgumentError(`No subsequent task is defined for task type '${currentTaskType}'`);
    }

    const existingTask = await this.jobManager.findTasks({ jobId: job.id, type: nextTaskType });
    if (!existingTask) {
      await this.createTask(job.id, nextTaskType);
      await this.updateJobPercentage(job.id, calculateTaskPercentage(job.completedTasks, job.taskCount + 1));
    }
  }
}
