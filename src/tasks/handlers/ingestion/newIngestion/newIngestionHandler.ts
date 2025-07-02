import { Logger } from "@map-colonies/js-logger";
import {
    ICreateTaskBody,
    IJobResponse,
    ITaskResponse,
    TaskHandler as QueueClient,
} from "@map-colonies/mc-priority-queue";
import { injectable, inject } from "tsyringe";
import { IConfig } from "../../../../common/interfaces";
import { SERVICES } from "../../../../common/constants";
import { isInitialWorkflowCompleted } from "../../utils";
import { JobHandler } from "../../baseHandler";

@injectable()
export class NewJobHandler extends JobHandler {
    public constructor(
        @inject(SERVICES.LOGGER) logger: Logger,
        @inject(SERVICES.QUEUE_CLIENT) queueClient: QueueClient,
        @inject(SERVICES.CONFIG) config: IConfig,
        job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>
    ) {
        super(logger, queueClient, config, job, task);

    }

    public async handleInitTask(taskId: string): Promise<void> {
        if (isInitialWorkflowCompleted(this.job, this.task)) {
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
        await this.completeJob();
    }

    public async handlePolygonTask(taskId: string): Promise<void> { }
    public async handleWorkTask(taskId: string): Promise<void> { }
    public async handleFailedTask(taskId: string): Promise<void> { }
}