import { ConflictError, NotFoundError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import {
  IngestionNewFinalizeTaskParams,
  IngestionSwapUpdateFinalizeTaskParams,
  IngestionUpdateFinalizeTaskParams,
} from '@map-colonies/mc-model-types';
import {
  ICreateTaskBody,
  IFindTaskRequest,
  IJobResponse,
  ITaskResponse,
  JobManagerClient,
  OperationStatus,
  TaskHandler as QueueClient,
} from '@map-colonies/mc-priority-queue';
import { inject, injectable } from 'tsyringe';
import {
  ExportFinalizeErrorCallbackParams,
  ExportFinalizeFullProcessingParams,
  exportFinalizeTaskParamsSchema,
  ExportFinalizeType,
} from '@map-colonies/raster-shared';
import { JOB_COMPLETED_MESSAGE, SERVICES } from '../../common/constants';
import { IrrelevantOperationStatusError } from '../../common/errors';
import { IConfig, IJobDefinitionsConfig } from '../../common/interfaces';
import { calculateTaskPercentage } from '../../utils/taskUtils';

@injectable()
export class TasksManager {
  private readonly jobManager: JobManagerClient;
  private readonly jobDefinitions: IJobDefinitionsConfig;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.QUEUE_CLIENT) private readonly queueClient: QueueClient,
    @inject(SERVICES.CONFIG) private readonly config: IConfig
  ) {
    this.jobManager = this.queueClient.jobManagerClient;
    this.jobDefinitions = this.config.get<IJobDefinitionsConfig>('jobDefinitions');
  }

  public async handleTaskNotification(taskId: string): Promise<void> {
    this.logger.info({ msg: `Handling task notification for task id: ${taskId}` });
    const task = await this.findTask({ id: taskId });
    if (!task) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }
    const job = await this.getJob(task.jobId);
    switch (task.status) {
      case OperationStatus.FAILED:
        if (this.jobDefinitions.suspendingTaskTypes.includes(task.type)) {
          await this.suspendJob(task.jobId, task.reason);
        } else {
          await this.failJob(task.jobId, task.reason);
        }
        if (job.type === this.jobDefinitions.jobs.export && task.type !== this.jobDefinitions.tasks.finalize) {
          await this.handleExportFailure(task);
        }
        break;
      case OperationStatus.COMPLETED:
        await this.handleCompletedTask(job, task);
        break;
      default:
        throw new IrrelevantOperationStatusError(`Expected to get a 'Completed' or 'Failed' task' but instead got '${task.status}'`);
    }
  }

  private async handleCompletedTask(job: IJobResponse<unknown, unknown>, task: ITaskResponse<unknown>): Promise<void> {

    // //handlers factory - job , task
    // const handler = new IngestionJobHandler(this.logger, this.queueClient, this.config, job, task);
    // await handler.createNextTask();
    if (job.type === this.jobDefinitions.jobs.seed) {
      await this.handleSeedingTask(job);
      return;
    }
    const initTask = await this.findTask({ jobId: job.id, type: this.jobDefinitions.tasks.init });

    if (!initTask) {
      this.logger.warn({ msg: 'Skipping because init task was not found' });
      return;
    }
    // Handle completed finalization task
    if (task.type === this.jobDefinitions.tasks.finalize) {
      if (job.type === this.jobDefinitions.jobs.export) {
        const validFinalizeTaskParams = exportFinalizeTaskParamsSchema.parse(task.parameters);
        if (validFinalizeTaskParams.type === ExportFinalizeType.Error_Callback) {
          return;
        }
      }
      await this.completeJob(job);
      return;
    }
    if (this.shouldCreateNextTask(job, initTask)) {
      await this.createNextTask(task.type, job);
      return;
    }
    this.logger.debug({ msg: `Updating job percentage; No subsequence task for taskType ${task.type}` });
    const calculatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount);
    await this.updateJobPercentage(job.id, calculatedPercentage);
  }

  private async handleSeedingTask(job: IJobResponse<unknown, unknown>): Promise<void> {
    if (job.taskCount === job.completedTasks) {
      await this.completeJob(job);
      return;
    }
    const calculatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount);
    await this.updateJobPercentage(job.id, calculatedPercentage);
  }

  private async failJob(jobId: string, reason: string): Promise<void> {
    await this.jobManager.updateJob(jobId, { status: OperationStatus.FAILED, reason });
    this.logger.info({ msg: `Failed job: ${jobId}`, reason });
  }

  private async completeJob(job: IJobResponse<unknown, unknown>): Promise<void> {
    const logger = this.logger.child({ jobId: job.id, jobType: job.type });
    logger.info({ msg: `Completing job` });
    await this.jobManager.updateJob(job.id, { status: OperationStatus.COMPLETED, reason: JOB_COMPLETED_MESSAGE, percentage: 100 });
    logger.info({ msg: JOB_COMPLETED_MESSAGE });
  }

  private async suspendJob(jobId: string, reason: string): Promise<void> {
    await this.jobManager.updateJob(jobId, { status: OperationStatus.SUSPENDED, reason });
    this.logger.info({ msg: `Suspended job: ${jobId}` });
  }

  private async createTask(job: IJobResponse<unknown, unknown>, taskType: string): Promise<void> {
    let taskParameters: unknown = {};
    if (taskType === this.jobDefinitions.tasks.finalize) {
      switch (job.type) {
        case this.jobDefinitions.jobs.new: {
          (taskParameters as IngestionNewFinalizeTaskParams) = { insertedToCatalog: false, insertedToGeoServer: false, insertedToMapproxy: false };
          break;
        }
        case this.jobDefinitions.jobs.update: {
          (taskParameters as IngestionUpdateFinalizeTaskParams) = { updatedInCatalog: false };
          break;
        }
        case this.jobDefinitions.jobs.swapUpdate: {
          (taskParameters as IngestionSwapUpdateFinalizeTaskParams) = { updatedInCatalog: false, updatedInMapproxy: false };
          break;
        }
        case this.jobDefinitions.jobs.export: {
          (taskParameters as ExportFinalizeFullProcessingParams) = {
            type: ExportFinalizeType.Full_Processing,
            gpkgModified: false,
            gpkgUploadedToS3: false,
            callbacksSent: false,
          };
          break;
        }
      }
    }

    const createTaskBody: ICreateTaskBody<unknown> = {
      type: taskType,
      parameters: taskParameters,
      blockDuplication: this.taskBlocksDuplication(taskType, job.type),
    };

    await this.jobManager.createTaskForJob(job.id, createTaskBody);
    this.logger.info({ msg: `Created ${taskType} task for job: ${job.id}` });
  }

  private async findTask(body: IFindTaskRequest<unknown>): Promise<ITaskResponse<unknown> | undefined> {
    const task = await this.jobManager.findTasks(body);
    return task?.[0];
  }

  private async getJob(jobId: string): Promise<IJobResponse<unknown, unknown>> {
    return this.jobManager.getJob(jobId);
  }

  private async updateJobPercentage(jobId: string, desiredPercentage: number): Promise<void> {
    await this.jobManager.updateJob(jobId, { percentage: desiredPercentage });
    this.logger.info({ msg: `Updated percentages (${desiredPercentage}) for job: ${jobId}` });
  }

  private async createNextTask(currentTaskType: string, job: IJobResponse<unknown, unknown>): Promise<void> {
    let nextTaskType: string;
    switch (currentTaskType) {
      case this.jobDefinitions.tasks.init: // for cases where merge tasks completes before init task
      case this.jobDefinitions.tasks.merge:
        if (job.type === this.jobDefinitions.jobs.export) {
          // temporary ! should be change for better handle
          if (job.taskCount === job.completedTasks) {
            nextTaskType = this.jobDefinitions.tasks.finalize;
            break;
          }
        }
        nextTaskType = this.jobDefinitions.tasks.polygonParts;
        break;
      case this.jobDefinitions.tasks.export:
      case this.jobDefinitions.tasks.polygonParts:
        nextTaskType = this.jobDefinitions.tasks.finalize;
        break;
      default:
        return;
    }

    try {
      await this.createTask(job, nextTaskType);
    } catch (error) {
      if (error instanceof ConflictError) {
        this.logger.warn({ msg: `Detected an existing ${nextTaskType} task for job: ${job.id} - silently ignoring` });
        return;
      }
      throw error;
    }
    const calculatedPercentage = calculateTaskPercentage(job.completedTasks, job.taskCount + 1);
    await this.updateJobPercentage(job.id, calculatedPercentage);
  }

  private shouldCreateNextTask(job: IJobResponse<unknown, unknown>, initTask: ITaskResponse<unknown>): boolean {
    return job.completedTasks === job.taskCount && initTask.status === OperationStatus.COMPLETED;
  }

  private taskBlocksDuplication(taskType: string, jobType?: string): boolean {
    if (taskType === this.jobDefinitions.tasks.finalize && jobType === this.jobDefinitions.jobs.export) {
      return false;
    } else {
      return [this.jobDefinitions.tasks.finalize, this.jobDefinitions.tasks.polygonParts, this.jobDefinitions.tasks.export].includes(taskType);
    }
  }

  private async handleExportFailure(task: ITaskResponse<unknown>): Promise<void> {
    this.logger.info({ msg: `Handling Export Failure with jobId: ${task.jobId}, and reason: ${task.reason}` });
    const taskParameters: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
    const taskType = this.jobDefinitions.tasks.finalize;
    const createTaskBody: ICreateTaskBody<ExportFinalizeErrorCallbackParams> = {
      type: taskType,
      parameters: taskParameters,
      blockDuplication: this.taskBlocksDuplication(taskType, this.jobDefinitions.jobs.export),
    };
    await this.jobManager.createTaskForJob(task.jobId, createTaskBody);
    this.logger.info({ msg: `Created ${taskType} task for job: ${task.jobId}` });
  }
}
