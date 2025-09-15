import { ConflictError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { faker } from '@faker-js/faker';
import _ from 'lodash';
import { JobHandler } from '../../../../src/tasks/handlers/jobHandler';
import { IConfig, TaskTypes, IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { getExportJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';

// Concrete implementation for testing
class TestJobHandler extends JobHandler {
  public constructor(
    logger: Logger,
    config: IConfig,
    jobManager: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>,
    protected readonly tasksFlow: TaskTypes,
    protected readonly excludedTypes: TaskTypes,
    protected readonly blockedDuplicationTypes: TaskTypes
  ) {
    super(logger, config, jobManager, job, task);
    this.tasksFlow = tasksFlow;
    this.excludedTypes = excludedTypes;
    this.blockedDuplicationTypes = blockedDuplicationTypes;
    this.initializeTaskOperations();
  }
}

// Test helper functions
const createMockLogger = (): jest.Mocked<Logger> =>
({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as jest.Mocked<Logger>);

const createMockJobManager = (): jest.Mocked<JobManagerClient> =>
({
  updateJob: jest.fn(),
  createTaskForJob: jest.fn(),
  findTasks: jest.fn(),
} as unknown as jest.Mocked<JobManagerClient>);

const createTestJob = (overrides?: Partial<IJobResponse<unknown, unknown>>): IJobResponse<unknown, unknown> => {
  const jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
  return getExportJobMock({
    type: jobDefinitionsConfig.jobs.export,
    completedTasks: 5,
    taskCount: 10,
    ...overrides,
  });
};

describe('JobHandler', () => {
  let handler: TestJobHandler;
  let mockLogger: jest.Mocked<Logger>;
  let mockJobManager: jest.Mocked<JobManagerClient>;
  let mockJob: IJobResponse<unknown, unknown>;
  let mockTask: ITaskResponse<unknown>;
  let mockConfig: IConfig;
  let jobDefinitionsConfig: IJobDefinitionsConfig;
  let taskFlowConfig: { exportTasksFlow: string[] };

  beforeEach(() => {
    registerDefaultConfig();
    mockConfig = configMock;

    // Extract config values
    jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
    taskFlowConfig = configMock.get<{ exportTasksFlow: string[] }>('taskFlowManager');

    mockLogger = createMockLogger();
    mockJobManager = createMockJobManager();
    mockJob = createTestJob();
    mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED });

    handler = new TestJobHandler(
      mockLogger,
      mockConfig,
      mockJobManager,
      mockJob,
      mockTask,
      taskFlowConfig.exportTasksFlow as unknown as TaskTypes,
      ['tilesExporting'] as TaskTypes, // Excluded types for export
      ['tilesExporting'] as TaskTypes // Blocked duplication types for export
    );
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('BaseJobHandler job operations', () => {
    describe('completeJob', () => {
      it('should update job status to completed with 100% progress', async () => {
        // When: completing job
        await handler.completeJob();

        // Then: job should be updated with completed status and 100% progress
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
          status: OperationStatus.COMPLETED,
          percentage: 100,
        });
        expect(mockLogger.info).toHaveBeenCalledWith({
          msg: 'Completing job',
          jobId: mockJob.id,
        });
      });
    });

    describe('failJob', () => {
      it('should fail job with provided reason', async () => {
        // Given: specific failure reason
        const reason = 'Task failed reason';

        // When: failing job
        await handler.failJob(reason);

        // Then: job should be updated with failed status and reason
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
          status: OperationStatus.FAILED,
          reason,
        });
        expect(mockLogger.warn).toHaveBeenCalledWith({
          msg: `Failing job: ${mockJob.id}`,
          jobId: mockJob.id,
          reason,
        });
      });

      it('should fail job with default reason when none provided', async () => {
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
      it('should suspend job with provided reason', async () => {
        // Given: specific suspension reason
        const reason = 'Task failed reason';

        // When: suspending job
        await handler.suspendJob(reason);

        // Then: job should be updated with suspended status and reason
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
          status: OperationStatus.SUSPENDED,
          reason,
        });
        expect(mockLogger.warn).toHaveBeenCalledWith({
          msg: `Suspending job: ${mockJob.id}`,
          jobId: mockJob.id,
          reason,
        });
      });

      it('should suspend job with default reason when none provided', async () => {
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
      it('should update job progress based on completed/total tasks', async () => {
        // Given: job with 5/10 tasks completed (50%)
        mockJob.completedTasks = 5;
        mockJob.taskCount = 10;

        // When: updating job progress
        await handler.updateJobProgress();

        // Then: job should be updated with 50% progress
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
          percentage: 50,
        });
        expect(mockLogger.info).toHaveBeenCalledWith({
          msg: 'Updated job percentage with (50%) for job: ' + mockJob.id,
          jobId: mockJob.id,
          percentage: 50,
        });
      });

      it('should handle zero tasks correctly', async () => {
        // Given: job with 0 tasks
        mockJob.completedTasks = 0;
        mockJob.taskCount = 0;

        // When: updating job progress
        await handler.updateJobProgress();

        // Then: job should be updated with NaN progress (due to 0/0 division)
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
          percentage: NaN,
        });
      });
    });

    describe('isJobCompleted', () => {
      it('should return true when all tasks are completed', () => {
        // Given: job with all tasks completed
        mockJob.completedTasks = 10;
        mockJob.taskCount = 10;

        // When: checking if job is completed
        const result = handler.isJobCompleted();

        // Then: should return true
        expect(result).toBe(true);
      });

      it('should return false when not all tasks are completed', () => {
        // Given: job with some tasks remaining
        mockJob.completedTasks = 5;
        mockJob.taskCount = 10;

        // When: checking if job is completed
        const result = handler.isJobCompleted();

        // Then: should return false
        expect(result).toBe(false);
      });
    });
  });

  describe('handleFailedTask', () => {
    it('should suspend job when task type is in suspending types', async () => {
      // Given: task type is in suspending types
      mockTask.type = jobDefinitionsConfig.tasks.polygonParts;
      mockTask.reason = 'Task failed reason';

      // When: handling failed task
      await handler.handleFailedTask();

      // Then: job should be suspended with task reason
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.SUSPENDED,
        reason: 'Task failed reason',
      });
    });

    it('should fail job when task type is not in suspending types', async () => {
      // Given: task type is not in suspending types
      mockTask.type = faker.helpers.arrayElement(_.difference(Object.values(jobDefinitionsConfig.tasks), jobDefinitionsConfig.suspendingTaskTypes));
      mockTask.reason = 'Task failed reason';

      // When: handling failed task
      await handler.handleFailedTask();

      // Then: job should be failed with task reason
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.FAILED,
        reason: 'Task failed reason',
      });
    });
  });

  describe('handleCompletedNotification', () => {
    it('should complete job when no next task and all tasks completed', async () => {
      // Given: last task in flow and all tasks completed
      mockTask.type = jobDefinitionsConfig.tasks.finalize;
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: job should be completed with 100% progress
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.COMPLETED,
        percentage: 100,
      });
    });

    it('should update progress when no next task but not all tasks completed', async () => {
      // Given: last task in flow but not all tasks completed
      mockTask.type = jobDefinitionsConfig.tasks.finalize;
      mockJob.completedTasks = 5;
      mockJob.taskCount = 10;

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: progress should be updated with 50%
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        percentage: 50,
      });
    });

    it('should skip task creation when cannot proceed (create next task type) because of init task still in Progress', async () => {
      // Given: task in progress prevents proceeding
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.IN_PROGRESS }]);

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: progress should be updated without creating new task
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        percentage: 50, // 5/10 = 50%
      });
      expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
    });

    it('should skip task creation when task init is completed but Merging/other tasks are still in progress', async () => {
      // Given: task creation should be skipped
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: progress should be updated without creating new task
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        percentage: 50, // 5/10 = 50%
      });
      expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
    });

    it('should create new task when conditions are met', async () => {
      // Given: conditions met for creating next task
      mockTask.type = jobDefinitionsConfig.tasks.init;

      // Create a fresh job instance with explicit values
      const testJob = createTestJob({ completedTasks: 10, taskCount: 10 });
      const testHandler = new TestJobHandler(
        mockLogger,
        mockConfig,
        mockJobManager,
        testJob,
        mockTask,
        taskFlowConfig.exportTasksFlow as unknown as TaskTypes,
        ['tilesExporting'] as TaskTypes,
        ['tilesExporting'] as TaskTypes
      );

      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(testJob.id), status: OperationStatus.COMPLETED }]);

      // When: handling completed notification
      await testHandler.handleCompletedNotification();

      // Then: should create polygon-parts task (skipping excluded tilesExporting)
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledWith(
        testJob.id,
        expect.objectContaining({
          type: jobDefinitionsConfig.tasks.polygonParts, // Should skip tilesExporting (excluded)
          blockDuplication: false, // polygon-parts is not in blockedDuplicationTypes
        })
      );
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(testJob.id, {
        percentage: 90, // 10/11 = 90% (taskCount incremented after task creation)
      });
    });

    it('should handle ConflictError when creating task', async () => {
      // Given: task creation conflict
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);
      mockJobManager.createTaskForJob.mockRejectedValue(new ConflictError('Task exists'));

      // When & Then: should not throw error, just log warning
      await expect(handler.handleCompletedNotification()).resolves.not.toThrow();
    });

    it('should throw non-ConflictError when creating task', async () => {
      // Given: unexpected error during task creation
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);
      mockJobManager.createTaskForJob.mockRejectedValue(new Error('Other error'));

      // When & Then: should throw the error
      await expect(handler.handleCompletedNotification()).rejects.toThrow('Other error');
    });
  });
});
