import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypeArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { WorkflowJobHandler } from '../workflowJobHandler';

@injectable()
export class ExportJobHandler extends WorkflowJobHandler {
  protected readonly tasksFlow: TaskTypeArray;
  protected readonly excludedTypes: TaskTypeArray;
  protected readonly shouldBlockDuplicationForTypes: TaskTypeArray;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManagerClient, job, task);
    this.tasksFlow = this.config.get<TaskTypeArray>('taskFlowManager.exportTasksFlow');
    this.excludedTypes = this.config.get<TaskTypeArray>('taskFlowManager.exportCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.export];

    // Initialize task operations after setting up the flow properties
    this.initializeTaskOperations();
  }

  public async handleFailedTask(): Promise<void> {
    // For export tasks, create a finalize error callback task and fail the job
    if (this.task.type === this.jobDefinitions.tasks.export) {
      const createTaskBody = {
        parameters: { callbacksSent: false, type: 'ErrorCallback' },
        type: this.jobDefinitions.tasks.finalize,
        blockDuplication: false,
      };
      await this.jobManager.createTaskForJob(this.job.id, createTaskBody);
      // Update job progress after creating the task
      await this.updateJobForHavingNewTask(this.jobDefinitions.tasks.finalize);
      // Also fail the job
      await this.failJob(this.task.reason);
    } else {
      // For other task types, use the default implementation
      return super.handleFailedTask();
    }
  }

  protected async canProceed(): Promise<boolean> {
    // For now, use the default implementation from the parent class
    return super.canProceed();
  }
}
