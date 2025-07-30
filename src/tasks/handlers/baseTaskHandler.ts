import { Logger } from '@map-colonies/js-logger';
import { BadRequestError, ConflictError } from '@map-colonies/error-types';
import { ICreateTaskBody, ITaskResponse, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { IConfig, IJobDefinitionsConfig, JobAndTask, TaskTypeArray } from '../../common/interfaces';
import { createTaskParametersMapper } from '../../common/mappers';
import { ITaskHandler } from './interfaces';

/**
 * Base implementation for task-level operations
 */
export abstract class BaseTaskHandler implements ITaskHandler {
  protected readonly jobDefinitions: IJobDefinitionsConfig;

  public abstract handleTaskCompletion: () => Promise<void>;
  public abstract handleTaskFailure: () => Promise<void>;

  protected abstract readonly shouldBlockDuplicationForTypes: TaskTypeArray;
  protected abstract readonly tasksFlow: TaskTypeArray;
  protected abstract readonly excludedTypes: TaskTypeArray;

  protected constructor(
    protected readonly logger: Logger,
    protected readonly jobManager: JobManagerClient,
    protected readonly task: ITaskResponse<unknown>,
    protected readonly config: IConfig
  ) {
    this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
  }

  public createNextTask = async (taskType: string): Promise<void> => {
    const createTaskBody: ICreateTaskBody<unknown> = {
      type: taskType,
      parameters: this.getTaskParameters(this.task.jobId, taskType),
      blockDuplication: this.shouldBlockDuplicationForTypes.includes(taskType),
    };

    try {
      this.logger.info({
        msg: 'Creating task',
        jobId: this.task.jobId,
        taskType,
      });
      await this.jobManager.createTaskForJob(this.task.jobId, createTaskBody);
    } catch (error) {
      if (error instanceof ConflictError) {
        this.logger.warn({
          msg: 'Task already exists, skipping',
          jobId: this.task.jobId,
          taskType,
        });
        return;
      }
      throw error;
    }
  };

  public canProceedToNextTask = async (): Promise<boolean> => {
    const initTasks = await this.findInitTasks();
    if (initTasks === undefined) {
      this.logger.warn({
        msg: `Skipping init tasks completed validation, init tasks were not found`,
        jobId: this.task.jobId,
        taskId: this.task.id,
        taskType: this.task.type,
      });
      return true;
    }

    const job = await this.jobManager.getJob(this.task.jobId);
    const isPassed = this.isInitialWorkflowCompleted(job, initTasks);
    this.logger.info({
      msg: `Validation of init tasks completed`,
      jobId: this.task.jobId,
      taskId: this.task.id,
      taskType: this.task.type,
      isPassed,
    });
    return isPassed;
  };

  public getNextTaskType = (): string | undefined => {
    const indexOfCurrentTask = this.tasksFlow.indexOf(this.task.type);
    let nextTaskTypeIndex = indexOfCurrentTask + 1;

    while (nextTaskTypeIndex < this.tasksFlow.length && this.excludedTypes.includes(this.tasksFlow[nextTaskTypeIndex])) {
      nextTaskTypeIndex++;
    }

    return this.tasksFlow[nextTaskTypeIndex];
  };

  public shouldSkipTaskCreation = (taskType: string): boolean => {
    return this.excludedTypes.includes(taskType);
  };

  public getTaskParameters = (jobType: string, taskType: string): unknown => {
    const key: JobAndTask = `${jobType}_${taskType}`;
    const taskParametersMapper = createTaskParametersMapper(this.jobDefinitions);
    const parameters = taskParametersMapper.get(key);
    if (parameters === undefined) {
      this.logger.error({ msg: `task parameters for ${key} do not exist` });
      throw new BadRequestError(`task parameters for ${key} do not exist`);
    }
    return parameters;
  };

  protected async baseCanProceedToNextTask(): Promise<boolean> {
    return this.canProceedToNextTask();
  }

  protected async findInitTasks(): Promise<ITaskResponse<unknown>[] | undefined> {
    const tasks = await this.jobManager.findTasks({
      jobId: this.task.jobId,
      type: this.jobDefinitions.tasks.init,
    });
    return tasks ?? undefined;
  }

  private isInitialWorkflowCompleted(job: { completedTasks: number; taskCount: number }, initTasks: ITaskResponse<unknown>[]): boolean {
    return job.completedTasks === job.taskCount && initTasks.every((task) => task.status === OperationStatus.COMPLETED);
  }
}
