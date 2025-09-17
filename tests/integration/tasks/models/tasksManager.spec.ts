import { ConflictError } from '@map-colonies/error-types';
import { ICreateTaskBody, OperationStatus } from '@map-colonies/mc-priority-queue';
import { ExportFinalizeErrorCallbackParams, ExportFinalizeFullProcessingParams, ExportFinalizeType } from '@map-colonies/raster-shared';
import { registerDefaultConfig, clear as clearConfig, setValue, init } from '../../../mocks/configMock';
import { getExportJobMock, getIngestionJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { setupTasksManagerTest, TasksModelTestContext } from '../../../unit/tasks/models/tasksManagerSetup';
import { polygonPartsTaskCreationTestCases } from '../../../unit/tasks/models/testCases';

describe('TasksManager Business Logic Integration Tests', () => {
  let testContext: TasksModelTestContext;

  beforeEach(function () {
    registerDefaultConfig();
    testContext = setupTasksManagerTest(true);
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleTaskNotification - Business Logic Validation', () => {
    describe('Complex Task Creation Logic', () => {
      test.each(polygonPartsTaskCreationTestCases)(
        'should create polygon-parts task with correct blockDuplication for $taskType workflow',
        async ({ getJobMock, taskType }) => {
          // mocks
          const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;

          const jobMock = getJobMock();
          const taskMock = getTaskMock(jobMock.id, {
            type: taskType,
            status: OperationStatus.COMPLETED,
          });

          const initTaskMock = getTaskMock(jobMock.id, {
            type: jobDefinitionsConfigMock.tasks.init,
            status: OperationStatus.COMPLETED,
          });

          // First call - find the specific task that completed
          mockFindTasks.mockResolvedValueOnce([taskMock]);
          // Second call - find init task to check if it's completed
          mockFindTasks.mockResolvedValueOnce([initTaskMock]);
          mockGetJob.mockResolvedValueOnce(jobMock);

          // action
          await tasksManager.handleTaskNotification(taskMock.id);

          // expectation - Verify the business logic for blockDuplication
          expect(mockFindTasks).toHaveBeenCalledWith({ id: taskMock.id });
          expect(mockGetJob).toHaveBeenCalledWith(jobMock.id);
          expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);

          // blockDuplication should be true for ingestion jobs, false for export jobs
          const isIngestionJob = getJobMock === getIngestionJobMock;
          expect(mockCreateTaskForJob).toHaveBeenCalledWith(jobMock.id, {
            parameters: {},
            type: jobDefinitionsConfigMock.tasks.polygonParts,
            blockDuplication: isIngestionJob,
          });
          expect(mockUpdateJob).toHaveBeenCalledTimes(1);
        }
      );

      it.each([
        {
          jobType: 'new',
          jobTypeKey: 'new' as const,
          expectedParameters: { insertedToMapproxy: false, insertedToGeoServer: false, insertedToCatalog: false },
        },
        {
          jobType: 'update',
          jobTypeKey: 'update' as const,
          expectedParameters: { updatedInCatalog: false },
        },
        {
          jobType: 'swapUpdate',
          jobTypeKey: 'swapUpdate' as const,
          expectedParameters: { updatedInCatalog: false, updatedInMapproxy: false },
        },
      ])('should create finalize task with job-type-specific parameters for $jobType ingestion', async ({ jobTypeKey, expectedParameters }) => {
        // mocks
        const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob } = testContext;

        const jobMock = getIngestionJobMock({ type: jobDefinitionsConfigMock.jobs[jobTypeKey] });
        const polygonPartsTaskMock = getTaskMock(jobMock.id, {
          type: jobDefinitionsConfigMock.tasks.polygonParts,
          status: OperationStatus.COMPLETED,
        });
        const initTaskMock = getTaskMock(jobMock.id, {
          type: jobDefinitionsConfigMock.tasks.init,
          status: OperationStatus.COMPLETED,
        });

        mockFindTasks.mockResolvedValueOnce([polygonPartsTaskMock]).mockResolvedValueOnce([initTaskMock]);
        mockGetJob.mockResolvedValueOnce(jobMock);

        // action
        await tasksManager.handleTaskNotification(polygonPartsTaskMock.id);

        // expectation - Verify job-type-specific parameter logic
        expect(mockCreateTaskForJob).toHaveBeenCalledWith(jobMock.id, {
          parameters: expectedParameters,
          type: jobDefinitionsConfigMock.tasks.finalize,
          blockDuplication: true,
        });
      });

      it('should create export finalize task with Full_Processing type and proper defaults', async () => {
        // mocks
        const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob } = testContext;
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

        // expectation - Verify export-specific finalize task creation logic
        const fullProccessingFinalizeTaskType: ICreateTaskBody<ExportFinalizeFullProcessingParams> = {
          parameters: { type: ExportFinalizeType.Full_Processing, callbacksSent: false, gpkgModified: false, gpkgUploadedToS3: false },
          type: jobDefinitionsConfigMock.tasks.finalize,
          blockDuplication: false,
        };
        expect(mockCreateTaskForJob).toHaveBeenCalledWith(exportJobMock.id, fullProccessingFinalizeTaskType);
      });

      it('should handle workflow continuation when export finalize triggers additional tasks', async () => {
        // mocks
        const { tasksManager, mockFindTasks, mockCreateTaskForJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
        setValue('taskFlowManager.exportTasksFlow', ['init', 'tilesExporting', 'polygon-parts', 'finalize', 'polygon-parts']);
        init();

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
          parameters: mockExportFullProcessingFinalizeTaskParams,
        });

        mockFindTasks.mockResolvedValue([finalizeTaskMock]);
        mockGetJob.mockResolvedValue(job);

        // action
        await tasksManager.handleTaskNotification(finalizeTaskMock.id);

        // expectation - Verify workflow continuation logic
        expect(mockCreateTaskForJob).toHaveBeenCalledWith(job.id, {
          type: jobDefinitionsConfigMock.tasks.polygonParts,
          parameters: {},
          blockDuplication: false,
        });
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle ConflictError gracefully without updating progress', async () => {
        // mocks
        const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
        const ingestionJobMock = getIngestionJobMock();
        const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
        const initTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]);
        mockGetJob.mockResolvedValueOnce(ingestionJobMock);
        mockCreateTaskForJob.mockRejectedValueOnce(new ConflictError('Task already exists'));

        // action - should not throw
        await expect(tasksManager.handleTaskNotification(mergeTaskMock.id)).resolves.not.toThrow();

        // expectation - Verify graceful conflict handling
        expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);
        expect(mockUpdateJob).not.toHaveBeenCalled(); // No progress update on conflict
      });

      it("should only update job percentage on 'Completed' task which is not the last", async () => {
        // mocks
        const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
        const ingestionJobMock = getIngestionJobMock({ taskCount: 5, completedTasks: 4 });
        const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
        const initTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

        mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]);
        mockGetJob.mockResolvedValueOnce(ingestionJobMock);

        // action
        await tasksManager.handleTaskNotification(mergeTaskMock.id);

        expect(mockCreateTaskForJob).not.toHaveBeenCalled(); // Shouldn't proceed as job is not ready for next task
        expect(mockUpdateJob).toHaveBeenCalledTimes(1);
      });

      it('should handle export finalize error callback task creation', async () => {
        // mocks
        const { tasksManager, mockFindTasks, jobDefinitionsConfigMock, mockGetJob, mockCreateTaskForJob } = testContext;
        const exportJobMock = getExportJobMock();
        const exportTaskMock = getTaskMock(exportJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.export,
          status: OperationStatus.FAILED,
          reason: 'Export processing failed',
        });

        mockFindTasks.mockResolvedValueOnce([exportTaskMock]);
        mockGetJob.mockResolvedValue(exportJobMock);

        // action
        await tasksManager.handleTaskNotification(exportTaskMock.id);

        // expectation - Verify error callback task creation logic
        const createTaskBody: ICreateTaskBody<ExportFinalizeErrorCallbackParams> = {
          parameters: { callbacksSent: false, type: ExportFinalizeType.Error_Callback },
          type: jobDefinitionsConfigMock.tasks.finalize,
          blockDuplication: false,
        };
        expect(mockCreateTaskForJob).toHaveBeenCalledWith(exportJobMock.id, createTaskBody);
      });

      it.each([
        {
          taskType: 'init',
          jobType: 'ingestion',
          getJobMock: () => getIngestionJobMock(),
          taskTypeKey: 'init' as const,
          reason: 'Init task failed due to invalid parameters',
        },
        {
          taskType: 'tilesMerging',
          jobType: 'ingestion',
          getJobMock: () => getIngestionJobMock(),
          taskTypeKey: 'merge' as const,
          reason: 'Tiles merging failed due to processing error',
        },
        {
          taskType: 'init',
          jobType: 'export',
          getJobMock: () => getExportJobMock(),
          taskTypeKey: 'init' as const,
          reason: 'Export init task failed due to invalid parameters',
        },
        {
          taskType: 'finalize',
          jobType: 'ingestion',
          getJobMock: () => getIngestionJobMock(),
          taskTypeKey: 'finalize' as const,
          reason: 'Finalize task failed during cleanup',
        },
        {
          taskType: 'seeding',
          jobType: 'ingestion',
          getJobMock: () => getIngestionJobMock(),
          taskTypeKey: 'seed' as const,
          reason: 'Seeding process failed due to network error',
        },
      ])('should apply correct job failure logic when $taskType task fails in $jobType job', async ({ getJobMock, taskTypeKey, reason }) => {
        // mocks
        const { tasksManager, mockFindTasks, jobDefinitionsConfigMock, mockGetJob, mockUpdateJob } = testContext;
        const jobMock = getJobMock();
        const taskMock = getTaskMock(jobMock.id, {
          type: jobDefinitionsConfigMock.tasks[taskTypeKey],
          status: OperationStatus.FAILED,
          reason,
        });

        mockFindTasks.mockResolvedValueOnce([taskMock]);
        mockGetJob.mockResolvedValue(jobMock);

        // action
        await tasksManager.handleTaskNotification(taskMock.id);

        // expectation - Verify job failure logic
        expect(mockUpdateJob).toHaveBeenCalledWith(jobMock.id, {
          status: OperationStatus.FAILED,
          reason,
        });
      });

      it('should apply suspension logic for polygon-parts task failures', async () => {
        // mocks
        const { tasksManager, mockFindTasks, jobDefinitionsConfigMock, mockGetJob, mockUpdateJob } = testContext;
        const ingestionJobMock = getIngestionJobMock();
        const polygonPartsTaskMock = getTaskMock(ingestionJobMock.id, {
          type: jobDefinitionsConfigMock.tasks.polygonParts,
          status: OperationStatus.FAILED,
          reason: 'Polygon parts processing failed',
        });

        mockFindTasks.mockResolvedValueOnce([polygonPartsTaskMock]);
        mockGetJob.mockResolvedValue(ingestionJobMock);

        // action
        await tasksManager.handleTaskNotification(polygonPartsTaskMock.id);

        // expectation - Verify suspension logic for polygon-parts failures
        expect(mockUpdateJob).toHaveBeenCalledWith(ingestionJobMock.id, {
          status: OperationStatus.SUSPENDED,
          reason: 'Polygon parts processing failed',
        });
      });
    });
  });
});
