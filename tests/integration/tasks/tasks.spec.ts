import nock from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import _ from 'lodash';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ExportFinalizeErrorCallbackParams, ExportFinalizeFullProcessingParams } from '@map-colonies/raster-shared';
import { ExportFinalizeType } from '@map-colonies/raster-shared';
import { configMock, setPolygonPartsEnabled, setValue } from '../../mocks/configMock';
import { getApp } from '../../../src/app';
import { IJobManagerConfig, IJobDefinitionsConfig } from '../../../src/common/interfaces';
import { getExportJobMock, getIngestionJobMock, getTaskMock } from '../../mocks/JobMocks';
import { calculateTaskPercentage } from '../../../src/utils/taskUtils';
import { TasksRequestSender } from './helpers/requestSender';
import { getTestContainerConfig, resetContainer } from './helpers/containerConfig';
import { fa } from '@faker-js/faker';

describe('tasks', function () {
  let requestSender: TasksRequestSender;
  let jobManagerConfigMock: IJobManagerConfig;
  let jobDefinitionsConfigMock: IJobDefinitionsConfig;

  beforeEach(function () {
    const [app] = getApp({
      override: [...getTestContainerConfig()],
      useChild: true,
    });

    requestSender = new TasksRequestSender(app);
    jobManagerConfigMock = configMock.get<IJobManagerConfig>('jobManagement.config');
    jobDefinitionsConfigMock = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
    nock.cleanAll();
  });

  afterEach(function () {
    resetContainer();
    jest.restoreAllMocks();
    if (!nock.isDone()) {
      throw new Error(`Not all nock interceptors were used: ${JSON.stringify(nock.pendingMocks())}`);
    }
  });

  describe('Happy Path', function () {
    // it('Should return 200 and create polygon parts task when getting tiles merging completed task', async () => {
    //   // mocks
    //   const mockIngestionJob = getIngestionJobMock();
    //   const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
    //   const mockInitTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });
    //   nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
    //   nock(jobManagerConfigMock.jobManagerBaseUrl)
    //     .get(`/jobs/${mockIngestionJob.id}`)
    //     .query({ shouldReturnTasks: false })
    //     .reply(200, mockIngestionJob);
    //   nock(jobManagerConfigMock.jobManagerBaseUrl)
    //     .post('/tasks/find', { jobId: mockIngestionJob.id, type: jobDefinitionsConfigMock.tasks.init })
    //     .reply(200, [mockInitTask]);
    //   nock(jobManagerConfigMock.jobManagerBaseUrl)
    //     .post(`/jobs/${mockIngestionJob.id}/tasks`, _.matches({ type: jobDefinitionsConfigMock.tasks.polygonParts }))
    //     .reply(201);
    //   nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockIngestionJob.id}`).reply(200);
    //   // action
    //   const response = await requestSender.handleTaskNotification(mockMergeTask.id);
    //   // expectation
    //   expect(response.status).toBe(200);
    //   expect(response).toSatisfyApiSpec();
    // });

    // it('Should return 200 and create polygon-parts task when getting completed init task that finished after merge tasks', async () => {
    //   // mocks
    //   const mockIngestionJob = getIngestionJobMock();
    //   const mockInitTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });
    //   nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockInitTask.id }).reply(200, [mockInitTask]);

    //   nock(jobManagerConfigMock.jobManagerBaseUrl)
    //     .get(`/jobs/${mockIngestionJob.id}`)
    //     .query({ shouldReturnTasks: false })
    //     .reply(200, mockIngestionJob);

    //   nock(jobManagerConfigMock.jobManagerBaseUrl)
    //     .post('/tasks/find', { jobId: mockIngestionJob.id, type: jobDefinitionsConfigMock.tasks.init })
    //     .reply(200, [mockInitTask]);

    //   nock(jobManagerConfigMock.jobManagerBaseUrl)
    //     .post(`/jobs/${mockIngestionJob.id}/tasks`, _.matches({ type: jobDefinitionsConfigMock.tasks.polygonParts }))
    //     .reply(201);

    //   nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockIngestionJob.id}`).reply(200);

    //   // action
    //   const response = await requestSender.handleTaskNotification(mockInitTask.id);

    //   // expectation
    //   expect(response.status).toBe(200);
    //   expect(response).toSatisfyApiSpec();
    // });

    it('Should return 200 and create finalize task when getting polygon parts completed task', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts.taskType,
        status: OperationStatus.COMPLETED,
      });
      const mockInitTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockIngestionJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockIngestionJob.id}/tasks`, _.matches({ type: jobDefinitionsConfigMock.tasks.finalize }))
        .reply(201);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockIngestionJob.id}`).reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and fail job when getting failed task whose type is not in suspendingTaskTypes list', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.FAILED });
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockIngestionJob.id}`, _.matches({ status: OperationStatus.FAILED }))
        .reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and create finalize task when getting completed init task of export job when task count and completed task are even', async () => {
      jobDefinitionsConfigMock.tasks.polygonParts.enabled = false;
      // mocks
      const mockExportJob = getExportJobMock();
      const mockInitTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.init,
        status: OperationStatus.COMPLETED,
      });
      const fullProcessingFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: false,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      };
      const mockFullProcessFinalizeTaskParams = {
        parameters: fullProcessingFinalizeTaskParams,
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: false,
      };
      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockInitTask.id }).reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/tasks/find`, { jobId: mockExportJob.id, type: mockInitTask.type })
        .reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/jobs/${mockExportJob.id}/tasks`, mockFullProcessFinalizeTaskParams).reply(201);
      const taskPercentage = calculateTaskPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockInitTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 when getting completed init task of export job when task count and completed task are not even', async () => {
      // mocks
      const mockExportJob = getExportJobMock({ completedTasks: 4 });
      const mockInitTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.init,
        status: OperationStatus.COMPLETED,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockInitTask.id }).reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/tasks/find`, { jobId: mockExportJob.id, type: mockInitTask.type })
        .reply(200, [mockInitTask]);
      const taskPercentage = calculateTaskPercentage(mockExportJob.completedTasks, mockExportJob.taskCount);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockInitTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and create finalize task when getting failed task of export job', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockExportTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.export,
        status: OperationStatus.FAILED,
        reason: 'reason',
      });

      const mockExportErrorFinalizeTaskParams = {
        parameters: { callbacksSent: false, type: ExportFinalizeType.Error_Callback },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: false,
      };
      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`).reply(200);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockExportTask.id }).reply(200, [mockExportTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/jobs/${mockExportJob.id}/tasks`, mockExportErrorFinalizeTaskParams).reply(201);
      // action
      const response = await requestSender.handleTaskNotification(mockExportTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and complete job when getting completed export finalize task', async () => {
      const mockExportJob = getExportJobMock();
      const fullProccessingFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: true,
        gpkgUploadedToS3: true,
        callbacksSent: true,
      };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: fullProccessingFinalizeTaskParams,
      });
      const mockInitTask = getTaskMock(mockExportJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(200, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockExportJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, _.matches({ status: OperationStatus.COMPLETED }))
        .reply(200);

      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and fail export job when error callback export finalize task type is failing', async () => {
      const mockExportJob = getExportJobMock();

      const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.FAILED,
        reason: 'error reason',
        parameters: mockExportErrorFinalizeTaskParams,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(200, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, { status: OperationStatus.FAILED, reason: mockFinalizeTask.reason })
        .reply(200);

      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and create finalize task on a successful export merge', async () => {
      jobDefinitionsConfigMock.tasks.polygonParts.enabled = false;
      // mocks
      const mockExportJob = getExportJobMock();
      const mockExportTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.export,
        status: OperationStatus.COMPLETED,
      });
      const fullProccessingFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: false,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      };
      const mockTaskParameters = {
        parameters: fullProccessingFinalizeTaskParams,
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: false,
      };
      const mockInitTask = getTaskMock(mockExportJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockExportJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockExportTask.id }).reply(200, [mockExportTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/jobs/${mockExportJob.id}/tasks`, mockTaskParameters).reply(201);
      const taskPercentage = calculateTaskPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockExportTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and suspend job when getting failed task whose type is in suspendingTaskTypes list', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.polygonParts.taskType, status: OperationStatus.FAILED });
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockIngestionJob.id}`, _.matches({ status: OperationStatus.SUSPENDED }))
        .reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 when getting completed task whose job have no init task', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockIngestionJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(404);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it("Should return 200 when getting completed task who'se job's init task status is in progress", async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
      const mockInitTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.IN_PROGRESS });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockIngestionJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(200, mockInitTask);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400
    it('Should return 400 if the endpoint is called with a path parameter that is not a valid uuid', async () => {
      const response = await requestSender.handleTaskNotification('1');
      expect(response.status).toBe(400);
      expect(response).toSatisfyApiSpec();
    });
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it('Should return 404 if the task given does not exists', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/tasks/find`, { id: mockMergeTask.id }).reply(404, 'message: Tasks not found');
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(404);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 428 if the task given is neither in "Completed" nor "Failed" status', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.PENDING });
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(428);
      expect(response).toSatisfyApiSpec();
    });
  });
});
