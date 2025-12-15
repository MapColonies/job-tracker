import jsLogger from '@map-colonies/js-logger';
import { OperationStatus, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { IJobDefinitionsConfig, IsProceedableResponse } from '../../../../src/common/interfaces';
import { createTestJob, getTaskMock } from '../../../mocks/jobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';
import { mockJobManager, queueClientMock } from '../../../mocks/mockJobManager';
import { getJobHandler } from '../../../../src/tasks/handlers/jobHandlerFactory';
import { TaskHandler } from '../../../../src/tasks/handlers/taskHandler';


describe('JobHandler', () => {
  let mockJob: IJobResponse<unknown, unknown>;
  let mockTask: ITaskResponse<unknown>;
  const mockLogger = jsLogger({ enabled: false });

  registerDefaultConfig();

  const jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
  const jobTypes = Object.values<string>(jobDefinitionsConfig.jobs);
  const testCases = [
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.new), taskType: jobDefinitionsConfig.tasks.merge },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.update), taskType: jobDefinitionsConfig.tasks.merge },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.swapUpdate), taskType: jobDefinitionsConfig.tasks.merge },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.export), taskType: jobDefinitionsConfig.tasks.export },
    { mockJob: createTestJob(jobDefinitionsConfig.jobs.seed), taskType: jobDefinitionsConfig.tasks.seed },
  ];

  const testCaseHandlerLog = '$mockJob.type handler';

  beforeEach(() => {
    registerDefaultConfig();
    mockJob = createTestJob(jobDefinitionsConfig.jobs.new);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleFailedTask', () => {
    it.each(testCases)(`should fail job when task type is failed - ${testCaseHandlerLog}`, async (testCase) => {
      let { mockJob, taskType } = testCase;
      mockTask = getTaskMock(mockJob.id, {
        type: taskType,
        status: OperationStatus.FAILED,
        reason: 'Task fail reason',
      });

      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: handling failed task
      await handler.handleFailedTask();

      // Then: job should be failed with task reason
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.FAILED,
        reason: mockTask.reason,
      });
    });
  });

  describe('handleCompletedNotification', () => {
    it.each(testCases)(`should complete job when all of the task are completed and task type is "finalize" - ${testCaseHandlerLog}`, async (testCase) => {
      let { mockJob } = testCase;
      mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
      mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.finalize, status: OperationStatus.COMPLETED });
      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

      // When: handling completed notification
      await handler.handleCompletedNotification();

      // Then: job should be completed with 100% progress
      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.COMPLETED,
        percentage: 100,
      });
    });

    it.each(testCases)(`should suspend job when its unproceedable - ${testCaseHandlerLog}`, async (testCase) => {
      let { mockJob, taskType } = testCase;
      mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
      mockTask = getTaskMock(mockJob.id, { type: taskType, status: OperationStatus.COMPLETED }); // cannot check on finalize task type as it has no next type to create

      const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
      const isProceedableResponse: IsProceedableResponse = {
        result: false,
        reason: 'suspnded reason'
      }
      jest.spyOn(TaskHandler.prototype, 'getNextTaskType').mockReturnValue('mockNextTaskType')
      jest.spyOn(handler, 'isProceedable').mockReturnValue({ result: false, reason: 'suspnded reason' });

      // When: handling completed notification
      await handler.handleCompletedNotification();

      expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
        status: OperationStatus.SUSPENDED,
        reason: isProceedableResponse.reason,
      });
    });

    it.each(testCases)(
      `should skip task creation when cannot proceed (create next task type) because of init task still in Progress - ${testCaseHandlerLog}`,
      async (testCase) => {
        let { mockJob, taskType } = testCase;
        mockTask = getTaskMock(mockJob.id, {
          type: taskType,
          status: OperationStatus.IN_PROGRESS,
        });
        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

        mockJobManager.findTasks.mockResolvedValue([mockTask]);

        // When: handling completed notification
        await handler.handleCompletedNotification();

        // Then: progress should be updated without creating new task
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
          percentage: 50, // 5/10 = 50%
        });
        expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
      }
    );

    it.each(testCases)(
      'should skip task creation when task init is completed but merging/other tasks are still in progress - %s handler',
      async (testCase) => {
        let { mockJob, taskType } = testCase;
        mockJob = { ...mockJob, completedTasks: 5, taskCount: 10 };
        mockTask = getTaskMock(mockJob.id, {
          type: taskType,
          status: OperationStatus.COMPLETED,
        });

        const handler = getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);

        mockJobManager.findTasks.mockResolvedValue([mockTask]);

        // When: handling completed notification
        await handler.handleCompletedNotification();

        // Then: progress should be updated without creating new task
        expect(mockJobManager.updateJob).toHaveBeenCalledWith(mockJob.id, {
          percentage: 50, // 5/10 = 50%
        });
        expect(mockJobManager.createTaskForJob).not.toHaveBeenCalled();
      }
    );
  });
});
