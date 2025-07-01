import { Logger } from "@map-colonies/js-logger";
import {
    ICreateTaskBody,
    IJobResponse,
    ITaskResponse,
    JobManagerClient, TaskHandler as QueueClient,
} from "@map-colonies/mc-priority-queue";
import { injectable, inject } from "tsyringe";
import { IConfig, IJobDefinitionsConfig, IJobHandler } from "../../../../common/interfaces";
import { SERVICES } from "../../../../common/constants";
import { isInitialWorkflowCompleted } from "../../utils";

@injectable()
export class NewJobHandler implements IJobHandler {
    private readonly jobManager: JobManagerClient;
    private readonly jobDefinitions: IJobDefinitionsConfig;
    private readonly job: IJobResponse<unknown, unknown>;
    private readonly initTask: ITaskResponse<unknown>

    public constructor(
        @inject(SERVICES.LOGGER) private readonly logger: Logger,
        @inject(SERVICES.QUEUE_CLIENT) private readonly queueClient: QueueClient,
        @inject(SERVICES.CONFIG) private readonly config: IConfig,
        job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>
    ) {
        this.jobManager = this.queueClient.jobManagerClient;
        this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
        this.job = job;
        this.initTask = task;
    }
    public async handleInitTask(taskId: string): Promise<void> {
        if (isInitialWorkflowCompleted(this.job, this.initTask)) {
            const nextTaskType = this.jobDefinitions.tasks.polygonParts;
            const createTaskBody: ICreateTaskBody<unknown> = {
                type: nextTaskType,
                parameters: {},
                blockDuplication: true
            };

            await this.jobManager.createTaskForJob(this.job.id, createTaskBody);
            this.logger.info({ msg: `Created ${nextTaskType} task for job: ${this.job.id}` });
        }

    };

    public async handleFinalizeTask(taskId: string): Promise<void> {

    }
}