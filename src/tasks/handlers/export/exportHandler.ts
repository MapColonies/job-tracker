import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { injectable, inject } from 'tsyringe';
import { IConfig, TaskTypeArray } from '../../../common/interfaces';
import { SERVICES } from '../../../common/constants';
import { BaseHandler } from '../baseHandler';
import { IValidationStrategy, FinalizeValidationStrategy, DefaultValidationStrategy } from './validationStrategies';

@injectable()
export class ExportJobHandler extends BaseHandler {
  protected tasksFlow: TaskTypeArray;
  protected excludedTypes: TaskTypeArray;
  protected shouldBlockDuplicationForTypes: TaskTypeArray;

  public constructor(
    @inject(SERVICES.LOGGER) logger: Logger,
    @inject(SERVICES.CONFIG) config: IConfig,
    jobManagerClient: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, jobManagerClient, config, job, task);
    this.tasksFlow = this.config.get<TaskTypeArray>('taskFlowManager.exportTasksFlow');
    this.excludedTypes = this.config.get<TaskTypeArray>('taskFlowManager.exportCreationExcludedTaskTypes');
    this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.export];

    // Create validation strategy as a helper to set up method bindings
    const validationStrategy = this.createValidationStrategy();
    this.canProceed = async (): Promise<boolean> => validationStrategy.canProceed();
    this.handleFailedTask = async (): Promise<void> => validationStrategy.handleFailedTask();
  }

  private createValidationStrategy(): IValidationStrategy {
    switch (this.task.type) {
      case this.jobDefinitions.tasks.finalize:
        return new FinalizeValidationStrategy(this.task, super.canProceed.bind(this), super.handleFailedTask.bind(this));
      default:
        return new DefaultValidationStrategy(
          this.logger,
          this.jobManager,
          this.task,
          super.canProceed.bind(this),
          this.updateJobForHavingNewTask.bind(this),
          this.failJob.bind(this),
          this.shouldBlockDuplicationForTypes,
          this.jobDefinitions
        );
    }
  }
}
