import { BadRequestError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { WorkflowTaskOperations } from '../../../../src/tasks/handlers/workflowTaskHandler';
import { IConfig, IJobDefinitionsConfig, TaskTypeArray } from '../../../../src/common/interfaces';
import { getExportJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';

describe('WorkflowTaskOperations', () => {
  let operations: WorkflowTaskOperations;
  let mockLogger: Logger;
  let mockJobManager: jest.Mocked<JobManagerClient>;
  let mockJob: IJobResponse<unknown, unknown>;
  let mockTask: ITaskResponse<unknown>;
  let mockConfig: IConfig;
  let tasksFlow: TaskTypeArray;
  let excludedTypes: TaskTypeArray;

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
      findTasks: jest.fn(),
    } as unknown as jest.Mocked<JobManagerClient>;

    mockJob = getExportJobMock();
    mockTask = getTaskMock(mockJob.id);

    tasksFlow = ['init', 'tilesExporting', 'finalize'];
    excludedTypes = ['tilesExporting'];

    operations = new WorkflowTaskOperations(mockLogger, mockConfig, mockJobManager, mockJob, mockTask, tasksFlow, excludedTypes);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('getTaskParameters', () => {
    it('should return task parameters for valid job and task type', () => {
      const jobType = 'Export';
      const taskType = 'finalize';

      const result = operations.getTaskParameters(jobType, taskType);

      expect(result).toBeDefined();
      expect(result).toEqual({
        type: 'FullProcessing',
        gpkgModified: false,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      });
    });

    it('should throw BadRequestError for invalid job and task type combination', () => {
      const jobType = 'invalidJob';
      const taskType = 'invalidTask';

      expect(() => {
        operations.getTaskParameters(jobType, taskType);
      }).toThrow(BadRequestError);

      expect(() => {
        operations.getTaskParameters(jobType, taskType);
      }).toThrow('task parameters for invalidJob_invalidTask do not exist');
    });
  });

  describe('getNextTaskType', () => {
    it('should return next task type when current task is in flow', () => {
      mockTask.type = 'init';

      const result = operations.getNextTaskType();

      // Should skip tilesExporting (excluded) and return finalize
      expect(result).toBe('finalize');
    });

    it('should return undefined when current task is the last in flow', () => {
      mockTask.type = 'finalize';

      const result = operations.getNextTaskType();

      expect(result).toBeUndefined();
    });

    it('should skip excluded types and find next valid task', () => {
      tasksFlow = ['init', 'tilesExporting', 'polygon-parts', 'finalize'];
      excludedTypes = ['tilesExporting', 'polygon-parts'];

      operations = new WorkflowTaskOperations(
        mockLogger,
        mockConfig,
        mockJobManager,
        mockJob,
        { ...mockTask, type: 'init' },
        tasksFlow,
        excludedTypes
      );

      const result = operations.getNextTaskType();

      expect(result).toBe('finalize');
    });
  });

  describe('shouldSkipTaskCreation', () => {
    it('should return true for excluded task types', () => {
      const result = operations.shouldSkipTaskCreation('tilesExporting');

      expect(result).toBe(true);
    });

    it('should return false for non-excluded task types', () => {
      const result = operations.shouldSkipTaskCreation('init');

      expect(result).toBe(false);
    });
  });

  describe('findInitTasks', () => {
    it('should return init tasks when found', async () => {
      const mockInitTasks = [getTaskMock(mockJob.id)];
      mockJobManager.findTasks.mockResolvedValue(mockInitTasks);

      const result = await operations.findInitTasks();

      expect(result).toEqual(mockInitTasks);
      expect(mockJobManager.findTasks).toHaveBeenCalledWith({
        jobId: mockJob.id,
        type: mockConfig.get<IJobDefinitionsConfig>('jobDefinitions').tasks.init,
      });
    });

    it('should return undefined when no init tasks found', async () => {
      mockJobManager.findTasks.mockResolvedValue(null);

      const result = await operations.findInitTasks();

      expect(result).toBeUndefined();
    });
  });

  describe('isInitialWorkflowCompleted', () => {
    it('should return true when all tasks completed and all init tasks are completed', () => {
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;
      const initTasks = [
        { ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED },
        { ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED },
      ];

      const result = operations.isInitialWorkflowCompleted(initTasks);

      expect(result).toBe(true);
    });

    it('should return false when not all tasks completed', () => {
      mockJob.completedTasks = 5;
      mockJob.taskCount = 10;
      const initTasks = [{ ...getTaskMock(mockJob.id), status: OperationStatus.COMPLETED }];

      const result = operations.isInitialWorkflowCompleted(initTasks);

      expect(result).toBe(false);
    });

    it('should return false when all tasks completed but init tasks are not completed', () => {
      mockJob.completedTasks = 10;
      mockJob.taskCount = 10;
      const initTasks = [{ ...getTaskMock(mockJob.id), status: OperationStatus.IN_PROGRESS }];

      const result = operations.isInitialWorkflowCompleted(initTasks);

      expect(result).toBe(false);
    });
  });
});
