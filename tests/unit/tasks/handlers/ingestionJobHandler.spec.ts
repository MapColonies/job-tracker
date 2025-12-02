import { JobManagerClient, OperationStatus, IJobResponse, ITaskResponse, ICreateTaskBody } from '@map-colonies/mc-priority-queue';
import { BaseIngestionValidationTaskParams, JobTypes } from '@map-colonies/raster-shared';
import jsLogger from '@map-colonies/js-logger';
import { IConfig, IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { createTestJob, getTaskMock } from '../../../mocks/jobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';
import { TaskHandler } from '../../../../src/tasks/handlers/taskHandler';
import { IngestionJobHandler } from '../../../../src/tasks/handlers/ingestion/ingestionHandler';
import { getJobHandler } from '../../../../src/tasks/handlers/jobHandlerFactory';
import { mockJobManager, queueClientMock } from '../../../mocks/mockJobManager';

describe('IngestionJobHandler', () => {
  let mockJob: IJobResponse<unknown, unknown>;
  let mockTask: ITaskResponse<unknown>;
  let mockConfig: IConfig;
  let jobDefinitionsConfig: IJobDefinitionsConfig;
  let getNextTaskTypeSpy: jest.SpyInstance;
  let shouldSkipTaskCreationSpy: jest.SpyInstance;
  let isProceedableMock: jest.SpyInstance;
  let findTaskSpy: jest.SpyInstance;

  const mockLogger = jsLogger({ enabled: false });

  beforeEach(() => {
    registerDefaultConfig();
    mockConfig = configMock;

    // Extract config values
    jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');

    getNextTaskTypeSpy = jest.spyOn(TaskHandler.prototype, 'getNextTaskType');
    shouldSkipTaskCreationSpy = jest.spyOn(TaskHandler.prototype, 'shouldSkipTaskCreation');
    isProceedableMock = jest.spyOn(IngestionJobHandler.prototype, 'isProceedable');
    findTaskSpy = jest.spyOn(JobManagerClient.prototype, 'findTasks');

    mockJob = createTestJob(jobDefinitionsConfig.jobs.new);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleCompletedNotification', () => {
    it('should create next task type for "validation" task if its completed and valid', async () => {
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      mockTask = getTaskMock<BaseIngestionValidationTaskParams>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED,
        parameters: { isValid: true },
      });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);
      const nextTaskType = jobDefinitionsConfig.tasks.mergeTaskCreation;

      getNextTaskTypeSpy.mockReturnValue(nextTaskType);
      findTaskSpy.mockImplementation(() => [mockTask]);
      mockJobManager.findTasks.mockResolvedValue([mockTask]);
      isProceedableMock.mockImplementation(() => {
        return { result: true };
      });
      shouldSkipTaskCreationSpy.mockReturnValue(false);

      const action = async () => handler.handleCompletedNotification();

      await expect(action()).resolves.not.toThrow();
      expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledWith(mockJob.id, {
        blockDuplication: true,
        parameters: {},
        type: nextTaskType,
      } satisfies ICreateTaskBody<unknown>);
    });

    it('should suspend job in case of completed "validation" task notify which is invalid', async () => {
      mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
      mockTask = getTaskMock<BaseIngestionValidationTaskParams>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED,
        parameters: { isValid: false },
      });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);
      const nextTaskType = jobDefinitionsConfig.tasks.mergeTaskCreation;

      getNextTaskTypeSpy.mockReturnValue(nextTaskType);
      mockJobManager.findTasks.mockResolvedValue([mockTask]);
      const suspendedReason = 'Invalid validation task';
      isProceedableMock.mockImplementation(() => {
        return { result: false, reason: suspendedReason };
      });

      const action = async () => handler.handleCompletedNotification();

      await expect(action()).resolves.not.toThrow();
      expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, { status: OperationStatus.SUSPENDED, reason: suspendedReason });
      expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
    });

    it('should create next task type on completed "create-merge-tasks" task notify in case all other tasks are completed', async () => {
      mockJob = { ...mockJob, completedTasks: 4, taskCount: 4 };
      mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.mergeTaskCreation, status: OperationStatus.COMPLETED });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);
      const nextTaskType = jobDefinitionsConfig.tasks.finalize;

      getNextTaskTypeSpy.mockReturnValue(nextTaskType);
      mockJobManager.findTasks.mockResolvedValue([mockTask]);
      isProceedableMock.mockImplementation(() => {
        return { result: true };
      });
      shouldSkipTaskCreationSpy.mockReturnValue(false);

      const action = async () => handler.handleCompletedNotification();

      await expect(action()).resolves.not.toThrow();
      expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({ blockDuplication: true, type: nextTaskType })
      );
    });

    it('should skip task creation in case of merge task type completed notify which is excluded', async () => {
      mockJob = { ...mockJob, completedTasks: 2, taskCount: 3 };
      mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);
      const nextTaskType = jobDefinitionsConfig.tasks.finalize;

      getNextTaskTypeSpy.mockReturnValue(nextTaskType);
      mockJobManager.findTasks.mockResolvedValue([mockTask]);
      isProceedableMock.mockImplementation(() => {
        return { result: true };
      });
      shouldSkipTaskCreationSpy.mockReturnValue(false);

      const action = async () => handler.handleCompletedNotification();

      await expect(action()).resolves.not.toThrow();
      expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
    });

    it('should create next task type in case of merge task type completed notify which is excluded', async () => {
      mockJob = { ...mockJob, completedTasks: 4, taskCount: 4 };
      mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);
      const nextTaskType = jobDefinitionsConfig.tasks.finalize;

      getNextTaskTypeSpy.mockReturnValue(nextTaskType);
      mockJobManager.findTasks.mockResolvedValue([mockTask]);
      isProceedableMock.mockImplementation(() => {
        return { result: true };
      });
      shouldSkipTaskCreationSpy.mockReturnValue(false);

      const action = async () => handler.handleCompletedNotification();

      await expect(action()).resolves.not.toThrow();
      expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.createTaskForJob).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({ blockDuplication: true, type: nextTaskType })
      );
    });

    it('should complete job on completed "finalize" task notify', async () => {
      mockJob = { ...mockJob, completedTasks: 4, taskCount: 4 };
      mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.finalize, status: OperationStatus.COMPLETED });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);

      getNextTaskTypeSpy.mockReturnValue(undefined);
      mockJobManager.findTasks.mockResolvedValue([mockTask]);
      isProceedableMock.mockImplementation(() => {
        return { result: true };
      });
      shouldSkipTaskCreationSpy.mockReturnValue(false);

      const action = async () => handler.handleCompletedNotification();

      await expect(action()).resolves.not.toThrow();
      expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, { status: OperationStatus.COMPLETED, percentage: 100 });
      expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
    });
  });

  describe('isProceedable', () => {
    it('should return "true" in case that validation task is valid', () => {
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      mockTask = getTaskMock<BaseIngestionValidationTaskParams>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED,
        parameters: { isValid: true },
      });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);

      const result = handler.isProceedable(mockTask);

      expect(result.result).toBeTruthy();
      expect(result.reason).toBeUndefined();
    });

    it('should return "false" and "Invalid validation task" in case that validation task is invalid', () => {
      mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
      mockTask = getTaskMock<BaseIngestionValidationTaskParams>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED,
        parameters: { isValid: false },
      });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);

      const result = handler.isProceedable(mockTask);

      expect(result.result).toBeFalsy();
      expect(result.reason).toMatch(/Invalid validation task/);
    });

    it('should return "true" in case task notified task type is not "validation"', () => {
      mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
      mockTask = getTaskMock<BaseIngestionValidationTaskParams>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.merge,
        status: OperationStatus.COMPLETED,
      });
      const handler = getJobHandler(JobTypes.Ingestion_New, jobDefinitionsConfig, mockLogger, queueClientMock, mockConfig, mockJob, mockTask);

      const result = handler.isProceedable(mockTask);

      expect(result.result).toBeTruthy();
      expect(result.reason).toBeUndefined();
    });
  });
});
