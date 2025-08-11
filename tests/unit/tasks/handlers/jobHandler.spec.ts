import { ConflictError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
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

  // Expose protected method for testing
  public async testCanProceed(): Promise<boolean> {
    return this.canProceed();
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

  describe('handleFailedTask', () => {
    it('should suspend job when task type is in suspending types', async () => {
      // Given: task type is in suspending types
      mockTask.type = jobDefinitionsConfig.tasks.polygonParts;
      mockTask.reason = 'Task failed reason';
      jest.spyOn(handler, 'suspendJob').mockResolvedValue();

      // When: handling failed task
      await handler.handleFailedTask();

      // Then: job should be suspended
      expect(handler.suspendJob).toHaveBeenCalledWith('Task failed reason');
    });

    it('should fail job when task type is not in suspending types', async () => {
      // Given: task type is not in suspending types
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockTask.reason = 'Task failed reason';
      jest.spyOn(handler, 'failJob').mockResolvedValue();

      // When: handling failed task
      await handler.handleFailedTask();

      // Then: job should be failed
      expect(handler.failJob).toHaveBeenCalledWith('Task failed reason');
    });
  });

  describe('handleCompletedNotification', () => {
    it('should complete job when no next task and all tasks completed', async () => {
      // Given: last task in flow and all tasks completed
      mockTask.type = jobDefinitionsConfig.tasks.finalize;
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;
      jest.spyOn(handler, 'completeJob').mockResolvedValue();

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: job should be completed
      expect(handler.completeJob).toHaveBeenCalled();
    });

    it('should update progress when no next task but not all tasks completed', async () => {
      // Given: last task in flow but not all tasks completed
      mockTask.type = jobDefinitionsConfig.tasks.finalize;
      mockJob.completedTasks = 5;
      mockJob.taskCount = 10;
      jest.spyOn(handler, 'updateJobProgress').mockResolvedValue();

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: progress should be updated
      expect(handler.updateJobProgress).toHaveBeenCalled();
    });

    it('should skip task creation when cannot proceed', async () => {
      // Given: task in progress prevents proceeding
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.IN_PROGRESS }]);

      jest.spyOn(handler, 'updateJobProgress').mockResolvedValue();

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: progress should be updated without creating new task
      expect(handler.updateJobProgress).toHaveBeenCalled();
    });

    it('should skip task creation when task should be skipped', async () => {
      // Given: task creation should be skipped
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);

      jest.spyOn(handler, 'updateJobProgress').mockResolvedValue();

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: progress should be updated without creating new task
      expect(handler.updateJobProgress).toHaveBeenCalled();
    });

    it('should create new task when conditions are met', async () => {
      // Given: conditions met for creating next task
      mockTask.type = jobDefinitionsConfig.tasks.init;
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);

      jest.spyOn(handler, 'updateJobProgress').mockResolvedValue();

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: should create polygon-parts task (skipping excluded tilesExporting)
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({
          type: jobDefinitionsConfig.tasks.polygonParts, // Should skip tilesExporting (excluded)
          blockDuplication: false, // polygon-parts is not in blockedDuplicationTypes
        })
      );
      expect(handler.updateJobProgress).toHaveBeenCalledWith();
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

  describe('canProceed', () => {
    it('should return false when no init tasks found', async () => {
      mockJobManager.findTasks.mockResolvedValue(null);

      const result = await handler.testCanProceed();

      expect(result).toBe(false);
    });

    it('should return result from isInitialWorkflowCompleted when init tasks found', async () => {
      const initTasks = [{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }];
      mockJobManager.findTasks.mockResolvedValue(initTasks);
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      const result = await handler.testCanProceed();

      expect(result).toBe(true);
    });
  });
});
