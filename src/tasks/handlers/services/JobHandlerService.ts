import { Logger } from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { IJobHandler } from '../interfaces/IJobHandler';
import { JOB_COMPLETED_MESSAGE } from '../../../common/constants';
import { calculateTaskPercentage } from '../../../utils/taskUtils';

export class JobHandlerService implements IJobHandler {
    public constructor(
        private readonly logger: Logger,
        private readonly jobManager: JobManagerClient
    ) { }

    public async failJob(jobId: string, reason: string): Promise<void> {
        this.logger.info({ msg: `Failing job: ${jobId}`, reason: `Reason: ${reason}` });
        await this.jobManager.updateJob(jobId, { status: OperationStatus.FAILED, reason: reason });
    }

    public async suspendJob(jobId: string, reason: string): Promise<void> {
        this.logger.info({ msg: `Suspending job: ${jobId}`, reason: `Reason: ${reason}` });
        await this.jobManager.updateJob(jobId, { status: OperationStatus.SUSPENDED, reason: reason });
    }

    public async completeJob(jobId: string): Promise<void> {
        this.logger.info({ msg: 'Completing job', jobId });
        await this.jobManager.updateJob(jobId, {
            status: OperationStatus.COMPLETED,
            reason: JOB_COMPLETED_MESSAGE,
            percentage: 100
        });
        this.logger.info({ msg: JOB_COMPLETED_MESSAGE });
    }

    public async updateJobPercentage(jobId: string, desiredPercentage: number): Promise<void> {
        await this.jobManager.updateJob(jobId, { percentage: desiredPercentage });
        this.logger.info({ msg: `Updated percentages (${desiredPercentage}) for job: ${jobId}` });
    }

    public async updateJobForHavingNewTask(
        jobId: string,
        completedTasks: number,
        totalTasks: number,
        nextTaskType: string
    ): Promise<void> {
        const percentage = calculateTaskPercentage(completedTasks, totalTasks);
        this.logger.debug({ msg: 'Task created, updating progress', jobId, taskType: nextTaskType });
        await this.updateJobPercentage(jobId, percentage);
    }

    public isAllTasksCompleted(completedTasks: number, totalTasks: number): boolean {
        return completedTasks === totalTasks;
    }

    public isInitialWorkflowCompleted(
        completedTasks: number,
        totalTasks: number,
        initTasks: { status: OperationStatus }[]
    ): boolean {
        return completedTasks === totalTasks &&
            initTasks.every((task) => task.status === OperationStatus.COMPLETED);
    }
}
