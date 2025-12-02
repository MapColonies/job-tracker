import jsLogger from '@map-colonies/js-logger';
import { OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { createTestJob, getTaskMock } from '../../../mocks/jobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';
import { mockJobManager, queueClientMock } from '../../../mocks/mockJobManager';
import { getJobHandler } from '../../../../src/tasks/handlers/jobHandlerFactory';

describe('BaseJobHandler', () => {
  let mockJob: IJobResponse<unknown, unknown>;
  let mockTask: ITaskResponse<unknown>;

  const mockLogger = jsLogger({ enabled: false });

  registerDefaultConfig();

  const jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
  const jobTypes = Object.values<string>(jobDefinitionsConfig.jobs);

  beforeEach(() => {
    registerDefaultConfig();
    // Extract config values
    mockJob = createTestJob(jobDefinitionsConfig.jobs.new);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('completeJob', () => {
    it.each(jobTypes)('should update job status to completed with 100% progress - %s handler', async (type) => {
      mockJob = { ...mockJob, type, completedTasks: 10, taskCount: 10 };
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: completing job
      await handler.completeJob();

      // Then: job should be updated with completed status and 100% progress
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.COMPLETED,
        percentage: 100,
      });
    });
  });

  describe('failJob', () => {
    it.each(jobTypes)('should fail job with provided reason - %s handler', async (type) => {
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
      // Given: specific failure reason
      const reason = 'Task failed reason';

      // When: failing job
      await handler.failJob(reason);

      // Then: job should be updated with failed status and reason
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.FAILED,
        reason,
      });
    });

    it.each(jobTypes)('should fail job with default reason when none provided', async (type) => {
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: failing job without reason
      await handler.failJob();

      // Then: job should be updated with default reason
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.FAILED,
        reason: 'Job failed for unknown reason',
      });
    });
  });

  describe('suspendJob', () => {
    it.each(jobTypes)('should suspend job with provided reason - %s handler', async (type) => {
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
      // Given: specific suspension reason
      const reason = 'Task suspend reason';

      // When: suspending job
      await handler.suspendJob(reason);

      // Then: job should be updated with suspended status and reason
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.SUSPENDED,
        reason,
      });
    });

    it.each(jobTypes)('should suspend job with default reason when none provided - %s handler', async (type) => {
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
      // When: suspending job without reason
      await handler.suspendJob();

      // Then: job should be updated with default reason
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.SUSPENDED,
        reason: 'Job suspended for unknown reason',
      });
    });
  });

  describe('updateJobProgress', () => {
    it.each(jobTypes)('should update job progress based on completed/total tasks - %s handler', async (type) => {
      // Given: job with 5/10 tasks completed (50%)
      mockJob = { ...mockJob, completedTasks: 5, taskCount: 10 };
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: updating job progress
      await handler.updateJobProgress();

      // Then: job should be updated with 50% progress
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        percentage: 50,
      });
    });
  });

  describe('isJobCompleted', () => {
    it.each(jobTypes)('should return true when all tasks are completed - %s handler', (type) => {
      mockJob = { ...mockJob, type, completedTasks: 10, taskCount: 10 };
      mockTask = getTaskMock<unknown>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
      });
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: checking if job is completed
      const result = handler.isJobCompleted(mockTask.type);

      // Then: should return true
      expect(result).toBe(true);
    });

    it.each(jobTypes)('should return false when not all of the tasks are completed - %s handler', (type) => {
      mockJob = { ...mockJob, completedTasks: 5, taskCount: 10 };
      mockTask = getTaskMock<unknown>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
      });
      const handler = getJobHandler(type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: checking if job is completed
      const result = handler.isJobCompleted(mockTask.type);

      // Then: should return false
      expect(result).toBe(false);
    });
  });
});
