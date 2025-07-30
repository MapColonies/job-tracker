import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { BaseJobHandler } from '../baseJobHandler';

/**
 * Job handler specific to export operations
 */
export class ExportJobHandler extends BaseJobHandler {
    public constructor(logger: Logger, jobManager: JobManagerClient, job: IJobResponse<unknown, unknown>) {
        super(logger, jobManager, job);
    }

    // Export-specific job logic can be added here
    // For now, it uses all the base implementations
}
