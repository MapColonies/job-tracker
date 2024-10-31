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
import {
  IngestionNewFinalizeTaskParams,
  IngestionUpdateFinalizeTaskParams,
  IngestionSwapUpdateFinalizeTaskParams,
} from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { IJobDefinitionsConfig } from '../../common/interfaces';
import { IrrelevantOperationStatusError } from '../../common/errors';
import { calculateTaskPercentage } from '../../utils/taskUtils';

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
    if (task.status === OperationStatus.FAILED) {
      await this.failJob(task.jobId);
    } else if (task.status === OperationStatus.COMPLETED) {
      const job = await this.jobManager.getJob(task.jobId);
      await this.handleCompletedTask(job, task);
    } else {
      throw new IrrelevantOperationStatusError(`Expected to get a 'Completed' or 'Failed' task' but instead got '${task.status}'`);
    }
  }

  private async handleCompletedTask(job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>): Promise<void> {
    const initTask = await this.findTask({ jobId: job.id, type: this.jobDefinitions.tasks.init });

    if (!initTask) {
      this.logger.debug({ msg: 'Skipping because init task was not found' });
      return;
    }

    if (initTask.status !== OperationStatus.COMPLETED) {
      this.logger.debug({ msg: 'Skipping because init task is not completed' });
      return;
    }

    const taskHasSubsequentTask = task.type === this.jobDefinitions.tasks.merge || task.type === this.jobDefinitions.tasks.polygonParts;

    if (job.completedTasks === job.taskCount && taskHasSubsequentTask) {
      await this.createNextTask(task.type, job);
    } else {
      this.logger.debug({ msg: 'Updating job percentage; no need for task creation' });
      const calculatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount);
      await this.updateJobPercentage(job.id, calculatedPercentage);
    }
  }

  private async failJob(jobId: string): Promise<void> {
    await this.jobManager.updateJob(jobId, { status: OperationStatus.FAILED });
    this.logger.info({ msg: `Failed job: ${jobId}` });
  }

  private async createTask(job: IJobResponse<unknown, unknown>, taskType: string): Promise<void> {
    let taskParameters: unknown = {};
    if (taskType === this.jobDefinitions.tasks.finalize) {
      switch (job.type) {
        case this.jobDefinitions.jobs.new: {
          (taskParameters as IngestionNewFinalizeTaskParams) = { insertedToCatalog: false, insertedToGeoServer: false, insertedToMapproxy: false };
          break;
        }
        case this.jobDefinitions.jobs.update: {
          (taskParameters as IngestionUpdateFinalizeTaskParams) = { updatedInCatalog: false };
          break;
        }
        case this.jobDefinitions.jobs.swapUpdate: {
          (taskParameters as IngestionSwapUpdateFinalizeTaskParams) = { updatedInCatalog: false, updatedInMapproxy: false };
          break;
        }
      }
    }
    const createTaskBody: ICreateTaskBody<unknown> = { type: taskType, parameters: taskParameters };
    await this.jobManager.createTaskForJob(job.id, createTaskBody);
    this.logger.info({ msg: `Created ${taskType} task for job: ${job.id}` });
  }

  private async findTask(body: IFindTaskRequest<unknown>): Promise<ITaskResponse<unknown> | undefined> {
    const task = await this.jobManager.findTasks(body);
    return task?.[0];
  }

  private async updateJobPercentage(jobId: string, desiredPercentage: number): Promise<void> {
    await this.jobManager.updateJob(jobId, { percentage: desiredPercentage });
    this.logger.info({ msg: `Updated percentages (${desiredPercentage}) for job: ${jobId}` });
  }

  private async createNextTask(currentTaskType: string, job: IJobResponse<unknown, unknown>): Promise<void> {
    let nextTaskType: string;
    switch (currentTaskType) {
      case this.jobDefinitions.tasks.merge:
        nextTaskType = this.jobDefinitions.tasks.polygonParts;
        break;
      case this.jobDefinitions.tasks.polygonParts:
        nextTaskType = this.jobDefinitions.tasks.finalize;
        break;
      default:
        return;
    }
    const existingTask = await this.jobManager.findTasks({ jobId: job.id, type: nextTaskType });
    if (existingTask) {
      return;
    }
    await this.createTask(job, nextTaskType);
    const calculatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount + 1);
    await this.updateJobPercentage(job.id, calculatedPercentage);
  }
}
