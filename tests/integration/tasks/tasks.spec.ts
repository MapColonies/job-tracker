import nock from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import _ from 'lodash';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import jestOpenAPI from 'jest-openapi';
import { configMock } from '../../mocks/configMock';
import { getApp } from '../../../src/app';
import { IJobManagerConfig, IJobDefinitionsConfig } from '../../../src/common/interfaces';
import { getExportJobMock, getIngestionJobMock, getTaskMock } from '../../mocks/JobMocks';
import { TasksRequestSender } from './helpers/requestSender';
import { getTestContainerConfig, resetContainer } from './helpers/containerConfig';

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
    it('Should return 200 and create polygon parts task when getting tiles merging completed task', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.merge, status: OperationStatus.COMPLETED });
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
        .post(`/jobs/${mockIngestionJob.id}/tasks`, _.matches({ type: jobDefinitionsConfigMock.tasks.polygonParts }))
        .reply(201);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockIngestionJob.id}`).reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and create finalize task when getting polygon parts completed task', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
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

    it('Should return 200 and create finalize task when getting failed task of export job', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockMergeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.merge,
        status: OperationStatus.FAILED,
        reason: 'reason',
      });
      const mockTaskParameters = {
        parameters: { callbacksSent: false, status: OperationStatus.FAILED },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: false,
      };
      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/jobs/${mockExportJob.id}/tasks`, mockTaskParameters).reply(201);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and complete job when getting completed finalize task', async () => {
      const mockExportJob = getExportJobMock();
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: { status: OperationStatus.COMPLETED, gpkgModified: true, gpkgUploadedToS3: true, callbacksSent: true },
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

    it('Should return 200 and fail export job when finalize task is completed and represents a failure', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: { callbacksSent: false, status: OperationStatus.FAILED },
        reason: 'error reason',
      });
      const mockInitTask = getTaskMock(mockExportJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(200, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, { status: OperationStatus.FAILED, reason: mockFinalizeTask.reason })
        .reply(200);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockExportJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(200, [mockInitTask]);
      // action
      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and create finalize task on a successful export merge', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockPolygonPartsTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.polygonParts,
        status: OperationStatus.COMPLETED,
      });
      const mockTaskParameters = {
        parameters: { status: OperationStatus.COMPLETED, callbacksSent: false, gpkgModified: false, gpkgUploadedToS3: false },
        type: jobDefinitionsConfigMock.tasks.finalize,
        blockDuplication: false,
      };
      const mockInitTask = getTaskMock(mockExportJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockExportJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockPolygonPartsTask.id }).reply(200, [mockPolygonPartsTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/jobs/${mockExportJob.id}/tasks`, mockTaskParameters).reply(201);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: 83 }).reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockPolygonPartsTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and suspend job when getting failed task whose type is in suspendingTaskTypes list', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfigMock.tasks.polygonParts, status: OperationStatus.FAILED });
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
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(428);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 500 if failed finalize task doesnt have an errorMessage', async () => {
      const mockExportJob = getExportJobMock();
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfigMock.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: { callbacksSent: false, status: OperationStatus.FAILED },
      });
      const mockInitTask = getTaskMock(mockExportJob.id, { type: jobDefinitionsConfigMock.tasks.init, status: OperationStatus.COMPLETED });

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockExportJob.id}`).query({ shouldReturnTasks: false }).reply(200, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(200, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockExportJob.id, type: jobDefinitionsConfigMock.tasks.init })
        .reply(200, [mockInitTask]);
      // action
      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);
      // expectation
      expect(response.status).toBe(500);
      expect(response).toSatisfyApiSpec();
    });
  });
});
