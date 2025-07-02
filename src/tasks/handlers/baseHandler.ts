import { IJobResponse, ITaskResponse, JobManagerClient, OperationStatus, TaskHandler as QueueClient } from "@map-colonies/mc-priority-queue";
import { Logger } from "@map-colonies/js-logger";
import { IConfig, IJobDefinitionsConfig } from "../../common/interfaces";
import { JOB_COMPLETED_MESSAGE } from "../../common/constants";

export abstract class JobHandler {

    protected readonly jobManager: JobManagerClient;
    protected readonly jobDefinitions: IJobDefinitionsConfig;

    protected constructor(
        protected readonly logger: Logger,
        protected readonly queueClient: QueueClient,
        protected readonly config: IConfig,
        protected readonly job: IJobResponse<unknown, unknown>,
        protected readonly task: ITaskResponse<unknown>
    ) {
        this.jobManager = this.queueClient.jobManagerClient;
        this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
    }

    protected async completeJob(): Promise<void> {
        const logger = this.logger.child({ jobId: this.job.id, jobType: this.job.type });
        logger.info({ msg: `Completing job` });
        await this.jobManager.updateJob(this.job.id, { status: OperationStatus.COMPLETED, reason: JOB_COMPLETED_MESSAGE, percentage: 100 });
        logger.info({ msg: JOB_COMPLETED_MESSAGE });
    }


    public abstract handleInitTask(taskId: string): Promise<void>;
    public abstract handleFinalizeTask(taskId: string): Promise<void>;
    public abstract handlePolygonTask(taskId: string): Promise<void>;
    public abstract handleWorkTask(taskId: string): Promise<void>;
    public abstract handleFailedTask(taskId: string): Promise<void>;


}