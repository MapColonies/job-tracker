import { JobManagerClient, OperationStatus, ITaskResponse, ICreateTaskBody } from '@map-colonies/mc-priority-queue';
import jsLogger from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { createTestJob, getTaskMock } from '../../../mocks/jobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';
import { TaskHandler } from '../../../../src/tasks/handlers/taskHandler';
import { IngestionJobHandler, IngestionValidationTaskParameters } from '../../../../src/tasks/handlers/ingestion/ingestionHandler';
import { getJobHandler } from '../../../../src/tasks/handlers/jobHandlerFactory';
import { mockJobManager, queueClientMock } from '../../../mocks/mockJobManager';

describe('IngestionJobHandler', () => {
  let mockTask: ITaskResponse<unknown>;
  let getNextTaskTypeSpy: jest.SpyInstance;
  let shouldSkipTaskCreationSpy: jest.SpyInstance;
  let isProceedableMock: jest.SpyInstance;
  let findTaskSpy: jest.SpyInstance;

  const mockLogger = jsLogger({ enabled: false });

  registerDefaultConfig();
  const jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
  const testCases = [
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.new) },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.update) },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.swapUpdate) },
  ];

  const testCaseHandlerLog = '$mockJob.type handler';

  beforeEach(() => {
    registerDefaultConfig();

    getNextTaskTypeSpy = jest.spyOn(TaskHandler.prototype, 'getNextTaskType');
    shouldSkipTaskCreationSpy = jest.spyOn(TaskHandler.prototype, 'shouldSkipTaskCreation');
    isProceedableMock = jest.spyOn(IngestionJobHandler.prototype, 'isProceedable');
    findTaskSpy = jest.spyOn(JobManagerClient.prototype, 'findTasks');
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleCompletedNotification', () => {
    it.each(testCases)(`should create next task type for "validation" task if its completed and valid - ${testCaseHandlerLog}`, async (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED,
        parameters: { isValid: true },
      });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
      const nextTaskType = jobDefinitionsConfig.tasks.createTasks;

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

    it.each(testCases)(
      `should suspend job in case of completed "validation" task notify which is invalid - ${testCaseHandlerLog}`,
      async (testCase) => {
        let { mockJob } = testCase;
        mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
        mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.COMPLETED,
          parameters: { isValid: false },
        });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
        const nextTaskType = jobDefinitionsConfig.tasks.createTasks;

        getNextTaskTypeSpy.mockReturnValue(nextTaskType);
        mockJobManager.findTasks.mockResolvedValue([mockTask]);
        isProceedableMock.mockReturnValue(false);

        const action = async () => handler.handleCompletedNotification();

        await expect(action()).resolves.not.toThrow();
        expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, { status: OperationStatus.SUSPENDED, reason: mockTask.reason });
        expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
      }
    );

    it.each(testCases)(
      `should suspend job in case of completed "validation" task notify which does not includes the "isValid" parameter - ${testCaseHandlerLog}`,
      async (testCase) => {
        let { mockJob } = testCase;
        mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
        mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.COMPLETED, // missing "isValid" parameter
        });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
        const nextTaskType = jobDefinitionsConfig.tasks.createTasks;

        getNextTaskTypeSpy.mockReturnValue(nextTaskType);
        mockJobManager.findTasks.mockResolvedValue([mockTask]);
        isProceedableMock.mockReturnValue(false);

        const action = async () => handler.handleCompletedNotification();

        await expect(action()).resolves.not.toThrow();
        expect(mockJobManager.updateJob).toHaveBeenCalledTimes(1);
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, { status: OperationStatus.SUSPENDED, reason: mockTask.reason });
        expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
      }
    );

    it.each(testCases)(
      `should create next task type on completed "create-merge-tasks" task notify in case all other tasks are completed - ${testCaseHandlerLog}`,
      async (testCase) => {
        let { mockJob } = testCase;
        mockJob = { ...mockJob, completedTasks: 4, taskCount: 4 };
        mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.createTasks, status: OperationStatus.COMPLETED });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
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
      }
    );

    it.each(testCases)(
      `should skip task creation in case of merge task type completed notify which is excluded - ${testCaseHandlerLog}`,
      async (testCase) => {
        let { mockJob } = testCase;
        mockJob = { ...mockJob, completedTasks: 2, taskCount: 3 };
        mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
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
      }
    );

    it.each(testCases)(
      `should create next task type in case of merge task type completed notify which is excluded - ${testCaseHandlerLog}`,
      async (testCase) => {
        let { mockJob } = testCase;
        mockJob = { ...mockJob, completedTasks: 4, taskCount: 4 };
        mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
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
      }
    );

    it.each(testCases)(`should complete job on completed "finalize" task notify - ${testCaseHandlerLog}`, async (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 4, taskCount: 4 };
      mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.finalize, status: OperationStatus.COMPLETED });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

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
    it.each(testCases)(`should return "true" in case that validation task is valid - ${testCaseHandlerLog}`, (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED,
        parameters: { isValid: true },
      });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      const result = handler.isProceedable();

      expect(result).toBeTruthy();
    });

    it.each(testCases)(
      `should return "false" and "Invalid validation task" in case that validation task is invalid - ${testCaseHandlerLog}`,
      (testCase) => {
        let { mockJob } = testCase;
        mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
        mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.COMPLETED,
          parameters: { isValid: false },
          reason: 'Invalid validation task reason',
        });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

        const result = handler.isProceedable();

        expect(result).toBeFalsy();
      }
    );

    it.each(testCases)(`should return "false" in case that validation task schema is invalid - ${testCaseHandlerLog}`, (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED, // missing "isValid" parameter
      });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      const action = () => handler.isProceedable();

      expect(action).toThrow(BadRequestError);
    });

    it.each(testCases)(`should return "true" in case task notified task type is not "validation" - ${testCaseHandlerLog}`, (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
      mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.merge,
        status: OperationStatus.COMPLETED,
      });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      const result = handler.isProceedable();

      expect(result).toBeTruthy();
    });

    it.each(testCases)(
      `should return "false" in case of failed validation task with "isValid" parameter set to true - ${testCaseHandlerLog}`,
      (testCase) => {
        let { mockJob } = testCase;
        mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
        mockTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.FAILED,
          parameters: { isValid: true },
          reason: 'failed reason',
        });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

        const result = handler.isProceedable();

        expect(result).toBeFalsy();
      }
    );
  });
});
