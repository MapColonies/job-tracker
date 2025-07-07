import { ICreateTaskBody, IJobResponse, ITaskResponse, JobManagerClient, OperationStatus, TaskHandler as QueueClient } from "@map-colonies/mc-priority-queue";
import { Logger } from "@map-colonies/js-logger";
import { BadRequestError } from "@map-colonies/error-types";
import { IConfig, IJobDefinitionsConfig, TaskTypesArray } from "../../common/interfaces";
import { JOB_COMPLETED_MESSAGE } from "../../common/constants";
import { taskParameterMapper } from "../../common/mappers";

export abstract class JobHandler {

    protected readonly jobManager: JobManagerClient;
    protected readonly jobDefinitions: IJobDefinitionsConfig;
    protected readonly tasksFlow: TaskTypesArray;
    protected readonly creationExcludedTaskTypes: TaskTypesArray;
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
        this.creationExcludedTaskTypes = this.config.get<TaskTypesArray>('creationExcludedTaskTypes');
        this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts, this.jobDefinitions.tasks.export];
    }

    public async createNextTask(): Promise<void> {
        const nextTaskType = this.getNextTaskType();
        const isLastTask = nextTaskType === undefined

        if (isLastTask) {
            await this.completeJob();
            return;
        }

        if (!this.canProceed() || this.shouldSkipTaskCreation(nextTaskType)) {
            this.logger.info({ msg: `skipping current task creation for job: ${this.job.id}` });
            return;
        }

        const taskParameters = taskParameterMapper.get(`${this.job.type}_${nextTaskType}`);

        if (taskParameters != null) {
            this.logger.error({ msg: `task parameters for ${this.job.type}_${nextTaskType} do not exist` });
            throw new BadRequestError(`task parameters for ${this.job.type}_${nextTaskType} do not exist`);
        }

        const createTaskBody: ICreateTaskBody<unknown> = {
            type: nextTaskType,
            parameters: taskParameters,
            blockDuplication: this.shouldBlockDuplicationForTypes.includes(nextTaskType)
        };

        this.logger.info({ msg: `Creating ${nextTaskType} task for job: ${this.job.id}` });
        await this.jobManager.createTaskForJob(this.job.id, createTaskBody);
    }

    private async completeJob(): Promise<void> {
        this.logger.info({ msg: `Completing job` });
        await this.jobManager.updateJob(this.job.id, { status: OperationStatus.COMPLETED, reason: JOB_COMPLETED_MESSAGE, percentage: 100 });
        this.logger.info({ msg: JOB_COMPLETED_MESSAGE });
    }

    private async handleFailedTask(): Promise<void> {
        if (this.jobDefinitions.suspendingTaskTypes.includes(this.task.type)) {
            await this.suspendJob();
        } else {
            await this.failJob();
        }
    };

    private getNextTaskType(): string | undefined {
        const indexOfCurrentTask = this.tasksFlow.indexOf(this.task.type);
        const nextTaskType = this.tasksFlow[indexOfCurrentTask + 1];
        return nextTaskType;
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

    private shouldSkipTaskCreation(taskType: string): boolean {
        return (this.creationExcludedTaskTypes.includes(taskType))
    }

    public abstract canProceed(): boolean;
}