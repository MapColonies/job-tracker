import { container } from "tsyringe";
import { BadRequestError } from "@map-colonies/error-types";
import { IJobDefinitionsConfig } from "../../common/interfaces";
import { HANDLERS } from "../../common/constants";
import { JobHandler } from "./baseHandler";
import { IngestionJobHandler } from "./ingestion/ingestionHandler";
import { ExportJobHandler } from "./export/exportHandler";

export function initJobHandler(
    jobHandlerType: string,
    jobDefinitions: IJobDefinitionsConfig
): JobHandler {
    switch (jobHandlerType) {
        case jobDefinitions.jobs.new:
        case jobDefinitions.jobs.update:
        case jobDefinitions.jobs.swapUpdate:
            //CASESEED?
            return container.resolve<IngestionJobHandler>(HANDLERS.INGESTION) as JobHandler;
        case jobDefinitions.jobs.export:
            return container.resolve<ExportJobHandler>(HANDLERS.EXPORT) as JobHandler;

        default:
            throw new BadRequestError(`${jobHandlerType} job type is invalid`);
    }
}