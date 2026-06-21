import nock, { cleanAll, isDone, pendingMocks } from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { trace } from '@opentelemetry/api';
import { jsLogger } from '@map-colonies/js-logger';
import { initConfig } from '../../../../src/common/config';
import { configMock } from '../../../mocks/configMock';
import { getApp } from '../../../../src/app';
import type { IJobManagerConfig, IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { getSeedingJobMock, getTaskMock } from '../../../mocks/jobMocks';
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
    it('should return 200 when getting completed but not last seeding task', async () => {
      // mocks
      const mockSeedingJob = getSeedingJobMock();
      const mockSeedTask = getTaskMock(mockSeedingJob.id, { type: jobDefinitionsConfig.tasks.seed, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockSeedTask.id }).reply(httpStatusCodes.OK, [mockSeedTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockSeedingJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockSeedingJob);
      const taskPercentage = calculateJobPercentage(mockSeedingJob.completedTasks, mockSeedingJob.taskCount);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockSeedingJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockSeedTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 when getting last completed seeding task', async () => {
      // mocks
      const mockSeedingJob = getSeedingJobMock({ completedTasks: 5, taskCount: 5 });
      const mockSeedTask = getTaskMock(mockSeedingJob.id, { type: jobDefinitionsConfig.tasks.seed, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockSeedTask.id }).reply(httpStatusCodes.OK, [mockSeedTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockSeedingJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockSeedingJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockSeedingJob.id}`, { percentage: 100, status: OperationStatus.COMPLETED })
        .reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockSeedTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 when getting failed seeding task', async () => {
      // mocks
      const mockSeedingJob = getSeedingJobMock();
      const mockSeedTask = getTaskMock(mockSeedingJob.id, {
        type: jobDefinitionsConfig.tasks.seed,
        status: OperationStatus.FAILED,
        reason: 'some error reason',
      });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockSeedTask.id }).reply(httpStatusCodes.OK, [mockSeedTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockSeedingJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockSeedingJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockSeedingJob.id}`, { status: OperationStatus.FAILED, reason: 'some error reason' })
        .reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockSeedTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });
  });

  it.each([
    {
      taskType: 'seeding',
      jobType: 'ingestion',
      getJobMock: () => getSeedingJobMock(),
      taskTypeKey: 'seed' as const,
      reason: 'Seeding process failed due to network error',
    },
  ])(
    'should return 200 and apply correct job failure logic when $taskType task fails in $jobType job',
    async ({ getJobMock, taskTypeKey, reason }) => {
      // mocks
      const jobMock = getJobMock();
      const taskMock = getTaskMock(jobMock.id, {
        type: jobDefinitionsConfig.tasks[taskTypeKey],
        status: OperationStatus.FAILED,
        reason,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: taskMock.id }).reply(httpStatusCodes.OK, [taskMock]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${jobMock.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, jobMock);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${jobMock.id}`, {
          status: OperationStatus.FAILED,
          reason,
        })
        .reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(taskMock.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    }
  );
});
