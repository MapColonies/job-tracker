import { BadRequestError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { IConfig, IJobDefinitionsConfig, JobAndTask, TaskTypes, TaskType as TaskTypeItem } from '../../common/interfaces';
import { createTaskParametersMapper } from '../../common/mappers';

/**
 * Utility class for workflow-specific task operations
 * This class is designed to be composed with job handlers to provide task-level functionality
 */
export class TaskHandler {
  protected readonly jobDefinitions: IJobDefinitionsConfig;
  private readonly taskParametersMapper: Map<JobAndTask, Record<PropertyKey, unknown>>;

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
    this.taskParametersMapper = createTaskParametersMapper(this.jobDefinitions);
  }

  public getTaskParameters(jobType: string, taskType: string): Record<PropertyKey, unknown> {
    const key: JobAndTask = `${jobType}_${taskType}`;
    const parameters = this.taskParametersMapper.get(key);
    if (parameters === undefined) {
      this.logger.error({ msg: `task parameters for ${key} do not exist` });
      throw new BadRequestError(`task parameters for ${key} do not exist`);
    }
    return parameters;
  }

  public getNextTaskType(): TaskTypeItem | undefined {
    const indexOfCurrentTask = this.tasksFlow.indexOf(this.task.type);

    // Handle case where current task type is not found in the flow
    if (indexOfCurrentTask < 0) {
      this.logger.error({
        msg: 'Current task type not found in task flow',
        taskType: this.task.type,
        tasksFlow: this.tasksFlow,
      });
      return undefined;
    }

    let nextTaskTypeIndex = indexOfCurrentTask + 1;

    // Find the next task that should not be skipped, with bounds checking
    while (nextTaskTypeIndex < this.tasksFlow.length && this.shouldSkipTaskCreation(this.tasksFlow[nextTaskTypeIndex])) {
      nextTaskTypeIndex++;
    }

    // Return undefined if we've reached the end of the flow
    if (nextTaskTypeIndex >= this.tasksFlow.length) {
      return undefined;
    }

    return this.tasksFlow[nextTaskTypeIndex];
  }

  public shouldSkipTaskCreation(taskType: string): boolean {
    return this.excludedTypes.includes(taskType);
  }
}
