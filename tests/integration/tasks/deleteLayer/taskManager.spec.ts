import nock, { cleanAll, isDone, pendingMocks } from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { trace } from '@opentelemetry/api';
import { jsLogger } from '@map-colonies/js-logger';
import { initConfig } from '../../../../src/common/config';
import { configMock } from '../../../mocks/configMock';
import { getApp } from '../../../../src/app';
import type { IJobManagerConfig, IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { getDeleteLayerJobMock, getTaskMock } from '../../../mocks/jobMocks';
import { calculateJobPercentage } from '../../../../src/utils/jobUtils';
import { SERVICES } from '../../../../src/common/constants';
import { registerExternalValues } from '../../../../src/containerConfig';
import { TasksRequestSender } from '../helpers/requestSender';
import { getTestContainerConfig, resetContainer } from '../helpers/containerConfig';

describe('tasks', function () {
  let requestSender: TasksRequestSender;
  let jobManagerConfigMock: IJobManagerConfig;
  let jobDefinitionsConfig: IJobDefinitionsConfig;

  beforeAll(async function () {
    await initConfig(true);
  });

  beforeEach(async function () {
    const [app] = await getApp({
      override: [...(await getTestContainerConfig())],
      useChild: true,
    });

    await registerExternalValues({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
        { token: SERVICES.CONFIG, provider: { useValue: configMock } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
    });

    requestSender = new TasksRequestSender(app);
    jobManagerConfigMock = configMock.get('jobManagement.config') as unknown as IJobManagerConfig;
    jobDefinitionsConfig = configMock.get('jobDefinitions') as IJobDefinitionsConfig;
    cleanAll();
  });

  afterEach(function () {
    resetContainer();
    jest.restoreAllMocks();
    if (!isDone()) {
      throw new Error(`Not all nock interceptors were used: ${JSON.stringify(pendingMocks())}`);
    }
  });

  describe('Happy Path', function () {
    it('should return 200 and only update progress when getting completed delete task and no other task is pending', async () => {
      // mocks
      const mockDeleteLayerJob = getDeleteLayerJobMock({ taskCount: 1, completedTasks: 1 });
      const mockDeleteTask = getTaskMock(mockDeleteLayerJob.id, {
        type: jobDefinitionsConfig.tasks.delete,
        status: OperationStatus.COMPLETED,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockDeleteTask.id }).reply(httpStatusCodes.OK, [mockDeleteTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockDeleteLayerJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockDeleteLayerJob);
      const taskPercentage = calculateJobPercentage(mockDeleteLayerJob.completedTasks, mockDeleteLayerJob.taskCount);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockDeleteLayerJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockDeleteTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and complete job when getting completed excluded "tilesDeletion" task and no other task is pending', async () => {
      // mocks
      const mockDeleteLayerJob = getDeleteLayerJobMock({ taskCount: 3, completedTasks: 3 });
      const mockExcludedTask = getTaskMock(mockDeleteLayerJob.id, {
        type: jobDefinitionsConfig.tasks.tilesDeletion,
        status: OperationStatus.COMPLETED,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockExcludedTask.id }).reply(httpStatusCodes.OK, [mockExcludedTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockDeleteLayerJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockDeleteLayerJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockDeleteLayerJob.id}`, { status: OperationStatus.COMPLETED, percentage: 100 })
        .reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockExcludedTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and fail job when getting failed delete task', async () => {
      // mocks
      const mockDeleteLayerJob = getDeleteLayerJobMock();
      const mockDeleteTask = getTaskMock(mockDeleteLayerJob.id, {
        type: jobDefinitionsConfig.tasks.delete,
        status: OperationStatus.FAILED,
        reason: 'delete task failed',
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockDeleteTask.id }).reply(httpStatusCodes.OK, [mockDeleteTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockDeleteLayerJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockDeleteLayerJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockDeleteLayerJob.id}`, { status: OperationStatus.FAILED, reason: mockDeleteTask.reason })
        .reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockDeleteTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and fail job when getting failed tiles-deletion task', async () => {
      // mocks
      const mockDeleteLayerJob = getDeleteLayerJobMock();
      const mockTilesDeletionTask = getTaskMock(mockDeleteLayerJob.id, {
        type: jobDefinitionsConfig.tasks.tilesDeletion,
        status: OperationStatus.FAILED,
        reason: 'tiles-deletion task failed',
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { id: mockTilesDeletionTask.id })
        .reply(httpStatusCodes.OK, [mockTilesDeletionTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockDeleteLayerJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockDeleteLayerJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockDeleteLayerJob.id}`, { status: OperationStatus.FAILED, reason: mockTilesDeletionTask.reason })
        .reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockTilesDeletionTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });
  });
});
