import { NotFoundError } from '@map-colonies/error-types';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import type { ExportFinalizeErrorCallbackParams } from '@map-colonies/raster-shared';
import { ExportFinalizeType } from '@map-colonies/raster-shared';
import { registerDefaultConfig, clear as clearConfig } from '../../../mocks/configMock';
import { createTestJob, getExportJobMock, getSeedingJobMock, getTaskMock } from '../../../mocks/jobMocks';
import { IrrelevantOperationStatusError } from '../../../../src/common/errors';
import type { TasksModelTestContext } from './tasksManagerSetup';
import { setupTasksManagerTest } from './tasksManagerSetup';

describe('TasksManager', () => {
  let testContext: TasksModelTestContext;

  beforeEach(async function () {
    registerDefaultConfig();
    testContext = await setupTasksManagerTest(true);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleTaskNotification', () => {
    describe('Failed Tasks', () => {
      it("should fail the job if the given task's status is 'Failed' and task shouldn't suspend job", async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
        const ingestionJobMock = createTestJob(jobDefinitionsConfigMock.jobs.new);
        const mergeTaskMock = getTaskMock(ingestionJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.merge,
          status: OperationStatus.FAILED,
          reason: 'reason',
        });

        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
        mockGetJob.mockResolvedValue(ingestionJobMock);
        // action
        await tasksManager.handleTaskNotification(mergeTaskMock.id);
        // expectation
        expect(mockUpdateJob).toHaveBeenCalledWith(ingestionJobMock.id, { status: OperationStatus.FAILED, reason: 'reason' });
      });

      it("should suspend the job if the given task's status is 'Failed' and task is in suspendingTaskTypes list", async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
        const ingestionJobMock = createTestJob(jobDefinitionsConfigMock.jobs.new);
        const mergeTaskMock = getTaskMock(ingestionJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.validation,
          status: OperationStatus.FAILED,
          reason: 'reason',
        });

        mockGetJob.mockResolvedValue(ingestionJobMock);
        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
        // action
        await tasksManager.handleTaskNotification(mergeTaskMock.id);
        // expectation
        expect(mockUpdateJob).toHaveBeenCalledWith(ingestionJobMock.id, { status: OperationStatus.SUSPENDED, reason: 'reason' });
      });

      it('should fail job on export finalize task', async () => {
        // mocks
        const { tasksManager, mockFindTasks, jobDefinitionsConfigMock, mockGetJob, mockUpdateJob, mockCreateTaskForJob } = testContext;
        const exportJobMock = getExportJobMock();
        const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = {
          callbacksSent: false,
          type: ExportFinalizeType.Error_Callback,
        };
        const finalizeTaskMock = getTaskMock(exportJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.finalize,
          status: OperationStatus.FAILED,
          reason: 'some error message',
          parameters: mockExportErrorFinalizeTaskParams,
        });

        mockFindTasks.mockResolvedValue([finalizeTaskMock]);
        mockGetJob.mockResolvedValue(exportJobMock);
        // action
        await tasksManager.handleTaskNotification(finalizeTaskMock.id);
        // expectation
        expect(mockUpdateJob).toHaveBeenCalledWith(exportJobMock.id, { status: OperationStatus.FAILED, reason: finalizeTaskMock.reason });
        expect(mockCreateTaskForJob).not.toHaveBeenCalled();
      });

      it('should fail a job on a failed export task', async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
        const exportJobMock = getExportJobMock();
        const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = {
          callbacksSent: false,
          type: ExportFinalizeType.Error_Callback,
        };
        const exportTaskMock = getTaskMock(exportJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.export,
          status: OperationStatus.FAILED,
          reason: 'some error message',
          parameters: mockExportErrorFinalizeTaskParams,
        });

        mockFindTasks.mockResolvedValue([exportTaskMock]);
        mockGetJob.mockResolvedValue(exportJobMock);
        // action
        await tasksManager.handleTaskNotification(exportTaskMock.id);
        // expectation
        expect(mockUpdateJob).toHaveBeenCalledWith(exportJobMock.id, { status: OperationStatus.FAILED, reason: exportTaskMock.reason });
      });

      it('should fail a job on a failed export init task', async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
        const exportJobMock = getExportJobMock();
        const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = {
          callbacksSent: false,
          type: ExportFinalizeType.Error_Callback,
        };
        const exportTaskMock = getTaskMock(exportJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.init,
          status: OperationStatus.FAILED,
          reason: 'some error message',
          parameters: mockExportErrorFinalizeTaskParams,
        });

        mockFindTasks.mockResolvedValue([exportTaskMock]);
        mockGetJob.mockResolvedValue(exportJobMock);
        // action
        await tasksManager.handleTaskNotification(exportTaskMock.id);
        // expectation
        expect(mockUpdateJob).toHaveBeenCalledWith(exportJobMock.id, { status: OperationStatus.FAILED, reason: exportTaskMock.reason });
      });

      it('should fail a job on a failed seeding task', async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
        const seedingJob = getSeedingJobMock();
        const seedTaskMock = getTaskMock(seedingJob.id, {
          type: jobDefinitionsConfigMock.tasks.seed,
          status: OperationStatus.FAILED,
          reason: 'some error reason',
        });

        mockFindTasks.mockResolvedValueOnce([seedTaskMock]);
        mockGetJob.mockResolvedValue(seedingJob);
        // action
        await tasksManager.handleTaskNotification(seedTaskMock.id);
        // expectation
        expect(mockUpdateJob).toHaveBeenCalledTimes(1);
        expect(mockUpdateJob).toHaveBeenCalledWith(seedingJob.id, { status: OperationStatus.FAILED, reason: 'some error reason' });
      });
    });

    describe('Terminated Jobs', () => {
      it('should not create a next task when a completed task notification arrives for an aborted job', async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockGetJob, mockCreateTaskForJob, mockUpdateJob, jobDefinitionsConfigMock } = testContext;
        const abortedJobMock = createTestJob(jobDefinitionsConfigMock.jobs.update, {
          status: OperationStatus.ABORTED,
          completedTasks: 10,
          taskCount: 10,
        });
        const mergeTaskMock = getTaskMock(abortedJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.merge,
          status: OperationStatus.COMPLETED,
        });

        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
        mockGetJob.mockResolvedValue(abortedJobMock);
        // action
        await tasksManager.handleTaskNotification(mergeTaskMock.id);
        // expectation
        expect(mockCreateTaskForJob).not.toHaveBeenCalled();
        expect(mockUpdateJob).not.toHaveBeenCalled();
      });

      it('should not fail an aborted job when a failed task notification arrives', async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockGetJob, mockUpdateJob, jobDefinitionsConfigMock } = testContext;
        const abortedJobMock = createTestJob(jobDefinitionsConfigMock.jobs.update, { status: OperationStatus.ABORTED });
        const mergeTaskMock = getTaskMock(abortedJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.merge,
          status: OperationStatus.FAILED,
          reason: 'reason',
        });

        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
        mockGetJob.mockResolvedValue(abortedJobMock);
        // action
        await tasksManager.handleTaskNotification(mergeTaskMock.id);
        // expectation
        expect(mockUpdateJob).not.toHaveBeenCalled();
      });

      it('should not create a next task when a completed task notification arrives for an expired job', async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockGetJob, mockCreateTaskForJob, mockUpdateJob, jobDefinitionsConfigMock } = testContext;
        const expiredJobMock = createTestJob(jobDefinitionsConfigMock.jobs.update, {
          status: OperationStatus.EXPIRED,
          completedTasks: 10,
          taskCount: 10,
        });
        const mergeTaskMock = getTaskMock(expiredJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.merge,
          status: OperationStatus.COMPLETED,
        });

        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
        mockGetJob.mockResolvedValue(expiredJobMock);
        // action
        await tasksManager.handleTaskNotification(mergeTaskMock.id);
        // expectation
        expect(mockCreateTaskForJob).not.toHaveBeenCalled();
        expect(mockUpdateJob).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should throw NotFoundError if the given task does not exist', async () => {
        // mocks
        const { tasksManager, mockFindTasks, jobDefinitionsConfigMock } = testContext;
        const ingestionJobMock = createTestJob(jobDefinitionsConfigMock.jobs.new);
        const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });

        mockFindTasks.mockResolvedValueOnce(null);
        // action/expectations
        await expect(tasksManager.handleTaskNotification(mergeTaskMock.id)).rejects.toThrow(NotFoundError);
      });

      it("should throw IrrelevantOperationStatusError if the given task's status is neither 'Completed' nor 'Failed'", async () => {
        // mocks
        const { tasksManager, mockFindTasks, jobDefinitionsConfigMock } = testContext;
        const ingestionJobMock = createTestJob(jobDefinitionsConfigMock.jobs.new);
        const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.PENDING });

        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
        // action/expectations
        await expect(tasksManager.handleTaskNotification(mergeTaskMock.id)).rejects.toThrow(IrrelevantOperationStatusError);
      });
    });
  });
});
