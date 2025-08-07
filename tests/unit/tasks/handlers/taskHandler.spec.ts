import { BadRequestError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { TaskWorker } from '../../../../src/tasks/handlers/taskHandler';
import { IConfig, TaskTypes, IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { getExportJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';

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

describe('WorkflowTaskOperations', () => {
  let operations: TaskWorker;
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

    // Extract config values once per test
    jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
    taskFlowConfig = configMock.get<{
      exportTasksFlow: string[];
    }>('taskFlowManager');

    mockLogger = createMockLogger();
    mockJobManager = createMockJobManager();
    mockJob = getExportJobMock({ type: jobDefinitionsConfig.jobs.export });
    mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED });

    operations = new TaskWorker(
      mockLogger,
      mockConfig,
      mockJobManager,
      mockJob,
      mockTask,
      taskFlowConfig.exportTasksFlow as unknown as TaskTypes,
      ['tilesExporting'] as TaskTypes
    );
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('getTaskParameters', () => {
    it('should return task parameters for valid job and task type', () => {
      // Given: valid job type and task type combination
      const jobType = jobDefinitionsConfig.jobs.export;
      const taskType = jobDefinitionsConfig.tasks.finalize;

      // When: getting task parameters
      const result = operations.getTaskParameters(jobType, taskType);

      // Then: should return expected finalize task parameters
      expect(result).toStrictEqual({
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
      }).toThrow(new BadRequestError('task parameters for InvalidJob_InvalidTask do not exist'));
    });
  });

  describe('getNextTaskType', () => {
    it('should return next task type when current task is in flow', () => {
      // Given: current task is first in flow
      mockTask.type = jobDefinitionsConfig.tasks.init;

      // When: getting next task type
      const result = operations.getNextTaskType();

      // Then: should skip excluded tilesExporting and return polygon-parts
      expect(result).toBe(jobDefinitionsConfig.tasks.polygonParts);
    });

    it('should return undefined when current task is the last in flow', () => {
      // Given: current task is last in flow
      mockTask.type = jobDefinitionsConfig.tasks.finalize;

      // When: getting next task type
      const result = operations.getNextTaskType();

      // Then: should return undefined
      expect(result).toBeUndefined();
    });

    it('should skip excluded types and find next valid task', () => {
      // Given: custom flow with multiple excluded types
      const customTaskFlow: TaskTypes = [
        jobDefinitionsConfig.tasks.init,
        jobDefinitionsConfig.tasks.export,
        jobDefinitionsConfig.tasks.polygonParts,
        jobDefinitionsConfig.tasks.finalize,
      ];
      const customExcludedTypes: TaskTypes = [jobDefinitionsConfig.tasks.export, jobDefinitionsConfig.tasks.polygonParts];
      const customTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED });

      const customOperations = new TaskWorker(mockLogger, mockConfig, mockJobManager, mockJob, customTask, customTaskFlow, customExcludedTypes);

      // When: getting next task type
      const result = customOperations.getNextTaskType();

      // Then: should skip excluded types and return finalize
      expect(result).toBe(jobDefinitionsConfig.tasks.finalize);
    });

    it('should return undefined when current task type is not in flow', () => {
      // Given: current task type is not in the task flow
      mockTask.type = 'unknownTaskType';

      // When: getting next task type
      const result = operations.getNextTaskType();

      // Then: should return undefined since the current task type is not found in the flow
      expect(result).toBeUndefined();
    });

    it('should return next task type when no exclusions apply', () => {
      // Given: custom flow with no excluded types
      const customTaskFlow: TaskTypes = [jobDefinitionsConfig.tasks.init, jobDefinitionsConfig.tasks.merge, jobDefinitionsConfig.tasks.finalize];
      const customExcludedTypes: TaskTypes = [];
      const customTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED });

      const customOperations = new TaskWorker(mockLogger, mockConfig, mockJobManager, mockJob, customTask, customTaskFlow, customExcludedTypes);

      // When: getting next task type
      const result = customOperations.getNextTaskType();

      // Then: should return the immediate next task type without skipping
      expect(result).toBe(jobDefinitionsConfig.tasks.merge);
    });

    it('should return undefined when reaching end of task flow', () => {
      // Given: current task is the last task in the flow
      const customTaskFlow: TaskTypes = [jobDefinitionsConfig.tasks.init, jobDefinitionsConfig.tasks.finalize];
      const customExcludedTypes: TaskTypes = [];
      const customTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.finalize, status: OperationStatus.COMPLETED });

      const customOperations = new TaskWorker(mockLogger, mockConfig, mockJobManager, mockJob, customTask, customTaskFlow, customExcludedTypes);

      // When: getting next task type
      const result = customOperations.getNextTaskType();

      // Then: should return undefined since there are no more tasks in the flow
      expect(result).toBeUndefined();
    });
  });

  describe('shouldSkipTaskCreation', () => {
    it('should return true for excluded task types', () => {
      // Given: task type is in excluded types
      const excludedTaskType = jobDefinitionsConfig.tasks.export;

      // When: checking if task creation should be skipped
      const result = operations.shouldSkipTaskCreation(excludedTaskType);

      // Then: should return true
      expect(result).toBe(true);
    });

    it('should return false for non-excluded task types', () => {
      // Given: task type is not in excluded types
      const nonExcludedTaskType = jobDefinitionsConfig.tasks.init;

      // When: checking if task creation should be skipped
      const result = operations.shouldSkipTaskCreation(nonExcludedTaskType);

      // Then: should return false
      expect(result).toBe(false);
    });
  });

  describe('getInitTasks', () => {
    it('should return init tasks when found', async () => {
      // Given: init tasks exist
      const mockInitTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED });
      mockJobManager.findTasks.mockResolvedValue([mockInitTask]);

      // When: finding init tasks
      const result = await operations.getInitTasks();

      // Then: should return init tasks and call job manager with correct parameters
      expect(result).toEqual([mockInitTask]);
      expect(mockJobManager.findTasks).toHaveBeenCalledWith({
        jobId: mockJob.id,
        type: jobDefinitionsConfig.tasks.init,
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
        getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED }),
        getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED }),
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
      const completedInitTasks = [getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED })];

      // When: checking if initial workflow is completed
      const result = operations.isInitialWorkflowCompleted(completedInitTasks);

      // Then: should return false
      expect(result).toBe(false);
    });

    it('should return false when all tasks completed but init tasks are not completed', () => {
      // Given: all tasks completed but init tasks not completed
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;
      const incompleteInitTasks = [getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.IN_PROGRESS })];

      // When: checking if initial workflow is completed
      const result = operations.isInitialWorkflowCompleted(incompleteInitTasks);

      // Then: should return false
      expect(result).toBe(false);
    });
  });
});
