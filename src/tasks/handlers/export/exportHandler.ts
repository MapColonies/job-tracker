import { Logger } from "@map-colonies/js-logger";
import {
    IJobResponse,
    ITaskResponse,
    TaskHandler as QueueClient,
} from "@map-colonies/mc-priority-queue";
import { injectable, inject } from "tsyringe";
import { IConfig, TaskTypesArray } from "../../../common/interfaces";
import { SERVICES } from "../../../common/constants";
import { JobHandler } from "../baseHandler";
import { isInitialWorkflowCompleted } from "../utils";

@injectable()
export class ExportJobHandler extends JobHandler {
    protected tasksFlow: TaskTypesArray;
    protected excludedTypes: TaskTypesArray;
    protected shouldBlockDuplicationForTypes: TaskTypesArray;

    public constructor(
        @inject(SERVICES.LOGGER) logger: Logger,
        @inject(SERVICES.QUEUE_CLIENT) queueClient: QueueClient,
        @inject(SERVICES.CONFIG) config: IConfig,
        job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>
    ) {
        super(logger, queueClient, config, job, task);
        this.tasksFlow = this.config.get<TaskTypesArray>('ExportTasksFlow');
        this.excludedTypes = this.config.get<TaskTypesArray>('exportCreationExcludedTaskTypes');
        this.shouldBlockDuplicationForTypes = [this.jobDefinitions.tasks.export];
    }

    public canProceed(): boolean {
        //to להמנע from export finalize handler, make a function that returns a funtion that does the check accordingly
        return isInitialWorkflowCompleted(this.job, this.task);
    }

    protected shouldSkipTaskCreation(taskType: string): boolean {
        return (this.excludedTypes.includes(taskType))
    }
}
