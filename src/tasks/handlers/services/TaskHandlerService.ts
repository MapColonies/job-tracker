import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse, JobManagerClient, ICreateTaskBody } from '@map-colonies/mc-priority-queue';
import { ConflictError } from '@map-colonies/error-types';
import { ITaskHandler } from '../interfaces/ITaskHandler';
import { TaskTypeArray } from '../../../common/interfaces';

export class TaskHandlerService implements ITaskHandler {
  public constructor(
    private readonly logger: Logger,
    private readonly jobManager: JobManagerClient
  ) {}

  public async createNewTask(jobId: string, taskBody: ICreateTaskBody<unknown>): Promise<void> {
    try {
      this.logger.info({ msg: 'Creating task', jobId, taskType: taskBody.type });
      await this.jobManager.createTaskForJob(jobId, taskBody);
    } catch (error) {
      if (error instanceof ConflictError) {
        this.logger.warn({ msg: 'Task already exists, skipping', jobId, taskType: taskBody.type });
        return;
      }
      throw error;
    }
  }

  public async findInitTasks(jobId: string): Promise<ITaskResponse<unknown>[] | undefined> {
    const tasks = await this.jobManager.findTasks({ jobId, type: 'init' });
    return tasks ?? undefined;
  }

  public getNextTaskType(
    currentTaskType: string, 
    tasksFlow: TaskTypeArray, 
    excludedTypes: TaskTypeArray
  ): string | undefined {
    const indexOfCurrentTask = tasksFlow.indexOf(currentTaskType);
    let nextTaskTypeIndex = indexOfCurrentTask + 1;
    
    while (excludedTypes.includes(tasksFlow[nextTaskTypeIndex])) {
      nextTaskTypeIndex++;
    }

    return tasksFlow[nextTaskTypeIndex];
  }
}
