import { ConflictError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { WorkflowJobHandler } from '../../../../src/tasks/handlers/workflowJobHandler';
import { IConfig, TaskTypeArray } from '../../../../src/common/interfaces';
import { getExportJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';

// Concrete implementation for testing
class TestWorkflowJobHandler extends WorkflowJobHandler {
  protected readonly tasksFlow: TaskTypeArray = ['init', 'tilesExporting', 'finalize'];
  protected readonly excludedTypes: TaskTypeArray = ['tilesExporting'];
  protected readonly shouldBlockDuplicationForTypes: TaskTypeArray = ['init'];

  public constructor(
    logger: Logger,
    config: IConfig,
    jobManager: JobManagerClient,
    job: IJobResponse<unknown, unknown>,
    task: ITaskResponse<unknown>
  ) {
    super(logger, config, jobManager, job, task);
    this.initializeTaskOperations();
  }

  // Expose protected method for testing
  public async testCanProceed(): Promise<boolean> {
    return this.canProceed();
  }
}

describe('WorkflowJobHandler', () => {
  let handler: TestWorkflowJobHandler;
  let mockLogger: Logger;
  let mockJobManager: jest.Mocked<JobManagerClient>;
  let mockJob: IJobResponse<unknown, unknown>;
  let mockTask: ITaskResponse<unknown>;
  let mockConfig: IConfig;

  beforeEach(() => {
    registerDefaultConfig();
    mockConfig = configMock;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    mockJobManager = {
      updateJob: jest.fn(),
      createTaskForJob: jest.fn(),
      findTasks: jest.fn(),
    } as unknown as jest.Mocked<JobManagerClient>;

    mockJob = getExportJobMock();
    mockTask = getTaskMock(mockJob.id);
    mockTask.type = 'init';

    handler = new TestWorkflowJobHandler(mockLogger, mockConfig, mockJobManager, mockJob, mockTask);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleFailedTask', () => {
    it('should suspend job when task type is in suspending types', async () => {
      // Setup task type as suspending type
      mockTask.type = 'polygon-parts';
      mockTask.reason = 'Task failed reason';

      jest.spyOn(handler, 'suspendJob').mockResolvedValue();

      await handler.handleFailedTask();

      expect(handler.suspendJob).toHaveBeenCalledWith('Task failed reason');
    });

    it('should fail job when task type is not in suspending types', async () => {
      // Setup task type as non-suspending type
      mockTask.type = 'init';
      mockTask.reason = 'Task failed reason';

      jest.spyOn(handler, 'failJob').mockResolvedValue();

      await handler.handleFailedTask();

      expect(handler.failJob).toHaveBeenCalledWith('Task failed reason');
    });
  });

  describe('handleCompletedNotification', () => {
    it('should handle no next task scenario', async () => {
      mockTask.type = 'finalize'; // Last task in flow
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      jest.spyOn(handler, 'completeJob').mockResolvedValue();

      await handler.handleCompletedNotification();

      expect(handler.completeJob).toHaveBeenCalled();
    });

    it('should update progress when no next task but not all tasks completed', async () => {
      mockTask.type = 'finalize'; // Last task in flow
      mockJob.completedTasks = 5;
      mockJob.taskCount = 10;

      jest.spyOn(handler, 'updateJobProgress').mockResolvedValue();

      await handler.handleCompletedNotification();

      expect(handler.updateJobProgress).toHaveBeenCalled();
    });

    it('should skip task creation when cannot proceed', async () => {
      mockTask.type = 'init';
      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.IN_PROGRESS }]);

      jest.spyOn(handler, 'updateJobProgress').mockResolvedValue();

      await handler.handleCompletedNotification();

      expect(handler.updateJobProgress).toHaveBeenCalled();
    });

    it('should skip task creation when task should be skipped', async () => {
      mockTask.type = 'init';
      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);

      jest.spyOn(handler, 'updateJobProgress').mockResolvedValue();

      await handler.handleCompletedNotification();

      expect(handler.updateJobProgress).toHaveBeenCalled();
    });

    it('should create new task when conditions are met', async () => {
      mockTask.type = 'init';
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);

      jest.spyOn(handler, 'updateJobForHavingNewTask').mockResolvedValue();

      await handler.handleCompletedNotification();

      expect(mockJobManager.createTaskForJob).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({
          type: 'finalize', // Should skip tilesExporting (excluded)
          blockDuplication: false, // finalize is not in shouldBlockDuplicationForTypes
        })
      );
      expect(handler.updateJobForHavingNewTask).toHaveBeenCalledWith('finalize');
    });

    it('should handle ConflictError when creating task', async () => {
      mockTask.type = 'init';
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);
      mockJobManager.createTaskForJob.mockRejectedValue(new ConflictError('Task exists'));

      // Should not throw error, just log warning
      await expect(handler.handleCompletedNotification()).resolves.not.toThrow();
    });

    it('should throw non-ConflictError when creating task', async () => {
      mockTask.type = 'init';
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;

      mockJobManager.findTasks.mockResolvedValue([{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }]);
      mockJobManager.createTaskForJob.mockRejectedValue(new Error('Other error'));

      await expect(handler.handleCompletedNotification()).rejects.toThrow('Other error');
    });
  });

  describe('canProceed', () => {
    it('should return true when no init tasks found', async () => {
      mockJobManager.findTasks.mockResolvedValue(null);

      const result = await handler.testCanProceed();

      expect(result).toBe(true);
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
