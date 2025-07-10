import { BadRequestError } from "@map-colonies/error-types";
import { Logger } from "@map-colonies/js-logger";
import { IJobResponse, ITaskResponse, TaskHandler as QueueClient } from "@map-colonies/mc-priority-queue";
import { IConfig, IJobDefinitionsConfig } from "../../common/interfaces";
import { JobHandler } from "./baseHandler";
import { IngestionJobHandler } from "./ingestion/ingestionHandler";
import { ExportJobHandler } from "./export/exportHandler";
import { ExportFinalizeJobHandler } from "./export/finalizeHandler";

export function initJobHandler(
    jobHandlerType: string,
    jobDefinitions: IJobDefinitionsConfig,
    logger: Logger,
    queueClient: QueueClient,
    config: IConfig,
    job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>
): JobHandler {
    switch (jobHandlerType) {
        case jobDefinitions.jobs.new:
        case jobDefinitions.jobs.update:
        case jobDefinitions.jobs.swapUpdate:
            //CASESEED?
            return new IngestionJobHandler(logger, queueClient, config, job, task)
        case jobDefinitions.jobs.export:
            switch (task.type) {
                case jobDefinitions.tasks.finalize:
                    return new ExportFinalizeJobHandler(logger, queueClient, config, job, task)
                    break;
            }
            return new ExportJobHandler(logger, queueClient, config, job, task)

        default:
            throw new BadRequestError(`${jobHandlerType} job type is invalid`);
    }
}