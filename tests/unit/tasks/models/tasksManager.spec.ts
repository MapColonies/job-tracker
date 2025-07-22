import { ConflictError, NotFoundError } from '@map-colonies/error-types';
import { ICreateTaskBody, OperationStatus } from '@map-colonies/mc-priority-queue';
import { ExportFinalizeErrorCallbackParams, ExportFinalizeFullProcessingParams, ExportFinalizeType } from '@map-colonies/raster-shared';
import { registerDefaultConfig, clear as clearConfig, setValue, init } from '../../../mocks/configMock';
import { JOB_COMPLETED_MESSAGE } from '../../../../src/common/constants';
import { getExportJobMock, getIngestionJobMock, getSeedingJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { IrrelevantOperationStatusError } from '../../../../src/common/errors';
import { calculateTaskPercentage } from '../../../../src/utils/taskUtils';
import { setupTasksManagerTest, TasksModelTestContext } from './tasksManagerSetup';

describe('TasksManager', () => {
  let testContext: TasksModelTestContext;

  beforeEach(function () {
    registerDefaultConfig();
    testContext = setupTasksManagerTest(true);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleTaskNotification', () => {
    // test.each(polygonPartsTaskCreationTestCases)(
    //   'should create polygon-parts task and update job percentage in case of being called with a $description',
    //   async ({ getJobMock, taskType }) => {
    //     // mocks
    //     const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;

    //     const jobMock = getJobMock();
    //     const taskMock = getTaskMock(jobMock.id, {
    //       type: taskType,
    //       status: OperationStatus.COMPLETED,
    //     });

    //     const initTaskMock = getTaskMock(jobMock.id, {
    //       type: jobDefinitionsConfigMock.tasks.init,
    //       status: OperationStatus.COMPLETED,
    //     });
    //     mockFindTasks.mockResolvedValueOnce([taskMock]).mockResolvedValueOnce([initTaskMock]);

    //     mockGetJob.mockResolvedValueOnce(jobMock);

    //     // action
    //     await tasksManager.handleTaskNotification(taskMock.id);

    //     // expectation
    //     expect(mockFindTasks).toHaveBeenCalledWith({ id: taskMock.id });
    //     expect(mockGetJob).toHaveBeenCalledWith(jobMock.id);
    //     expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);
    //     expect(mockCreateTaskForJob).toHaveBeenCalledWith(jobMock.id, {
    //       parameters: {},
    //       type: jobDefinitionsConfigMock.tasks.polygonParts,
    //       blockDuplication: true,
    //     });
    //     expect(mockUpdateJob).toHaveBeenCalledTimes(1);
    //   }
    // );

    it('should create finalize task and update job percentage in case of being called with a "Completed" polygon-parts task with Completed init task', async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
        status: OperationStatus.COMPLETED,
      });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledWith({ id: mergeTaskMock.id });
      expect(mockGetJob).toHaveBeenCalledWith(ingestionJobMock.id);
      expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(ingestionJobMock.id, {
        parameters: { insertedToCatalog: false, insertedToGeoServer: false, insertedToMapproxy: false },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: true,
      });
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
    });

    // it("should do nothing in case of being called with a 'Completed' task whose job have no init task", async () => {
    //   // mocks
    //   const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
    //   const ingestionJobMock = getIngestionJobMock();
    //   const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });

    //   mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce(null);
    //   mockGetJob.mockResolvedValueOnce(ingestionJobMock);
    //   // action
    //   await tasksManager.handleTaskNotification(mergeTaskMock.id);
    //   // expectation
    //   expect(mockFindTasks).toHaveBeenCalledTimes(2);
    //   expect(mockGetJob).toHaveBeenCalledTimes(1);
    //   expect(mockCreateTaskForJob).not.toHaveBeenCalled();
    //   expect(mockUpdateJob).not.toHaveBeenCalled();
    // });

    it("should only update percentage in case of being called with a 'Completed' task whose job's init task is not 'Completed'", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.IN_PROGRESS });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledTimes(2);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).not.toHaveBeenCalled();
    });

    it("should do nothing in case of being called with a 'Completed' task but subsequent task already exists", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      mockCreateTaskForJob.mockRejectedValueOnce(new ConflictError(''));
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledTimes(2);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);
      expect(mockUpdateJob).not.toHaveBeenCalled();
    });

    it("should only update percentage in case of being called with a 'Completed' task but job isn't completed", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock({ taskCount: 5, completedTasks: 4 });
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledTimes(2);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).not.toHaveBeenCalled();
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
    });

    //ask shlomi
    // it("should only update percentage in case of being called with a 'Completed' task that's neither merge nor polygon-parts", async () => {
    //   // mocks
    //   const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
    //   const ingestionJobMock = getIngestionJobMock({ taskCount: 5, completedTasks: 4 });
    //   const finalizeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.finalize, status: OperationStatus.COMPLETED });
    //   const initTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

    //   mockFindTasks.mockResolvedValueOnce([finalizeTaskMock]).mockResolvedValueOnce([initTaskMock]);
    //   mockGetJob.mockResolvedValueOnce(ingestionJobMock);
    //   // action
    //   await tasksManager.handleTaskNotification(finalizeTaskMock.id);
    //   // expectation
    //   expect(mockFindTasks).toHaveBeenCalledTimes(2);
    //   expect(mockGetJob).toHaveBeenCalledTimes(1);
    //   expect(mockCreateTaskForJob).not.toHaveBeenCalled();
    //   expect(mockUpdateJob).toHaveBeenCalledTimes(1);
    // });

    it('should create finalize task with proper params when being called on polygon parts tasks of each job', async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;

      const ingestionNewJobMock = getIngestionJobMock({ type: jobDefinitionsConfigMock.jobs.new });
      const ingestionUpdateJobMock = getIngestionJobMock({ type: jobDefinitionsConfigMock.jobs.update });
      const ingestionSwapJobMock = getIngestionJobMock({ type: jobDefinitionsConfigMock.jobs.swapUpdate });

      const newPolygonPartsTaskMock = getTaskMock(ingestionNewJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
        status: OperationStatus.COMPLETED,
        parameters: {},
      });
      const updatePolygonPartsTaskMock = getTaskMock(ingestionUpdateJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
        status: OperationStatus.COMPLETED,
      });
      const swapPolygonPartsTaskMock = getTaskMock(ingestionSwapJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
        status: OperationStatus.COMPLETED,
      });

      const newInitTaskMock = getTaskMock(ingestionNewJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });
      const updateInitTaskMock = getTaskMock(ingestionUpdateJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.init,
        status: OperationStatus.COMPLETED,
      });
      const swapInitTaskMock = getTaskMock(ingestionSwapJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([newPolygonPartsTaskMock]).mockResolvedValueOnce([newInitTaskMock]);
      mockFindTasks.mockResolvedValueOnce([updatePolygonPartsTaskMock]).mockResolvedValueOnce([updateInitTaskMock]);
      mockFindTasks.mockResolvedValueOnce([swapPolygonPartsTaskMock]).mockResolvedValueOnce([swapInitTaskMock]);

      mockGetJob.mockResolvedValueOnce(ingestionNewJobMock).mockResolvedValueOnce(ingestionUpdateJobMock).mockResolvedValueOnce(ingestionSwapJobMock);

      mockCreateTaskForJob.mockResolvedValue();
      // action
      await tasksManager.handleTaskNotification(newPolygonPartsTaskMock.id);
      await tasksManager.handleTaskNotification(updatePolygonPartsTaskMock.id);
      await tasksManager.handleTaskNotification(swapPolygonPartsTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledTimes(6);
      expect(mockGetJob).toHaveBeenCalledTimes(3);
      expect(mockCreateTaskForJob).toHaveBeenCalledTimes(3);
      expect(mockUpdateJob).toHaveBeenCalledTimes(3);
      expect(mockCreateTaskForJob).toHaveBeenCalledTimes(3);
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(ingestionNewJobMock.id, {
        parameters: { insertedToMapproxy: false, insertedToGeoServer: false, insertedToCatalog: false },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: true,
      });
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(ingestionUpdateJobMock.id, {
        parameters: { updatedInCatalog: false },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: true,
      });
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(ingestionSwapJobMock.id, {
        parameters: { updatedInCatalog: false, updatedInMapproxy: false },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: true,
      });
    });

    it('Should throw NotFoundError if the given task does not exist', async () => {
      // mocks
      const { tasksManager, mockFindTasks, jobDefinitionsConfigMock } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce(null);
      // action/expectations
      await expect(tasksManager.handleTaskNotification(mergeTaskMock.id)).rejects.toThrow(NotFoundError);
    });

    it("Should fail the job if the given task's status is 'Failed' and task shouldn't suspend job", async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
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

    it("Should suspend the job if the given task's status is 'Failed' and task is in suspendingTaskTypes list", async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
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

    it("Should throw IrrelevantOperationStatusError if the given task's status is neither 'Completed' nor 'Failed'", async () => {
      // mocks
      const { tasksManager, mockFindTasks, jobDefinitionsConfigMock, mockGetJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.PENDING });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
      // action/expectations
      await expect(tasksManager.handleTaskNotification(mergeTaskMock.id)).rejects.toThrow(IrrelevantOperationStatusError);
    });

    it('Should create export finalize error callback task type on failed export task', async () => {
      // mocks
      const { tasksManager, mockFindTasks, jobDefinitionsConfigMock, mockGetJob, mockCreateTaskForJob } = testContext;
      const exportJobMock = getExportJobMock();
      const exportTaskMock = getTaskMock(exportJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.export,
        status: OperationStatus.FAILED,
        reason: 'reason',
      });

      mockFindTasks.mockResolvedValueOnce([exportTaskMock]);
      mockGetJob.mockResolvedValue(exportJobMock);

      // action
      await tasksManager.handleTaskNotification(exportTaskMock.id);
      // expectation
      const createTaskBody: ICreateTaskBody<ExportFinalizeErrorCallbackParams> = {
        parameters: { callbacksSent: false, type: ExportFinalizeType.Error_Callback },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: false,
      };
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(exportJobMock.id, createTaskBody);
    });

    it('Should fail job on export finalize task', async () => {
      // mocks
      const { tasksManager, mockFindTasks, jobDefinitionsConfigMock, mockGetJob, mockUpdateJob, mockCreateTaskForJob } = testContext;
      const exportJobMock = getExportJobMock();
      const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
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

    it('Should create full processing finalize task type on successful export', async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const exportJobMock = getExportJobMock();
      const polygonPartsTaskMock = getTaskMock(exportJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
        status: OperationStatus.COMPLETED,
      });
      const initTaskMock = getTaskMock(exportJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([polygonPartsTaskMock]).mockResolvedValueOnce([initTaskMock]);
      mockGetJob.mockResolvedValueOnce(exportJobMock);
      // action
      await tasksManager.handleTaskNotification(polygonPartsTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledWith({ id: polygonPartsTaskMock.id });
      expect(mockGetJob).toHaveBeenCalledWith(exportJobMock.id);
      expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);

      const fullProccessingFinalizeTaskType: ICreateTaskBody<ExportFinalizeFullProcessingParams> = {
        parameters: { type: ExportFinalizeType.Full_Processing, callbacksSent: false, gpkgModified: false, gpkgUploadedToS3: false },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: false,
      };
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(exportJobMock.id, fullProccessingFinalizeTaskType);
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
    });

    it('Should complete job when finalize is completed', async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      const job = getIngestionJobMock();
      const finalizeTaskMock = getTaskMock(job.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        reason: JOB_COMPLETED_MESSAGE,
      });

      mockFindTasks.mockResolvedValue([finalizeTaskMock]);
      mockGetJob.mockResolvedValue(job);

      await tasksManager.handleTaskNotification(finalizeTaskMock.id);

      expect(mockUpdateJob).toHaveBeenCalledWith(job.id, { status: OperationStatus.COMPLETED, reason: finalizeTaskMock.reason, percentage: 100 });
    });

    it('Should create next task when export finalize FullProcessing completed', async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockCreateTaskForJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      setValue('taskFlowManager.exportTasksFlow', ['init', 'tilesExporting', 'polygon-parts', 'finalize', 'polygon-parts']);
      init();
      const mockReason = 'finalize task failed';
      const job = getExportJobMock();
      const mockExportFullProcessingFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: true,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      };
      const finalizeTaskMock = getTaskMock(job.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        reason: mockReason,
        parameters: mockExportFullProcessingFinalizeTaskParams,
      });

      mockFindTasks.mockResolvedValue([finalizeTaskMock]);
      mockGetJob.mockResolvedValue(job);

      await tasksManager.handleTaskNotification(finalizeTaskMock.id);

      expect(mockCreateTaskForJob).toHaveBeenCalledWith(job.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
        parameters: {},
        blockDuplication: false,
      });
    });

    it('Should fail export job when export finalize ErrorCallback completed', async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      setValue('taskFlowManager.exportTasksFlow', ['init', 'tilesExporting', 'polygon-parts', 'finalize', 'polygon-parts']);
      init();
      const job = getExportJobMock({ failedTasks: 1, taskCount: 6 });
      const mockExportErrorCallbackTaskParams: ExportFinalizeErrorCallbackParams = {
        type: ExportFinalizeType.Error_Callback,
        callbacksSent: false,
      };
      const finalizeTaskMock = getTaskMock(job.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: mockExportErrorCallbackTaskParams,
      });

      mockFindTasks.mockResolvedValue([finalizeTaskMock]);
      mockGetJob.mockResolvedValue(job);

      await tasksManager.handleTaskNotification(finalizeTaskMock.id);

      expect(mockUpdateJob).toHaveBeenCalledWith(job.id, { percentage: calculateTaskPercentage(job.completedTasks, job.taskCount) });
    });

    it('Should fail a job on a failed export task', async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      const exportJobMock = getExportJobMock();
      const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
      const exportTaskMock = getTaskMock(exportJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.export,
        status: OperationStatus.FAILED,
        reason: 'some error message',
        parameters: mockExportErrorFinalizeTaskParams,
      });

      mockFindTasks.mockResolvedValue([exportTaskMock]);
      //mockFindTasks.mockResolvedValueOnce([finalizeTaskMock]);
      mockGetJob.mockResolvedValue(exportJobMock);
      // action
      await tasksManager.handleTaskNotification(exportTaskMock.id);
      // expectation
      expect(mockUpdateJob).toHaveBeenCalledWith(exportJobMock.id, { status: OperationStatus.FAILED, reason: exportTaskMock.reason });
    });

    it('Should fail a job on a failed export init task', async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      const exportJobMock = getExportJobMock();
      const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
      const exportTaskMock = getTaskMock(exportJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.init,
        status: OperationStatus.FAILED,
        reason: 'some error message',
        parameters: mockExportErrorFinalizeTaskParams,
      });

      mockFindTasks.mockResolvedValue([exportTaskMock]);
      //mockFindTasks.mockResolvedValueOnce([finalizeTaskMock]);
      mockGetJob.mockResolvedValue(exportJobMock);
      // action
      await tasksManager.handleTaskNotification(exportTaskMock.id);
      // expectation
      expect(mockUpdateJob).toHaveBeenCalledWith(exportJobMock.id, { status: OperationStatus.FAILED, reason: exportTaskMock.reason });
    });

    //should remove?
    it('Should not update job to completed on a completed error callback export finalize task', async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
      const exportJobMock = getExportJobMock();
      exportJobMock.failedTasks = 1;
      exportJobMock.taskCount++;
      exportJobMock.status = OperationStatus.FAILED;
      const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
      const exportTaskMock = getTaskMock(exportJobMock.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        reason: 'some error message',
        parameters: mockExportErrorFinalizeTaskParams,
      });
      const expectedPercentage = calculateTaskPercentage(exportJobMock.completedTasks, exportJobMock.taskCount);

      mockFindTasks.mockResolvedValue([exportTaskMock]);
      mockGetJob.mockResolvedValue(exportJobMock);
      // action
      await tasksManager.handleTaskNotification(exportTaskMock.id);
      // expectation
      expect(mockUpdateJob).toHaveBeenCalledWith(exportJobMock.id, { percentage: expectedPercentage });
      expect(expectedPercentage).toBeLessThan(100);
    });

    it('Should fail a job on a failed seeding task', async () => {
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

    it('Should update job on a completed seeding task', async () => {
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockUpdateJob } = testContext;
      const seedingJob = getSeedingJobMock({ taskCount: 6, completedTasks: 4 });
      const seedTaskMock = getTaskMock(seedingJob.id, { type: jobDefinitionsConfigMock.tasks.seed, status: OperationStatus.COMPLETED });
      const desiredPercentage = calculateTaskPercentage(seedingJob.completedTasks, seedingJob.taskCount);

      mockFindTasks.mockResolvedValue([seedTaskMock]);
      mockGetJob.mockResolvedValue(seedingJob);
      // action
      await tasksManager.handleTaskNotification(seedTaskMock.id);
      // expectation
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
      expect(mockUpdateJob).toHaveBeenCalledWith(seedingJob.id, { percentage: desiredPercentage });
    });

    it('Should set job to completed on completion of all tasks', async () => {
      const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockUpdateJob } = testContext;
      const seedingJob = getSeedingJobMock({ taskCount: 6, completedTasks: 6 });
      const seedTaskMock = getTaskMock(seedingJob.id, { type: jobDefinitionsConfigMock.tasks.seed, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValue([seedTaskMock]);
      mockGetJob.mockResolvedValue(seedingJob);
      // action
      await tasksManager.handleTaskNotification(seedTaskMock.id);
      // expectation
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
      expect(mockUpdateJob).toHaveBeenCalledWith(seedingJob.id, {
        status: OperationStatus.COMPLETED,
        percentage: 100,
        reason: JOB_COMPLETED_MESSAGE,
      });
    });
  });
});
