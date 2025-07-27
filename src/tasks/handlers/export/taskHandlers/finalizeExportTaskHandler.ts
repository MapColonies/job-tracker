import { Logger } from '@map-colonies/js-logger';
import { IJobResponse, ITaskResponse, JobManagerClient } from '@map-colonies/mc-priority-queue';
import { exportFinalizeTaskParamsSchema, ExportFinalizeType } from '@map-colonies/raster-shared';
import { IConfig, IJobDefinitionsConfig } from '../../../../common/interfaces';
import { JobHandlerService } from '../../services/JobHandlerService';
import { ITaskHandler } from '../../interfaces/ITaskHandler';
import { BaseExportTaskHandler } from './baseExportTaskHandler';

export class FinalizeExportTaskHandler extends BaseExportTaskHandler implements ITaskHandler {
    protected readonly jobDefinitions: IJobDefinitionsConfig;
    private jobUtils: JobHandlerService;

    public constructor(
        logger: Logger,
        protected readonly config: IConfig,
        protected readonly jobManagerClient: JobManagerClient,
        protected readonly task: ITaskResponse<unknown>,
        protected readonly job: IJobResponse<unknown, unknown>
    ) {
        super(logger, jobManagerClient);
        this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
        this.jobUtils = new JobHandlerService(logger, jobManagerClient);

    }

    public async handleFailedTask(): Promise<void> {
        // Use base handler's implementation for failed tasks
        if (this.jobDefinitions.suspendingTaskTypes.includes(this.task.type)) {
            await this.jobUtils.suspendJob(this.task.jobId, this.task.reason);
        } else {
            await this.jobUtils.failJob(this.task.jobId, this.task.reason);
        }
    }

    public canProceed(): Promise<boolean> {
        const validFinalizeTaskParams = exportFinalizeTaskParamsSchema.parse(this.task.parameters);
        return Promise.resolve(validFinalizeTaskParams.type !== ExportFinalizeType.Error_Callback);
    }

    public shouldSkipTaskCreation(taskType: string): boolean {
        return this.excludedTypes.includes(taskType);
    }
}
