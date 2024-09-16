import config from 'config';
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
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ITaskTypesConfig } from '../../common/interfaces';
import { IrrelevantOperationStatusError, TasksNotFoundError } from '../../common/errors';
import { calculateTaskPercentage } from '../../utils/taskUtils';

@injectable()
export class TasksManager {
  private readonly jobManager: JobManagerClient;
  private readonly taskTypes: ITaskTypesConfig;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.QUEUE_CLIENT) private readonly queueClient: QueueClient
  ) {
    this.jobManager = this.queueClient.jobManagerClient;
    this.taskTypes = config.get<ITaskTypesConfig>('taskTypes');
  }

  public async handleTaskNotification(taskId: string) {
    const task = await this.findTask({ id: taskId });
    if (task === undefined) throw new TasksNotFoundError(`Task ${taskId} not found`);
    if (task?.status === OperationStatus.FAILED) {
      await this.failJob(task.jobId);
      this.logger.info({ msg: `Failed job: ${task.jobId}` });
    } else if (task?.status === OperationStatus.COMPLETED) {
      const job = await this.jobManager.getJob(task.jobId);
      await this.compareAndUpdateJobPercentage(job, task);
    } else {
      throw new IrrelevantOperationStatusError(`Expected to get a 'Completed' or 'Failed' task' but instead got '${task?.status}'`);
    }
  }

  public async compareAndUpdateJobPercentage(job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>) {
    const initTask = await this.findTask({ jobId: job.id, type: this.taskTypes.init });
    if (initTask?.status === OperationStatus.COMPLETED) {
      if (job.completedTasks === job.taskCount) {
        switch (task.type) {
          case this.taskTypes.tilesMerging: {
            const polygonPartsTask = await this.jobManager.findTasks({ jobId: job.id, type: this.taskTypes.polygonParts });
            if (polygonPartsTask?.length) {
              break;
            }

            await this.createTask(job.id, { type: this.taskTypes.polygonParts, parameters: {} });
            const updatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount + 1);
            await this.updateJobPercentage(job.id, updatedPercentage);
            break;
          }

          case this.taskTypes.polygonParts: {
            const finalizeTask = await this.jobManager.findTasks({ jobId: job.id, type: this.taskTypes.finalize });
            if (finalizeTask?.length) {
              break;
            }

            await this.createTask(job.id, { type: this.taskTypes.finalize, parameters: {} });
            const updatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount + 1);
            await this.updateJobPercentage(job.id, updatedPercentage);
            break;
          }

          default:
            this.logger.debug({ msg: 'Skipping task creation' });
            const updatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount);
            await this.updateJobPercentage(job.id, updatedPercentage);
            break;
        }
      } else {
        const updatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount);
        await this.updateJobPercentage(job.id, updatedPercentage);
      }
    } else if (initTask === undefined) {
      this.logger.debug({ msg: 'Did nothing because init task was not found' });
    } else {
      this.logger.debug({ msg: 'Did nothing because init task is not completed' });
    }
  }

  public async failJob(jobId: string) {
    await this.jobManager.updateJob(jobId, { status: OperationStatus.FAILED });
  }

  public async createTask(jobId: string, taskBody: ICreateTaskBody<unknown>) {
    await this.jobManager.createTaskForJob(jobId, taskBody);
    this.logger.info({ msg: `Created ${taskBody.type} task for job: ${jobId}` });
  }

  public async findTask(body: IFindTaskRequest<unknown>): Promise<ITaskResponse<unknown> | undefined> {
    const task = await this.jobManager.findTasks(body);
    return task?.[0];
  }

  public async updateJobPercentage(jobId: string, desiredPercentage: number) {
    await this.jobManager.updateJob(jobId, { percentage: desiredPercentage });
    this.logger.info({ msg: `Updated percentages for job: ${jobId}` });
  }
}
