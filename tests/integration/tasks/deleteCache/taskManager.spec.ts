import nock, { cleanAll, isDone, pendingMocks } from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { trace } from '@opentelemetry/api';
import { jsLogger } from '@map-colonies/js-logger';
import { initConfig } from '../../../../src/common/config';
import { configMock } from '../../../mocks/configMock';
import { getApp } from '../../../../src/app';
import type { IJobManagerConfig, IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { getDeleteCacheJobMock, getTaskMock } from '../../../mocks/jobMocks';
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

  const deleteCacheJobTypes = [{ jobTypeKey: 'updateCacheDeletion' as const }, { jobTypeKey: 'swapCacheDeletion' as const }];

  describe('Happy Path', function () {
    it.each(deleteCacheJobTypes)(
      'should return 200 when getting completed but not last tiles-deletion task - $jobTypeKey',
      async ({ jobTypeKey }) => {
        // mocks
        const mockJob = getDeleteCacheJobMock(jobDefinitionsConfig.jobs[jobTypeKey]);
        const mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.tilesDeletion, status: OperationStatus.COMPLETED });
        nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockTask.id }).reply(httpStatusCodes.OK, [mockTask]);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);
        const taskPercentage = calculateJobPercentage(mockJob.completedTasks, mockJob.taskCount);
        nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);
        // action
        const response = await requestSender.handleTaskNotification(mockTask.id);
        // expectation
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(deleteCacheJobTypes)('should return 200 when getting last completed tiles-deletion task - $jobTypeKey', async ({ jobTypeKey }) => {
      // mocks
      const mockJob = getDeleteCacheJobMock(jobDefinitionsConfig.jobs[jobTypeKey], { completedTasks: 5, taskCount: 5 });
      const mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.tilesDeletion, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockTask.id }).reply(httpStatusCodes.OK, [mockTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockJob.id}`, { percentage: 100, status: OperationStatus.COMPLETED })
        .reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each(deleteCacheJobTypes)(
      'should return 200 and fail the job when getting failed tiles-deletion task - $jobTypeKey',
      async ({ jobTypeKey }) => {
        // mocks
        const reason = 'Tiles deletion failed due to storage error';
        const mockJob = getDeleteCacheJobMock(jobDefinitionsConfig.jobs[jobTypeKey]);
        const mockTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.tilesDeletion, status: OperationStatus.FAILED, reason });
        nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockTask.id }).reply(httpStatusCodes.OK, [mockTask]);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);
        nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockJob.id}`, { status: OperationStatus.FAILED, reason }).reply(httpStatusCodes.OK);
        // action
        const response = await requestSender.handleTaskNotification(mockTask.id);
        // expectation
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );
  });
});
