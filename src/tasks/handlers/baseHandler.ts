import { ICreateTaskBody, IJobResponse, ITaskResponse, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { Logger } from '@map-colonies/js-logger';
import { BadRequestError, ConflictError } from '@map-colonies/error-types';
import { IConfig, IJobDefinitionsConfig, JobAndTask, TaskTypeArray } from '../../common/interfaces';
import { JOB_COMPLETED_MESSAGE } from '../../common/constants';
import { taskParametersMapper } from '../../common/mappers';
import { calculateTaskPercentage } from '../../utils/taskUtils';

export abstract class BaseHandler {
  protected readonly jobManager: JobManagerClient;
  protected readonly jobDefinitions: IJobDefinitionsConfig;
  protected abstract readonly shouldBlockDuplicationForTypes: TaskTypeArray;
  protected abstract readonly tasksFlow: TaskTypeArray;
  protected abstract readonly excludedTypes: TaskTypeArray;

  protected constructor(
    protected readonly logger: Logger,
    protected readonly jobManagerClient: JobManagerClient,
    protected readonly config: IConfig,
    protected readonly job: IJobResponse<unknown, unknown>,
    protected readonly task: ITaskResponse<unknown>
  ) {
    this.jobManager = jobManagerClient;
    this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
  }

  public async handleCompletedNotification(): Promise<void> {
    const nextTaskType = this.getNextTaskType();

    if (nextTaskType == undefined) {
      await this.handleNoNextTask();
      return;
    }

    if (!(await this.canProceed()) || this.shouldSkipTaskCreation(nextTaskType)) {
      await this.handleSkipTask(nextTaskType);
      return;
    }

    await this.createNewTask(nextTaskType);
  }

  public async handleFailedTask(): Promise<void> {
    if (this.jobDefinitions.suspendingTaskTypes.includes(this.task.type)) {
      await this.suspendJob();
    } else {
      await this.failJob();
    }
  }

  protected async updateJobForHavingNewTask(nextTaskType: string): Promise<void> {
    const newTaskCount = this.job.taskCount + 1;
    const percentage = calculateTaskPercentage(this.job.completedTasks, newTaskCount);

    this.logger.debug({ msg: 'Task created, updating progress', jobId: this.job.id, taskType: nextTaskType });
    await this.updateJobPercentage(this.job.id, percentage);
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

  protected async canProceed(): Promise<boolean> {
    const initTasksOfJob = await this.findInitTasks();
    if (initTasksOfJob === undefined) {
      this.logger.warn({
        msg: `Skipping init tasks completed validation of job ${this.job.id} , init tasks were not found`,
        jobId: this.job.id,
        taskId: this.task.id,
        taskType: this.task.type,
        jobType: this.job.type,
      });
      return true;
    } else {
      const isPassed = this.isInitialWorkflowCompleted(initTasksOfJob);
      this.logger.info({
        msg: `Validation of init tasks completed for job ${this.job.id}`,
        jobId: this.job.id,
        taskId: this.task.id,
        taskType: this.task.type,
        isPassed: isPassed,
      });
      return isPassed;
    }
  }

  protected shouldSkipTaskCreation(taskType: string): boolean {
    return this.excludedTypes.includes(taskType);
  }

  private async handleNoNextTask(): Promise<void> {
    const percentage = calculateTaskPercentage(this.job.completedTasks, this.job.taskCount);

    if (this.isAllTasksCompleted()) {
      this.logger.info({ msg: 'Completing job', jobId: this.job.id });
      await this.completeJob();
    } else {
      this.logger.info({ msg: 'No next task, updating progress', jobId: this.job.id });
      await this.updateJobPercentage(this.job.id, percentage);
    }
  }

  private async handleSkipTask(nextTaskType: string): Promise<void> {
    this.logger.info({ msg: 'Skipping task creation', jobId: this.job.id, taskType: nextTaskType });
    const percentage = calculateTaskPercentage(this.job.completedTasks, this.job.taskCount);
    await this.updateJobPercentage(this.job.id, percentage);
  }

  private async createNewTask(nextTaskType: string): Promise<void> {
    const createTaskBody: ICreateTaskBody<unknown> = {
      type: nextTaskType,
      parameters: this.getTaskParameters(this.job.type, nextTaskType),
      blockDuplication: this.shouldBlockDuplicationForTypes.includes(nextTaskType),
    };

    try {
      this.logger.info({ msg: 'Creating task', jobId: this.job.id, taskType: nextTaskType });
      await this.jobManager.createTaskForJob(this.job.id, createTaskBody);
    } catch (error) {
      if (error instanceof ConflictError) {
        this.logger.warn({ msg: 'Task already exists, skipping', jobId: this.job.id, taskType: nextTaskType });
        return;
      }
      throw error;
    }

    await this.updateJobForHavingNewTask(nextTaskType);
  }

  private getTaskParameters(jobType: string, taskType: string): unknown {
    const key: JobAndTask = `${jobType}_${taskType}`;
    const parameters = taskParametersMapper.get(key);
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

  private isInitialWorkflowCompleted(initTasks: ITaskResponse<unknown>[]): boolean {
    return this.job.completedTasks === this.job.taskCount && initTasks.every((task) => task.status === OperationStatus.COMPLETED);
  }
}
