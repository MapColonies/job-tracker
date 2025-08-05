import { BadRequestError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { TaskWorker } from '../../../../src/tasks/handlers/taskHandler';
import { IConfig, TaskTypes } from '../../../../src/common/interfaces';
import { getExportJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';
import { JOB_TYPES, TASK_TYPES, TASK_FLOWS, EXCLUDED_TASK_TYPES } from '../../../helpers/testConstants';

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
  findTasks: jest.fn(),
} as unknown as jest.Mocked<JobManagerClient>);

const createTestJob = (overrides?: Partial<IJobResponse<unknown, unknown>>): IJobResponse<unknown, unknown> =>
  getExportJobMock({ type: JOB_TYPES.export, ...overrides });

const createTestTask = (jobId: string, taskType: string, overrides?: Partial<ITaskResponse<unknown>>): ITaskResponse<unknown> =>
  getTaskMock(jobId, { type: taskType, status: OperationStatus.COMPLETED, ...overrides });

describe('WorkflowTaskOperations', () => {
  let operations: TaskWorker;
  let mockLogger: jest.Mocked<Logger>;
  let mockJobManager: jest.Mocked<JobManagerClient>;
  let mockJob: IJobResponse<unknown, unknown>;
  let mockTask: ITaskResponse<unknown>;
  let mockConfig: IConfig;

  beforeEach(() => {
    registerDefaultConfig();
    mockConfig = configMock;

    mockLogger = createMockLogger();
    mockJobManager = createMockJobManager();
    mockJob = createTestJob();
    mockTask = createTestTask(mockJob.id, TASK_TYPES.init);

    operations = new TaskWorker(
      mockLogger,
      mockConfig,
      mockJobManager,
      mockJob,
      mockTask,
      TASK_FLOWS.export as unknown as TaskTypes,
      EXCLUDED_TASK_TYPES.export as unknown as TaskTypes
    );
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('getTaskParameters', () => {
    it('should return task parameters for valid job and task type', () => {
      // Given: valid job type and task type combination
      const jobType = JOB_TYPES.export;
      const taskType = TASK_TYPES.finalize;

      // When: getting task parameters
      const result = operations.getTaskParameters(jobType, taskType);

      // Then: should return expected finalize task parameters
      expect(result).toBeDefined();
      expect(result).toEqual({
        type: 'FullProcessing',
        gpkgModified: false,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      });
    });

    it('should throw BadRequestError for invalid job and task type combination', () => {
      // Given: invalid job type and task type combination
      const invalidJobType = 'InvalidJob';
      const invalidTaskType = 'InvalidTask';

      // When & Then: should throw BadRequestError
      expect(() => {
        operations.getTaskParameters(invalidJobType, invalidTaskType);
      }).toThrow(BadRequestError);

      expect(() => {
        operations.getTaskParameters(invalidJobType, invalidTaskType);
      }).toThrow('task parameters for InvalidJob_InvalidTask do not exist');
    });
  });

  describe('getNextTaskType', () => {
    it('should return next task type when current task is in flow', () => {
      // Given: current task is first in flow
      mockTask.type = TASK_TYPES.init;

      // When: getting next task type
      const result = operations.getNextTaskType();

      // Then: should skip excluded tilesExporting and return polygon-parts
      expect(result).toBe(TASK_TYPES.polygonParts);
    });

    it('should return undefined when current task is the last in flow', () => {
      // Given: current task is last in flow
      mockTask.type = TASK_TYPES.finalize;

      // When: getting next task type
      const result = operations.getNextTaskType();

      // Then: should return undefined
      expect(result).toBeUndefined();
    });

    it('should skip excluded types and find next valid task', () => {
      // Given: custom flow with multiple excluded types
      const customTaskFlow: TaskTypes = [TASK_TYPES.init, TASK_TYPES.export, TASK_TYPES.polygonParts, TASK_TYPES.finalize];
      const customExcludedTypes: TaskTypes = [TASK_TYPES.export, TASK_TYPES.polygonParts];
      const customTask = createTestTask(mockJob.id, TASK_TYPES.init);

      const customOperations = new TaskWorker(
        mockLogger,
        mockConfig,
        mockJobManager,
        mockJob,
        customTask,
        customTaskFlow,
        customExcludedTypes
      );

      // When: getting next task type
      const result = customOperations.getNextTaskType();

      // Then: should skip excluded types and return finalize
      expect(result).toBe(TASK_TYPES.finalize);
    });
  });

  describe('shouldSkipTaskCreation', () => {
    it('should return true for excluded task types', () => {
      // Given: task type is in excluded types
      const excludedTaskType = TASK_TYPES.export;

      // When: checking if task creation should be skipped
      const result = operations.shouldSkipTaskCreation(excludedTaskType);

      // Then: should return true
      expect(result).toBe(true);
    });

    it('should return false for non-excluded task types', () => {
      // Given: task type is not in excluded types
      const nonExcludedTaskType = TASK_TYPES.init;

      // When: checking if task creation should be skipped
      const result = operations.shouldSkipTaskCreation(nonExcludedTaskType);

      // Then: should return false
      expect(result).toBe(false);
    });
  });

  describe('getInitTasks', () => {
    it('should return init tasks when found', async () => {
      // Given: init tasks exist
      const mockInitTask = createTestTask(mockJob.id, TASK_TYPES.init);
      mockJobManager.findTasks.mockResolvedValue([mockInitTask]);

      // When: finding init tasks
      const result = await operations.getInitTasks();

      // Then: should return init tasks and call job manager with correct parameters
      expect(result).toEqual([mockInitTask]);
      expect(mockJobManager.findTasks).toHaveBeenCalledWith({
        jobId: mockJob.id,
        type: TASK_TYPES.init,
      });
    });

    it('should return undefined when no init tasks found', async () => {
      // Given: no init tasks exist
      mockJobManager.findTasks.mockResolvedValue(null);

      // When: finding init tasks
      const result = await operations.getInitTasks();

      // Then: should return undefined
      expect(result).toBeUndefined();
    });
  });

  describe('isInitialWorkflowCompleted', () => {
    it('should return true when all tasks completed and all init tasks are completed', () => {
      // Given: all tasks completed and init tasks completed
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;
      const completedInitTasks = [
        createTestTask(mockJob.id, TASK_TYPES.init, { status: OperationStatus.COMPLETED }),
        createTestTask(mockJob.id, TASK_TYPES.init, { status: OperationStatus.COMPLETED }),
      ];

      // When: checking if initial workflow is completed
      const result = operations.isInitialWorkflowCompleted(completedInitTasks);

      // Then: should return true
      expect(result).toBe(true);
    });

    it('should return false when not all tasks completed', () => {
      // Given: not all tasks completed
      mockJob.completedTasks = 5;
      mockJob.taskCount = 10;
      const completedInitTasks = [createTestTask(mockJob.id, TASK_TYPES.init, { status: OperationStatus.COMPLETED })];

      // When: checking if initial workflow is completed
      const result = operations.isInitialWorkflowCompleted(completedInitTasks);

      // Then: should return false
      expect(result).toBe(false);
    });

    it('should return false when all tasks completed but init tasks are not completed', () => {
      // Given: all tasks completed but init tasks not completed
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;
      const incompleteInitTasks = [createTestTask(mockJob.id, TASK_TYPES.init, { status: OperationStatus.IN_PROGRESS })];

      // When: checking if initial workflow is completed
      const result = operations.isInitialWorkflowCompleted(incompleteInitTasks);

      // Then: should return false
      expect(result).toBe(false);
    });
  });
});
