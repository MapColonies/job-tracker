import nock from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import _ from 'lodash';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import jestOpenAPI from 'jest-openapi';
import { configMock } from '../../mocks/configMock';
import { getApp } from '../../../src/app';
import { IJobManagerConfig, ITaskTypesConfig } from '../../../src/common/interfaces';
import { getIngestionJobMock, getTaskMock } from '../../mocks/JobMocks';
import { TasksRequestSender } from './helpers/requestSender';
import { getTestContainerConfig, resetContainer } from './helpers/containerConfig';

describe('tasks', function () {
  let requestSender: TasksRequestSender;
  let jobManagerConfigMock: IJobManagerConfig;
  let taskTypesConfigMock: ITaskTypesConfig;

  beforeEach(function () {
    const [app] = getApp({
      override: [...getTestContainerConfig()],
      useChild: true,
    });

    requestSender = new TasksRequestSender(app);
    jobManagerConfigMock = configMock.get<IJobManagerConfig>('jobManagement.config');
    taskTypesConfigMock = configMock.get<ITaskTypesConfig>('taskTypes');
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
      const mockMergeTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.tilesMerging, OperationStatus.COMPLETED);
      const mockInitTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.init, OperationStatus.COMPLETED);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockIngestionJob.id, type: taskTypesConfigMock.init })
        .reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockIngestionJob.id, type: taskTypesConfigMock.polygonParts })
        .reply(404);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockIngestionJob.id}/tasks`, _.matches({ type: taskTypesConfigMock.polygonParts }))
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
      const mockMergeTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.polygonParts, OperationStatus.COMPLETED);
      const mockInitTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.init, OperationStatus.COMPLETED);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { jobId: mockIngestionJob.id, type: taskTypesConfigMock.init })
        .reply(200, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { jobId: mockIngestionJob.id, type: taskTypesConfigMock.finalize }).reply(404);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockIngestionJob.id}/tasks`, _.matches({ type: taskTypesConfigMock.finalize }))
        .reply(201);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockIngestionJob.id}`).reply(200);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });

    it('Should return 200 and fail job when getting failed task', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.polygonParts, OperationStatus.FAILED);
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

    it("Should return 200 when getting completed task who'se job have no init task", async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.tilesMerging, OperationStatus.COMPLETED);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockIngestionJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(200, mockIngestionJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { jobId: mockIngestionJob.id, type: taskTypesConfigMock.init }).reply(404);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(200);
      expect(response).toSatisfyApiSpec();
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400
  });
  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it('Should return 404 if the task given does not exists', async () => {
      // mocks
      const mockIngestionJob = getIngestionJobMock();
      const mockMergeTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.tilesMerging, OperationStatus.COMPLETED);
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
      const mockMergeTask = getTaskMock(mockIngestionJob.id, taskTypesConfigMock.tilesMerging, OperationStatus.PENDING);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(200, [mockMergeTask]);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(428);
      expect(response).toSatisfyApiSpec();
    });
  });
});
