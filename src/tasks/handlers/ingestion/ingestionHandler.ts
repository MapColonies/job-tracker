import { Logger } from "@map-colonies/js-logger";
import {
    IJobResponse,
    ITaskResponse,
    TaskHandler as QueueClient,
} from "@map-colonies/mc-priority-queue";
import { injectable, inject } from "tsyringe";
import { IConfig, TaskTypesArray } from "../../../common/interfaces";
import { SERVICES } from "../../../common/constants";
import { isInitialWorkflowCompleted } from "../utils";
import { JobHandler } from "../baseHandler";

@injectable()
export class IngestionJobHandler extends JobHandler {
    protected readonly ingestionTasksFlow: TaskTypesArray;

    public constructor(
        @inject(SERVICES.LOGGER) logger: Logger,
        @inject(SERVICES.QUEUE_CLIENT) queueClient: QueueClient,
        @inject(SERVICES.CONFIG) config: IConfig,
        job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>
    ) {
        super(logger, queueClient, config, job, task);
        this.ingestionTasksFlow = this.config.get<TaskTypesArray>('IngestionTasksFlow');
    }

    public getNextTaskType(): string | undefined {
        const indexOfCurrentTask = this.ingestionTasksFlow.indexOf(this.task.type);
        const nextTaskType = this.ingestionTasksFlow[indexOfCurrentTask + 1];
        return nextTaskType;
    }

    public canProceed(): boolean {
        return isInitialWorkflowCompleted(this.job, this.task);
    }

}