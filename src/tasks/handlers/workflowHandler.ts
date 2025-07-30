import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { IConfig, IJobDefinitionsConfig } from '../../common/interfaces';
import { calculateTaskPercentage } from '../../utils/taskUtils';
import { IJobHandler, ITaskHandler, IWorkflowHandler } from './interfaces';

/**
 * Workflow handler that orchestrates job and task operations
 */
export class WorkflowHandler implements IWorkflowHandler {
    private readonly jobDefinitions: IJobDefinitionsConfig;

    public constructor(
        private readonly logger: Logger,
        private readonly jobHandler: IJobHandler,
        private readonly taskHandler: ITaskHandler,
        private readonly job: IJobResponse<unknown, unknown>,
        private readonly task: ITaskResponse<unknown>,
        config: IConfig
    ) {
        this.jobDefinitions = config.get<IJobDefinitionsConfig>('jobDefinitions');
    }

    public handleCompletedNotification = async (): Promise<void> => {
        const nextTaskType = this.taskHandler.getNextTaskType();

        if (nextTaskType === undefined) {
            await this.handleNoNextTask();
            return;
        }

        if (!(await this.taskHandler.canProceedToNextTask()) || this.taskHandler.shouldSkipTaskCreation(nextTaskType)) {
            await this.handleSkipTask(nextTaskType);
            return;
        }

        await this.taskHandler.createNextTask(nextTaskType);
        await this.jobHandler.updateJobForHavingNewTask(nextTaskType);
    };

    public handleFailedTask = async (): Promise<void> => {
        if (this.jobDefinitions.suspendingTaskTypes.includes(this.task.type)) {
            await this.jobHandler.suspendJob(this.task.reason);
        } else {
            await this.jobHandler.failJob(this.task.reason);
        }
    };

    private async handleNoNextTask(): Promise<void> {
        const percentage = calculateTaskPercentage(this.job.completedTasks, this.job.taskCount);

        if (this.jobHandler.isAllTasksCompleted()) {
            this.logger.info({ msg: 'Completing job', jobId: this.job.id });
            await this.jobHandler.completeJob();
        } else {
            this.logger.info({ msg: 'No next task, updating progress', jobId: this.job.id });
            await this.jobHandler.updateJobProgress(percentage);
        }
    }

    private async handleSkipTask(nextTaskType: string): Promise<void> {
        this.logger.info({
            msg: 'Skipping task creation',
            jobId: this.job.id,
            taskType: nextTaskType,
        });
        const percentage = calculateTaskPercentage(this.job.completedTasks, this.job.taskCount);
        await this.jobHandler.updateJobProgress(percentage);
    }
}
