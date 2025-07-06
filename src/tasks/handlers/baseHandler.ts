import { ICreateTaskBody, IJobResponse, ITaskResponse, JobManagerClient, OperationStatus, TaskHandler as QueueClient } from "@map-colonies/mc-priority-queue";
import { Logger } from "@map-colonies/js-logger";
import { IConfig, IJobDefinitionsConfig, JobAndTask, TaskTypesArray } from "../../common/interfaces";
import { JOB_COMPLETED_MESSAGE } from "../../common/constants";
import { taskParameterMapper } from "../../common/mappers";

export abstract class JobHandler {

    protected readonly jobManager: JobManagerClient;
    protected readonly jobDefinitions: IJobDefinitionsConfig;
    protected readonly tasksFlow: TaskTypesArray;
    protected readonly shouldBlockDuplicationForTypes: TaskTypesArray;

    protected constructor(
        protected readonly logger: Logger,
        protected readonly queueClient: QueueClient,
        protected readonly config: IConfig,
        protected readonly job: IJobResponse<unknown, unknown>,
        protected readonly task: ITaskResponse<unknown>
    ) {
        this.jobManager = this.queueClient.jobManagerClient;
        this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
        this.tasksFlow = this.config.get<TaskTypesArray>('TasksFlow');
        this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts, this.jobDefinitions.tasks.export];
    }

    public async createNextTask(): Promise<void> {
        if (this.canProceed()) {
            const nextTaskType = this.getNextTaskType();
            const taskParameters = taskParameterMapper[`${this.job.type}_${nextTaskType}`]

            const createTaskBody: ICreateTaskBody<unknown> = {
                type: nextTaskType,
                parameters: taskParameters,
                blockDuplication: this.shouldBlockDuplicationForTypes.includes(nextTaskType)
            };

            this.logger.info({ msg: `Creating ${nextTaskType} task for job: ${this.job.id}` });
            await this.jobManager.createTaskForJob(this.job.id, createTaskBody);
        }
    }

    protected async completeJob(): Promise<void> {
        this.logger.info({ msg: `Completing job` });
        await this.jobManager.updateJob(this.job.id, { status: OperationStatus.COMPLETED, reason: JOB_COMPLETED_MESSAGE, percentage: 100 });
        this.logger.info({ msg: JOB_COMPLETED_MESSAGE });
    }

    protected async handleFailedTask(): Promise<void> {
        if (this.jobDefinitions.suspendingTaskTypes.includes(this.task.type)) {
            await this.suspendJob();
        } else {
            await this.failJob();
        }
    };

    private getNextTaskType(): string {
        const indexOfCurrentTask = this.tasksFlow.indexOf(this.task.type);
        const nextTaskType = this.tasksFlow[indexOfCurrentTask + 1];
        return nextTaskType;
        //add coverage for last item in the array
    }

    private async suspendJob(): Promise<void> {
        const reason = this.task.reason;
        this.logger.info({ msg: `Suspending job: ${this.job.id}`, reason: `Reason: ${reason}` });
        await this.jobManager.updateJob(this.job.id, { status: OperationStatus.SUSPENDED, reason });
    }

    private async failJob(): Promise<void> {
        const reason = this.task.reason;
        this.logger.info({ msg: `Failing job: ${this.job.id}`, reason: `Reason: ${reason}` });
        await this.jobManager.updateJob(this.job.id, { status: OperationStatus.FAILED, reason });
    }

    public abstract canProceed(): boolean;
}