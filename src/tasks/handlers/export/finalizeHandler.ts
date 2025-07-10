import { Logger } from "@map-colonies/js-logger";
import {
    IJobResponse,
    ITaskResponse,
    TaskHandler as QueueClient,
} from "@map-colonies/mc-priority-queue";
import { injectable, inject } from "tsyringe";
import { exportFinalizeTaskParamsSchema, ExportFinalizeType } from "@map-colonies/raster-shared";
import { IConfig } from "../../../common/interfaces";
import { SERVICES } from "../../../common/constants";
import { ExportJobHandler } from "./exportHandler";

@injectable()
export class ExportFinalizeJobHandler extends ExportJobHandler {


    public constructor(
        @inject(SERVICES.LOGGER) logger: Logger,
        @inject(SERVICES.QUEUE_CLIENT) queueClient: QueueClient,
        @inject(SERVICES.CONFIG) config: IConfig,
        job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>
    ) {
        super(logger, queueClient, config, job, task);
    }

    public canProceed(): boolean {
        const validFinalizeTaskParams = exportFinalizeTaskParamsSchema.parse(this.task.parameters);
        if (validFinalizeTaskParams.type === ExportFinalizeType.Error_Callback) {
            return false;
        }
        return true;
    }

}