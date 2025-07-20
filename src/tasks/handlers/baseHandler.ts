import {
  ICreateTaskBody,
  IJobResponse,
  ITaskResponse,
  JobManagerClient,
  OperationStatus,
  TaskHandler as QueueClient,
} from '@map-colonies/mc-priority-queue';
import { Logger } from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { IConfig, IJobDefinitionsConfig, JobAndTask, TaskTypesArray } from '../../common/interfaces';
import { JOB_COMPLETED_MESSAGE } from '../../common/constants';
import { taskParameterMapper } from '../../common/mappers';
import { calculateTaskPercentage } from '../../utils/taskUtils';

export abstract class JobHandler {
  protected readonly jobManager: JobManagerClient;
  protected readonly jobDefinitions: IJobDefinitionsConfig;
  protected abstract readonly shouldBlockDuplicationForTypes: TaskTypesArray;
  protected abstract readonly tasksFlow: TaskTypesArray;
  protected abstract readonly excludedTypes: TaskTypesArray;

  protected constructor(
    protected readonly logger: Logger,
    protected readonly queueClient: QueueClient,
    protected readonly config: IConfig,
    protected readonly job: IJobResponse<unknown, unknown>,
    protected readonly task: ITaskResponse<unknown>
  ) {
    this.jobManager = this.queueClient.jobManagerClient;
    this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
  }

  public async createNextTask(): Promise<void> {
    const nextTaskType = this.getNextTaskType();
    const isLastTask = nextTaskType === undefined;

    if (isLastTask) {
      if (this.isAllTasksCompleted()) {
        await this.completeJob();
      } else {
        await this.updateJobPercentage(this.job.id, calculateTaskPercentage(this.job.completedTasks, this.job.taskCount));
      }
      return;
    }

    if (!(await this.canProceed()) || this.shouldSkipTaskCreation(nextTaskType)) {
      this.logger.info({ msg: `skipping current task creation for type ${nextTaskType} on job: ${this.job.id}` });
      await this.updateJobPercentage(this.job.id, calculateTaskPercentage(this.job.completedTasks, this.job.taskCount));
      return;
    }

    const taskParameters = this.getTaskParameters(this.job.type, nextTaskType);

    const createTaskBody: ICreateTaskBody<unknown> = {
      type: nextTaskType,
      parameters: taskParameters,
      blockDuplication: this.shouldBlockDuplicationForTypes.includes(nextTaskType),
    };

    this.logger.info({ msg: `Creating ${nextTaskType} task for job: ${this.job.id}` });
    await this.jobManager.createTaskForJob(this.job.id, createTaskBody);

    this.logger.debug({ msg: `Updating job percentage; No subsequence task for taskType ${this.task.type}` });
    await this.updateJobPercentage(this.job.id, calculateTaskPercentage(this.job.completedTasks, this.job.taskCount + 1));
  }

  public async handleFailedTask(): Promise<void> {
    if (this.jobDefinitions.suspendingTaskTypes.includes(this.task.type)) {
      await this.suspendJob();
    } else {
      await this.failJob();
    }
  }

  protected async failJob(): Promise<void> {
    const reason = this.task.reason;
    this.logger.info({ msg: `Failing job: ${this.job.id}`, reason: `Reason: ${reason}` });
    await this.jobManager.updateJob(this.job.id, { status: OperationStatus.FAILED, reason: reason });
  }

  protected async findInitTasks(): Promise<ITaskResponse<unknown>[] | undefined> {
    const tasks = await this.jobManager.findTasks({ jobId: this.job.id, type: this.jobDefinitions.tasks.init });
    return tasks ?? undefined;
  }

  private getTaskParameters(jobType: string, taskType: string): unknown {
    const key: JobAndTask = `${jobType}_${taskType}`;
    const parameters = taskParameterMapper.get(key);
    if (parameters === undefined) {
      this.logger.error({ msg: `task parameters for ${key} do not exist` });
      throw new BadRequestError(`task parameters for ${key} do not exist`);
    }
    return parameters;
  }

  private async completeJob(): Promise<void> {
    this.logger.info({ msg: `Completing job` });
    await this.jobManager.updateJob(this.job.id, { status: OperationStatus.COMPLETED, reason: JOB_COMPLETED_MESSAGE, percentage: 100 });
    this.logger.info({ msg: JOB_COMPLETED_MESSAGE });
  }

  private async suspendJob(): Promise<void> {
    const reason = this.task.reason;
    this.logger.info({ msg: `Suspending job: ${this.job.id}`, reason: `Reason: ${reason}` });
    await this.jobManager.updateJob(this.job.id, { status: OperationStatus.SUSPENDED, reason: reason });
  }

  private getNextTaskType(): string | undefined {
    const indexOfCurrentTask = this.tasksFlow.indexOf(this.task.type);
    let nextTaskTypeIndex = indexOfCurrentTask + 1;
    while (this.excludedTypes.includes(this.tasksFlow[nextTaskTypeIndex])) {
      nextTaskTypeIndex++;
    }
    return this.tasksFlow[nextTaskTypeIndex];
  }

  private async updateJobPercentage(jobId: string, desiredPercentage: number): Promise<void> {
    await this.jobManager.updateJob(jobId, { percentage: desiredPercentage });
    this.logger.info({ msg: `Updated percentages (${desiredPercentage}) for job: ${jobId}` });
  }

  private isAllTasksCompleted(): boolean {
    return this.job.completedTasks === this.job.taskCount;
  }

  public abstract canProceed(): Promise<boolean>;
  protected abstract shouldSkipTaskCreation(taskType: string): boolean;
}
