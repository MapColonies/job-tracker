import { Logger } from '@map-colonies/js-logger';
import { ConflictError, UnprocessableEntityError } from '@map-colonies/error-types';
import { IJobResponse, ITaskResponse, JobManagerClient, ICreateTaskBody } from '@map-colonies/mc-priority-queue';
import { IConfig, IJobDefinitionsConfig, TaskTypes } from '../../common/interfaces';
import { BaseJobHandler } from './baseJobHandler';
import { TaskHandler } from './taskHandler';

/**
 * Base class for workflow-enabled job handlers that handles task flow logic
 */
export abstract class JobHandler extends BaseJobHandler {
  protected readonly config: IConfig;
  protected readonly jobDefinitions: IJobDefinitionsConfig;
  protected readonly task: ITaskResponse<unknown>;
  protected taskWorker?: TaskHandler;
  protected abstract readonly tasksFlow: TaskTypes;
  protected abstract readonly excludedTypes: TaskTypes;
  protected abstract readonly blockedDuplicationTypes: TaskTypes;

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
    const nextTaskType = this.taskWorker?.getNextTaskType();

    if (nextTaskType == undefined) {
      await this.handleNoNextTask();
      return;
    }

    const initTasksOfJob = await this.getJobInitialTasks();
    if (initTasksOfJob === undefined || initTasksOfJob.length === 0) {
      this.logger.warn({
        msg: `Cannot proceed with task creation for job ${this.job.id}, init tasks were not found`,
        jobId: this.job.id,
        taskId: this.task.id,
        taskType: this.task.type,
        jobType: this.job.type,
      });
      throw new UnprocessableEntityError('no init task found');
    }

    const isProceedable = this.isProceedable(initTasksOfJob); // in case of completed task but with errors
    if (!isProceedable.result) {
      this.logger.info({ msg: `job is not proceedable, suspending job id: ${this.job.id}`, jobId: this.job.id, taskId: this.task.id, reason: isProceedable.reason })
      await this.suspendJob(isProceedable.reason);
      return;
    }

    const shouldSkipTaskCreation = this.taskWorker?.shouldSkipTaskCreation(nextTaskType);
    const isReadyForNextTask = this.isReadyForNextTask();
    if (!isReadyForNextTask || shouldSkipTaskCreation) {
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

  protected initializeTaskOperations(): void {
    this.taskWorker = new TaskHandler(this.logger, this.config, this.jobManager, this.job, this.task, this.tasksFlow, this.excludedTypes);
  }

  protected async getJobInitialTasks(): Promise<ITaskResponse<unknown>[] | undefined> {
    const tasks = await this.jobManager.findTasks({ jobId: this.job.id, type: this.jobDefinitions.tasks.init });
    return tasks ?? undefined;
  }

  protected isReadyForNextTask(): boolean {
    this.logger.info({
      msg: `checking if job is ready to for the next type ${this.job.id}`,
      jobId: this.job.id,
      taskId: this.task.id,
      taskType: this.task.type,
    });
    return this.job.completedTasks === this.job.taskCount;
  }

  private async handleNoNextTask(): Promise<void> {
    if (this.isJobCompleted(this.task.type)) {
      this.logger.info({ msg: 'Completing job', jobId: this.job.id });
      await this.completeJob();
    } else {
      this.logger.info({ msg: 'No next task, updating progress', jobId: this.job.id });
      await this.updateJobProgress();
    }
  }

  private async handleSkipTask(nextTaskType: string): Promise<void> {
    this.logger.info({ msg: 'Skipping task creation', jobId: this.job.id, taskType: nextTaskType });
    await this.updateJobProgress();
  }

  private async createNewTask(nextTaskType: string): Promise<void> {
    const createTaskBody: ICreateTaskBody<unknown> = {
      type: nextTaskType,
      parameters: this.taskWorker?.getTaskParameters(this.job.type, nextTaskType),
      blockDuplication: this.blockedDuplicationTypes.includes(nextTaskType),
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

    this.job.taskCount++;
    await this.updateJobProgress();
  }

  // Abstract methods that concrete handlers must implement
  public abstract isProceedable(initTask: ITaskResponse<unknown>[]): { result: boolean; reason?: string };
}
