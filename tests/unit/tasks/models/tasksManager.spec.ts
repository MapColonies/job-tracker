import { NotFoundError } from '@map-colonies/error-types';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { registerDefaultConfig, clear as clearConfig } from '../../../mocks/configMock';
import { getIngestionJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { IrrelevantOperationStatusError } from '../../../../src/common/errors';
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
    it('should create polygon-parts task and update job percentage in case of being called with a "Completed" tiles-merging task with Completed init task', async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, taskTypesConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.init, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]).mockResolvedValueOnce(null);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledWith({ id: mergeTaskMock.id });
      expect(mockGetJob).toHaveBeenCalledWith(ingestionJobMock.id);
      expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(ingestionJobMock.id, { parameters: {}, type: taskTypesConfigMock.polygonParts });
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
    });

    it('should create finalize task and update job percentage in case of being called with a "Completed" polygon-parts task with Completed init task', async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, taskTypesConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.polygonParts, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.init, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]).mockResolvedValueOnce(null);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledWith({ id: mergeTaskMock.id });
      expect(mockGetJob).toHaveBeenCalledWith(ingestionJobMock.id);
      expect(mockCreateTaskForJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).toHaveBeenCalledWith(ingestionJobMock.id, {
        parameters: { insertedToCatalog: false, insertedToGeoServer: false, insertedToMapproxy: false },
        type: taskTypesConfigMock.finalize,
      });
      expect(mockUpdateJob).toHaveBeenCalledTimes(1);
    });

    it("should do nothing in case of being called with a 'Completed' task who'se job have no init task", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, taskTypesConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce(null);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledTimes(2);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).not.toHaveBeenCalled();
      expect(mockUpdateJob).not.toHaveBeenCalled();
    });

    it("should do nothing in case of being called with a 'Completed' task who'se job's init task is not 'Completed'", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, taskTypesConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.init, status: OperationStatus.IN_PROGRESS });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledTimes(2);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).not.toHaveBeenCalled();
      expect(mockUpdateJob).not.toHaveBeenCalled();
    });

    it("should do nothing in case of being called with a 'Completed' task but subsequent task already exists'", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, taskTypesConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.init, status: OperationStatus.COMPLETED });
      const polygonPartsTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.polygonParts });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]).mockResolvedValueOnce([initTaskMock]).mockResolvedValueOnce([polygonPartsTaskMock]);
      mockGetJob.mockResolvedValueOnce(ingestionJobMock);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockFindTasks).toHaveBeenCalledTimes(3);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskForJob).not.toHaveBeenCalled();
      expect(mockUpdateJob).not.toHaveBeenCalled();
    });

    it("should only update percentage in case of being called with a 'Completed' task but job isn't completed", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, taskTypesConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock({ taskCount: 5, completedTasks: 4 });
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.init, status: OperationStatus.COMPLETED });

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

    it("should only update percentage in case of being called with a 'Completed' task that's neither tiles-merging nor polygon-parts", async () => {
      // mocks
      const { tasksManager, mockGetJob, mockFindTasks, taskTypesConfigMock, mockCreateTaskForJob, mockUpdateJob } = testContext;
      const ingestionJobMock = getIngestionJobMock({ taskCount: 5, completedTasks: 4 });
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.finalize, status: OperationStatus.COMPLETED });
      const initTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.init, status: OperationStatus.COMPLETED });

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

    it('Should throw NotFoundError if the task given does not exist', async () => {
      // mocks
      const { tasksManager, mockFindTasks, taskTypesConfigMock } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.COMPLETED });

      mockFindTasks.mockResolvedValueOnce(null);
      // action/expectations
      await expect(tasksManager.handleTaskNotification(mergeTaskMock.id)).rejects.toThrow(NotFoundError);
    });

    it("Should fail the job if the given task's status is 'Failed'", async () => {
      // mocks
      const { tasksManager, mockFindTasks, mockUpdateJob, taskTypesConfigMock } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.FAILED });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
      // action
      await tasksManager.handleTaskNotification(mergeTaskMock.id);
      // expectation
      expect(mockUpdateJob).toHaveBeenCalledWith(ingestionJobMock.id, { status: OperationStatus.FAILED });
    });

    it("Should throw IrrelevantOperationStatusError if the given task's status is neither 'Completed' nor 'Failed'", async () => {
      // mocks
      const { tasksManager, mockFindTasks, taskTypesConfigMock } = testContext;
      const ingestionJobMock = getIngestionJobMock();
      const mergeTaskMock = getTaskMock(ingestionJobMock.id, { type: taskTypesConfigMock.tilesMerging, status: OperationStatus.PENDING });

      mockFindTasks.mockResolvedValueOnce([mergeTaskMock]);
      // action/expectations
      await expect(tasksManager.handleTaskNotification(mergeTaskMock.id)).rejects.toThrow(IrrelevantOperationStatusError);
    });
  });
});
