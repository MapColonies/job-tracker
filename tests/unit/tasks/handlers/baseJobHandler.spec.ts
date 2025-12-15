import jsLogger from '@map-colonies/js-logger';
import { OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { createTestJob, getTaskMock } from '../../../mocks/jobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';
import { mockJobManager, queueClientMock } from '../../../mocks/mockJobManager';
import { getJobHandler } from '../../../../src/tasks/handlers/jobHandlerFactory';

describe('BaseJobHandler', () => {
  let mockTask: ITaskResponse<unknown>;
  let testCases: {
    mockJob: IJobResponse<unknown, unknown>;
  }[] = [];

  const mockLogger = jsLogger({ enabled: false });

  registerDefaultConfig();
  const jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
  testCases = [
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.new) },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.update) },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.swapUpdate) },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.export) },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.seed) },
  ];

  const testCaseHandlerLog = '$jobType handler';

  beforeEach(() => {
    registerDefaultConfig();
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('completeJob', () => {
    it.each(testCases)(`should update job status to completed with 100% progress - ${testCaseHandlerLog}`, async (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

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
    it.each(testCases)(`should fail job with provided reason - ${testCaseHandlerLog}`, async (testCase) => {
      const { mockJob } = testCase;
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
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

    it.each(testCases)(`should fail job with default reason when none provided - ${testCaseHandlerLog}`, async (testCase) => {
      const { mockJob } = testCase;
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

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
    it.each(testCases)(`should suspend job with provided reason - ${testCaseHandlerLog}`, async (testCase) => {
      const { mockJob } = testCase;
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
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

    it.each(testCases)(`should suspend job with default reason when none provided - ${testCaseHandlerLog}`, async (testCase) => {
      const { mockJob } = testCase;
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
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
    it.each(testCases)(`should update job progress based on completed/total tasks - ${testCaseHandlerLog}`, async (testCase) => {
      let { mockJob } = testCase;
      // Given: job with 5/10 tasks completed (50%)
      mockJob = { ...mockJob, completedTasks: 5, taskCount: 10 };
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: updating job progress
      await handler.updateJobProgress();

      // Then: job should be updated with 50% progress
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        percentage: 50,
      });
    });
  });

  describe('isJobCompleted', () => {
    it.each(testCases)(`should return true when all tasks are completed - ${testCaseHandlerLog}`, (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
      mockTask = getTaskMock<unknown>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
      });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: checking if job is completed
      const result = handler.isJobCompleted(mockTask.type);

      // Then: should return true
      expect(result).toBe(true);
    });

    it.each(testCases)(`should return false when not all of the tasks are completed - ${testCaseHandlerLog}`, (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 5, taskCount: 10 };
      mockTask = getTaskMock<unknown>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
      });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: checking if job is completed
      const result = handler.isJobCompleted(mockTask.type);

      // Then: should return false
      expect(result).toBe(false);
    });
  });
});
