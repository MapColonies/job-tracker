import nock from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { trace } from '@opentelemetry/api';
import jsLogger from '@map-colonies/js-logger';
import _ from 'lodash';
import { configMock, registerDefaultConfig } from '../../../mocks/configMock';
import { getApp } from '../../../../src/app';
import { createTestJob, getTaskMock } from '../../../mocks/jobMocks';
import { calculateJobPercentage } from '../../../../src/utils/jobUtils';
import { SERVICES } from '../../../../src/common/constants';
import { registerExternalValues } from '../../../../src/containerConfig';
import { TasksRequestSender } from '../helpers/requestSender';
import { getTestContainerConfig, resetContainer } from '../helpers/containerConfig';
import { IJobDefinitionsConfig, IJobManagerConfig } from '../../../../src/common/interfaces';
import { IngestionValidationTaskParameters } from '../../../../src/tasks/handlers/ingestion/ingestionHandler';

describe('tasksManager', function () {
  let requestSender: TasksRequestSender;
  let jobManagerConfigMock: IJobManagerConfig;

  registerDefaultConfig();
  const jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');

  const parameterTestCases = [
    {
      mockJob: createTestJob(jobDefinitionsConfig.jobs.new),
      expectedFinalizeParameters: { insertedToCatalog: false, insertedToGeoServer: false, insertedToMapproxy: false },
    },
    {
      mockJob: createTestJob(jobDefinitionsConfig.jobs.update),
      expectedFinalizeParameters: { updatedInCatalog: false },
    },
    {
      mockJob: createTestJob(jobDefinitionsConfig.jobs.swapUpdate),
      expectedFinalizeParameters: { updatedInCatalog: false, updatedInMapproxy: false },
    },
  ];

  beforeEach(function () {
    const [app] = getApp({
      override: [...getTestContainerConfig()],
      useChild: true,
    });

    registerExternalValues({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.CONFIG, provider: { useValue: configMock } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
    });

    requestSender = new TasksRequestSender(app);
    jobManagerConfigMock = configMock.get<IJobManagerConfig>('jobManagement.config');
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
    it.each(parameterTestCases)(
      'should return 200 and create "merge-tasks-creation" as next task type when "validation" task completed and is valid',
      async (parameterTestCase) => {
        let { mockJob } = parameterTestCase;
        mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
        const mockValidationTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.COMPLETED,
          parameters: { isValid: true },
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post(`/tasks/find`, { id: mockValidationTask.id })
          .reply(httpStatusCodes.OK, [mockValidationTask]);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post(`/jobs/${mockJob.id}/tasks`, { type: jobDefinitionsConfig.tasks.mergeTaskCreation, parameters: {}, blockDuplication: true })
          .reply(httpStatusCodes.OK);
        nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockJob.id}`).reply(httpStatusCodes.OK);

        // action
        const response = await requestSender.handleTaskNotification(mockValidationTask.id);
        // expectation
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(parameterTestCases)(
      'should create finalize task with relevant parameters on merge task notify - $mockJob.type',
      async ({ mockJob, expectedFinalizeParameters }) => {
        // Arrange
        mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
        const mockMergeTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.merge,
          status: OperationStatus.COMPLETED,
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post(`/jobs/${mockJob.id}/tasks`, {
            type: jobDefinitionsConfig.tasks.finalize,
            parameters: expectedFinalizeParameters,
            blockDuplication: true,
          })
          .reply(httpStatusCodes.OK);

        nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockJob.id}`).reply(httpStatusCodes.OK);

        // Act
        const response = await requestSender.handleTaskNotification(mockMergeTask.id);

        // Assert
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(parameterTestCases)(
      'should create finalize task with relevant parameters for job handler on merge-tasks-creation notify - $mockJob.type',
      async ({ mockJob, expectedFinalizeParameters }) => {
        // Arrange
        mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
        const mockMergeTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.mergeTaskCreation,
          status: OperationStatus.COMPLETED,
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post(`/jobs/${mockJob.id}/tasks`, {
            type: jobDefinitionsConfig.tasks.finalize,
            parameters: expectedFinalizeParameters,
            blockDuplication: true,
          })
          .reply(httpStatusCodes.OK);

        nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockJob.id}`).reply(httpStatusCodes.OK);

        // Act
        const response = await requestSender.handleTaskNotification(mockMergeTask.id);

        // Assert
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(parameterTestCases)('should complete job when entire task are completed on finalize task notify - $mockJob.type', async ({ mockJob }) => {
      // Arrange
      mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
      const mockMergeTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockJob.id}`, { status: OperationStatus.COMPLETED, percentage: 100 })
        .reply(httpStatusCodes.OK);

      // Act
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);

      // Assert
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)(
      'should update progress and not create next task type if not all of the merge task are completed on merge tasks creation notify - $mockJob.type',
      async ({ mockJob }) => {
        // Arrange
        mockJob = { ...mockJob, completedTasks: 5, taskCount: 10 };
        const mockMergeTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.mergeTaskCreation,
          status: OperationStatus.COMPLETED,
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);

        const expectedPercentage = calculateJobPercentage(mockJob.completedTasks, mockJob.taskCount);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .put(`/jobs/${mockJob.id}`, ({ percentage }) => {
            expect(percentage).toBe(expectedPercentage);
            return true;
          })
          .reply(httpStatusCodes.OK);

        // Act
        const response = await requestSender.handleTaskNotification(mockMergeTask.id);

        // Assert
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(parameterTestCases)(
      'should update progress and not create next task type if not all of the merge task are completed on merge task notify - $mockJob.type',
      async ({ mockJob }) => {
        // Arrange
        mockJob = { ...mockJob, completedTasks: 5, taskCount: 10 };
        const mockMergeTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.merge,
          status: OperationStatus.COMPLETED,
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);

        const expectedPercentage = calculateJobPercentage(mockJob.completedTasks, mockJob.taskCount);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .put(`/jobs/${mockJob.id}`, ({ percentage }) => {
            expect(percentage).toBe(expectedPercentage);
            return true;
          })
          .reply(httpStatusCodes.OK);

        // Act
        const response = await requestSender.handleTaskNotification(mockMergeTask.id);

        // Assert
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(parameterTestCases)('should suspend job on completed but invalid validation task notify - $mockJob.type', async ({ mockJob }) => {
      // Arrange
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      const mockValidationTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.COMPLETED,
        parameters: { isValid: false },
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockValidationTask.id }).reply(httpStatusCodes.OK, [mockValidationTask]);

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockJob.id}`, { status: OperationStatus.SUSPENDED, reason: '' })
        .reply(httpStatusCodes.OK);

      // Act
      const response = await requestSender.handleTaskNotification(mockValidationTask.id);

      // Assert
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)('should suspend job on failed validation task notify - $mockJob.type', async ({ mockJob }) => {
      // Arrange
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      const mockFailedValidationTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.validation,
        status: OperationStatus.FAILED,
        reason: 'Validation task failed',
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { id: mockFailedValidationTask.id })
        .reply(httpStatusCodes.OK, [mockFailedValidationTask]);

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockJob.id}`, { status: OperationStatus.SUSPENDED, reason: mockFailedValidationTask.reason })
        .reply(httpStatusCodes.OK);

      // Act
      const response = await requestSender.handleTaskNotification(mockFailedValidationTask.id);

      // Assert
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)(
      'should suspend job on failed validation task notify regardless isValid param set to true  - $mockJob.type',
      async ({ mockJob }) => {
        // Arrange
        mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
        const mockFailedValidationTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.FAILED,
          reason: 'Validation task failed',
          parameters: { isValid: true },
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post('/tasks/find', { id: mockFailedValidationTask.id })
          .reply(httpStatusCodes.OK, [mockFailedValidationTask]);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .put(`/jobs/${mockJob.id}`, { status: OperationStatus.SUSPENDED, reason: mockFailedValidationTask.reason })
          .reply(httpStatusCodes.OK);

        // Act
        const response = await requestSender.handleTaskNotification(mockFailedValidationTask.id);

        // Assert
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(parameterTestCases)(
      'should suspend job on failed validation task notify regardless  isValid param set to false  - $mockJob.type',
      async ({ mockJob }) => {
        // Arrange
        mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
        const mockFailedValidationTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.FAILED,
          reason: 'Validation task failed',
          parameters: { isValid: false },
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post('/tasks/find', { id: mockFailedValidationTask.id })
          .reply(httpStatusCodes.OK, [mockFailedValidationTask]);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .put(`/jobs/${mockJob.id}`, { status: OperationStatus.SUSPENDED, reason: mockFailedValidationTask.reason })
          .reply(httpStatusCodes.OK);

        // Act
        const response = await requestSender.handleTaskNotification(mockFailedValidationTask.id);

        // Assert
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it.each(parameterTestCases)('should fail job on failed merge-tasks-creation task notify - $mockJob.type', async ({ mockJob }) => {
      // Arrange
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      const mockFailedMergeTaskCreationTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.mergeTaskCreation,
        status: OperationStatus.FAILED,
        reason: 'Failed to create merge tasks',
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { id: mockFailedMergeTaskCreationTask.id })
        .reply(httpStatusCodes.OK, [mockFailedMergeTaskCreationTask]);

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockJob.id}`, { status: OperationStatus.FAILED, reason: mockFailedMergeTaskCreationTask.reason })
        .reply(httpStatusCodes.OK);

      // Act
      const response = await requestSender.handleTaskNotification(mockFailedMergeTaskCreationTask.id);

      // Assert
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)('should fail job on failed merge task notify - $mockJob.type', async ({ mockJob }) => {
      // Arrange
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      const mockFailedMergeTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.merge,
        status: OperationStatus.FAILED,
        reason: 'Failed to create merge tasks',
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { id: mockFailedMergeTask.id })
        .reply(httpStatusCodes.OK, [mockFailedMergeTask]);

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockJob.id}`, { status: OperationStatus.FAILED, reason: mockFailedMergeTask.reason })
        .reply(httpStatusCodes.OK);

      // Act
      const response = await requestSender.handleTaskNotification(mockFailedMergeTask.id);

      // Assert
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)('should fail job on failed finalize task notify - $mockJob.type', async ({ mockJob }) => {
      // Arrange
      mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
      const mockFailedFinalizeTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.FAILED,
        reason: 'Failed to create merge tasks',
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { id: mockFailedFinalizeTask.id })
        .reply(httpStatusCodes.OK, [mockFailedFinalizeTask]);

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockJob.id}`, { status: OperationStatus.FAILED, reason: mockFailedFinalizeTask.reason })
        .reply(httpStatusCodes.OK);

      // Act
      const response = await requestSender.handleTaskNotification(mockFailedFinalizeTask.id);

      // Assert
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)(
      'should suspend job on task notify if task type exists in suspendingTaskTypes - $mockJob.type',
      async ({ mockJob }) => {
        // Arrange
        for (const taskType of jobDefinitionsConfig.suspendingTaskTypes) {
          mockJob = { ...mockJob, completedTasks: 0, taskCount: 1 };
          const mockSuspendingTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
            type: taskType,
            status: OperationStatus.FAILED,
            reason: 'Task suspend reason',
          });

          nock(jobManagerConfigMock.jobManagerBaseUrl)
            .post('/tasks/find', { id: mockSuspendingTask.id })
            .reply(httpStatusCodes.OK, [mockSuspendingTask]);

          nock(jobManagerConfigMock.jobManagerBaseUrl)
            .get(`/jobs/${mockJob.id}`)
            .query({ shouldReturnTasks: false })
            .reply(httpStatusCodes.OK, mockJob);

          nock(jobManagerConfigMock.jobManagerBaseUrl)
            .put(`/jobs/${mockJob.id}`, { status: OperationStatus.SUSPENDED, reason: mockSuspendingTask.reason })
            .reply(httpStatusCodes.OK);

          // Act
          const response = await requestSender.handleTaskNotification(mockSuspendingTask.id);

          // Assert
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(response).toSatisfyApiSpec();
        }
      }
    );
  });

  describe('Bad Path', function () {
    // All requests with status code of 400
    it('should return 400 if the endpoint is called with a path parameter that is not a valid uuid', async () => {
      const response = await requestSender.handleTaskNotification('1');
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)(
      'should return 400 in case of missmatch mapper by job and task type when attempt to create next task',
      async ({ mockJob }) => {
        mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
        // mocks
        const mockValidationTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.init, status: OperationStatus.COMPLETED }); // init task for ingestion job

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post('/tasks/find', { id: mockValidationTask.id })
          .reply(httpStatusCodes.OK, [mockValidationTask]);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);

        // action
        const response = await requestSender.handleTaskNotification(mockValidationTask.id);

        // expectation
        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
      }
    );


    it.each(parameterTestCases)(
      'should suspend job in case of completed but invalid validation task parameters schema - $mockJob.type',
      async ({ mockJob }) => {
        // Arrange
        mockJob = { ...mockJob, completedTasks: 1, taskCount: 1 };
        const mockValidationTask = getTaskMock<IngestionValidationTaskParameters>(mockJob.id, {
          type: jobDefinitionsConfig.tasks.validation,
          status: OperationStatus.COMPLETED,
        }); // does not includes the 'isValid' parameter

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post('/tasks/find', { id: mockValidationTask.id })
          .reply(httpStatusCodes.OK, [mockValidationTask]);

        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${mockJob.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, mockJob);
        // Act
        const response = await requestSender.handleTaskNotification(mockValidationTask.id);

        // Assert
        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
      }
    );
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it.each(parameterTestCases)('should return 404 if the task given does not exists', async ({ mockJob }) => {
      // mocks
      const mockMergeTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/tasks/find`, { id: mockMergeTask.id })
        .reply(httpStatusCodes.NOT_FOUND, 'message: Tasks not found');
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)('should return 404 if the task given exists but job cannot be found', async ({ mockJob }) => {
      // mocks
      const mockMergeTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/tasks/find`, { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);

      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.NOT_FOUND);

      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)('should return 404 in case of the notified tasks cannot be found', async ({ mockJob }) => {
      // mocks
      const mockMergeTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/tasks/find`, { id: mockMergeTask.id }).reply(httpStatusCodes.NOT_FOUND, []);

      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)('should return 428 if the task given is neither in "Completed" nor "Failed" status', async ({ mockJob }) => {
      // mocks
      const mockMergeTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.PENDING });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.PRECONDITION_REQUIRED);
      expect(response).toSatisfyApiSpec();
    });

    it.each(parameterTestCases)('should return 200 and handle ConflictError gracefully when task already exists', async ({ mockJob }) => {
      mockJob = { ...mockJob, completedTasks: 10, taskCount: 10 };
      // mocks
      const mockMergeTask = getTaskMock(mockJob.id, { type: jobDefinitionsConfig.tasks.merge, status: OperationStatus.COMPLETED });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).get(`/jobs/${mockJob.id}`).query({ shouldReturnTasks: false }).reply(httpStatusCodes.OK, mockJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockJob.id}/tasks`, _.matches({ type: jobDefinitionsConfig.tasks.finalize }))
        .reply(httpStatusCodes.CONFLICT, { message: 'Task already exists' });
      // No job update should happen when there's a conflict

      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });
  });
});
