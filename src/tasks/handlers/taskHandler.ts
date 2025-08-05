import { BadRequestError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { IConfig, IJobDefinitionsConfig, JobAndTask, TaskTypes } from '../../common/interfaces';
import { createTaskParametersMapper } from '../../common/mappers';

/**
 * Utility class for workflow-specific task operations
 * This class is designed to be composed with job handlers to provide task-level functionality
 */
export class WorkflowTaskOperations {
  protected readonly jobDefinitions: IJobDefinitionsConfig;

  public constructor(
    protected readonly logger: Logger,
    protected readonly config: IConfig,
    protected readonly jobManager: JobManagerClient,
    protected readonly job: IJobResponse<unknown, unknown>,
    protected readonly task: ITaskResponse<unknown>,
    protected readonly tasksFlow: TaskTypes,
    protected readonly excludedTypes: TaskTypes
  ) {
    this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
  }

  public getTaskParameters(jobType: string, taskType: string): unknown {
    const key: JobAndTask = `${jobType}_${taskType}`;
    const taskParametersMapper = createTaskParametersMapper(this.jobDefinitions);
    const parameters = taskParametersMapper.get(key);
    if (parameters === undefined) {
      this.logger.error({ msg: `task parameters for ${key} do not exist` });
      throw new BadRequestError(`task parameters for ${key} do not exist`);
    }
    return parameters;
  }

  public getNextTaskType(): string | undefined {
    const indexOfCurrentTask = this.tasksFlow.indexOf(this.task.type);
    let nextTaskTypeIndex = indexOfCurrentTask + 1;
    while (this.excludedTypes.includes(this.tasksFlow[nextTaskTypeIndex])) {
      nextTaskTypeIndex++;
    }

    return this.tasksFlow[nextTaskTypeIndex];
  }

  public shouldSkipTaskCreation(taskType: string): boolean {
    return this.excludedTypes.includes(taskType);
  }

  public async findInitTasks(): Promise<ITaskResponse<unknown>[] | undefined> {
    const tasks = await this.jobManager.findTasks({ jobId: this.job.id, type: this.jobDefinitions.tasks.init });
    return tasks ?? undefined;
  }

  public isInitialWorkflowCompleted(initTasks: ITaskResponse<unknown>[]): boolean {
    return this.job.completedTasks === this.job.taskCount && initTasks.every((task) => task.status === OperationStatus.COMPLETED);
  }
}
