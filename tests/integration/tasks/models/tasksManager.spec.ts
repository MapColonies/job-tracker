import { ConflictError } from '@map-colonies/error-types';
import { ICreateTaskBody, OperationStatus } from '@map-colonies/mc-priority-queue';
import { ExportFinalizeErrorCallbackParams, ExportFinalizeFullProcessingParams, ExportFinalizeType } from '@map-colonies/raster-shared';
import { registerDefaultConfig, clear as clearConfig, setValue, init } from '../../../mocks/configMock';
import { JOB_COMPLETED_MESSAGE } from '../../../../src/common/constants';
import { getExportJobMock, getIngestionJobMock, getSeedingJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { calculateJobPercentage } from '../../../../src/utils/jobUtils';
import { setupTasksManagerTest, TasksModelTestContext } from '../../../unit/tasks/models/tasksManagerSetup';
import { polygonPartsTaskCreationTestCases } from '../../../unit/tasks/models/testCases';

describe('TasksManager Integration Tests', () => {
    let testContext: TasksModelTestContext;

    beforeEach(function () {
        registerDefaultConfig();
        testContext = setupTasksManagerTest(true);
    });

    afterEach(() => {
        clearConfig();
        jest.resetAllMocks();
    });

    describe('handleTaskNotification - Workflow Integration', () => {
        describe('Task Flow - Successful Completion', () => {
            test.each(polygonPartsTaskCreationTestCases)(
                'should create polygon-parts task and update job percentage',
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

                    // expectation
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
            ])('should create finalize task with proper params for $jobType job', async ({ jobTypeKey, expectedParameters }) => {
                // mocks
                const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;

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
                mockCreateTaskForJob.mockResolvedValue();

                // action
                await tasksManager.handleTaskNotification(polygonPartsTaskMock.id);

                // expectation
                expect(mockFindTasks).toHaveBeenCalledTimes(2);
                expect(mockGetJob).toHaveBeenCalledTimes(1);
                expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);
                expect(mockUpdateJob).toHaveBeenCalledTimes(1);
                expect(mockCreateTaskForJob).toHaveBeenCalledWith(jobMock.id, {
                    parameters: expectedParameters,
                    type: jobDefinitionsConfigMock.tasks.finalize,
                    blockDuplication: true,
                });
            });

            it('should create full processing finalize task type on successful export', async () => {
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

            it('should complete job when finalize is completed', async () => {
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

                expect(mockUpdateJob).toHaveBeenCalledWith(job.id, { status: OperationStatus.COMPLETED, percentage: 100 });
            });

            it('should create next task when export finalize FullProcessing completed', async () => {
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

            it('should update job on a completed seeding task', async () => {
                const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockUpdateJob } = testContext;
                const seedingJob = getSeedingJobMock({ taskCount: 6, completedTasks: 4 });
                const seedTaskMock = getTaskMock(seedingJob.id, { type: jobDefinitionsConfigMock.tasks.seed, status: OperationStatus.COMPLETED });
                const desiredPercentage = calculateJobPercentage(seedingJob.completedTasks, seedingJob.taskCount);

                mockFindTasks.mockResolvedValue([seedTaskMock]);
                mockGetJob.mockResolvedValue(seedingJob);
                // action
                await tasksManager.handleTaskNotification(seedTaskMock.id);
                // expectation
                expect(mockUpdateJob).toHaveBeenCalledTimes(1);
                expect(mockUpdateJob).toHaveBeenCalledWith(seedingJob.id, { percentage: desiredPercentage });
            });

            it('should set job to completed on completion of all tasks', async () => {
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
                });
            });
        });

        describe('Edge Cases and Special Conditions', () => {
            it("should do nothing in case of being called with a 'Completed' task whose job have no init task", async () => {
                // mocks
                const { tasksManager, mockGetJob, mockFindTasks, jobDefinitionsConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
                const ingestionJobMock = getIngestionJobMock();
                const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });

                mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce(null);
                mockGetJob.mockResolvedValueOnce(ingestionJobMock);
                // action
                await tasksManager.handleTaskNotification(mergeTaskMock.id);
                // expectation
                expect(mockFindTasks).toHaveBeenCalledTimes(2);
                expect(mockGetJob).toHaveBeenCalledTimes(1);
                expect(mockCreateTaskForJob).not.toHaveBeenCalled();
                expect(mockUpdateJob).toHaveBeenCalledTimes(1); // update job progress on notify - but nothing will really update since same task count.
            });

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

            it('should update job percentage when export finalize ErrorCallback completed', async () => {
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

                expect(mockUpdateJob).toHaveBeenCalledWith(job.id, { percentage: calculateJobPercentage(job.completedTasks, job.taskCount) });
            });

            it('should not update job to completed on a completed error callback export finalize task', async () => {
                // mocks
                const { tasksManager, mockFindTasks, mockUpdateJob, jobDefinitionsConfigMock, mockGetJob } = testContext;
                const exportJobMock = getExportJobMock();
                exportJobMock.failedTasks = 1;
                exportJobMock.taskCount++;
                exportJobMock.status = OperationStatus.FAILED;
                const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = {
                    callbacksSent: false,
                    type: ExportFinalizeType.Error_Callback,
                };
                const exportTaskMock = getTaskMock(exportJobMock.id, {
                    type: jobDefinitionsConfigMock.tasks.finalize,
                    status: OperationStatus.COMPLETED,
                    reason: 'some error message',
                    parameters: mockExportErrorFinalizeTaskParams,
                });
                const expectedPercentage = calculateJobPercentage(exportJobMock.completedTasks, exportJobMock.taskCount);

                mockFindTasks.mockResolvedValue([exportTaskMock]);
                mockGetJob.mockResolvedValue(exportJobMock);
                // action
                await tasksManager.handleTaskNotification(exportTaskMock.id);
                // expectation
                expect(mockUpdateJob).toHaveBeenCalledWith(exportJobMock.id, { percentage: expectedPercentage });
                expect(expectedPercentage).toBeLessThan(100);
                // Explicitly verify the job is NOT updated to completed status
                expect(mockUpdateJob).not.toHaveBeenCalledWith(exportJobMock.id, {
                    status: OperationStatus.COMPLETED,
                    percentage: 100,
                });
            });
        });

        describe('Failed Tasks - Workflow Integration', () => {
            it('should create export finalize error callback task type on failed export task', async () => {
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
        });
    });
});
