import { Logger } from '@map-colonies/js-logger';
import { BadRequestError, ConflictError } from '@map-colonies/error-types';
import { IJobResponse, ITaskResponse, JobManagerClient, OperationStatus, ICreateTaskBody } from '@map-colonies/mc-priority-queue';
import { IConfig, IJobDefinitionsConfig, TaskTypeArray, JobAndTask } from '../../common/interfaces';
import { calculateTaskPercentage } from '../../utils/taskUtils';
import { createTaskParametersMapper } from '../../common/mappers';
import { BaseJobHandler } from './baseJobHandler';

/**
 * Base class for workflow-enabled job handlers that handles task flow logic
 */
export abstract class WorkflowJobHandler extends BaseJobHandler {
  protected readonly config: IConfig;
  protected readonly jobDefinitions: IJobDefinitionsConfig;
  protected readonly task: ITaskResponse<unknown>;
  protected abstract readonly tasksFlow: TaskTypeArray;
  protected abstract readonly excludedTypes: TaskTypeArray;
  protected abstract readonly shouldBlockDuplicationForTypes: TaskTypeArray;

  protected constructor(
    logger: Logger,
    config: IConfig,
    jobManager: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, jobManager, job);
    this.config = config;
    this.task = task;
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
      await this.suspendJob(this.task.reason);
    } else {
      await this.failJob(this.task.reason);
    }
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

  private async findInitTasks(): Promise<ITaskResponse<unknown>[] | undefined> {
    const tasks = await this.jobManager.findTasks({ jobId: this.job.id, type: this.jobDefinitions.tasks.init });
    return tasks ?? undefined;
  }

  private async handleNoNextTask(): Promise<void> {
    const percentage = calculateTaskPercentage(this.job.completedTasks, this.job.taskCount);

    if (this.isAllTasksCompleted()) {
      this.logger.info({ msg: 'Completing job', jobId: this.job.id });
      await this.completeJob();
    } else {
      this.logger.info({ msg: 'No next task, updating progress', jobId: this.job.id });
      await this.updateJobProgress(percentage);
    }
  }

  private async handleSkipTask(nextTaskType: string): Promise<void> {
    this.logger.info({ msg: 'Skipping task creation', jobId: this.job.id, taskType: nextTaskType });
    const percentage = calculateTaskPercentage(this.job.completedTasks, this.job.taskCount);
    await this.updateJobProgress(percentage);
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
    const taskParametersMapper = createTaskParametersMapper(this.jobDefinitions);
    const parameters = taskParametersMapper.get(key);
    if (parameters === undefined) {
      this.logger.error({ msg: `task parameters for ${key} do not exist` });
      throw new BadRequestError(`task parameters for ${key} do not exist`);
    }
    return parameters;
  }

  private getNextTaskType(): string | undefined {
    const indexOfCurrentTask = this.tasksFlow.indexOf(this.task.type);
    let nextTaskTypeIndex = indexOfCurrentTask + 1;
    while (this.excludedTypes.includes(this.tasksFlow[nextTaskTypeIndex])) {
      nextTaskTypeIndex++;
    }

    return this.tasksFlow[nextTaskTypeIndex];
  }

  private isInitialWorkflowCompleted(initTasks: ITaskResponse<unknown>[]): boolean {
    return this.job.completedTasks === this.job.taskCount && initTasks.every((task) => task.status === OperationStatus.COMPLETED);
  }
}
