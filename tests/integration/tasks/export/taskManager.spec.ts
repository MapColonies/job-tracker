import nock from 'nock';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { ExportFinalizeErrorCallbackParams, ExportFinalizeFullProcessingParams } from '@map-colonies/raster-shared';
import { ExportFinalizeType } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import jsLogger from '@map-colonies/js-logger';
import _ from 'lodash';
import { configMock, init, registerDefaultConfig, setValue } from '../../../mocks/configMock';
import { getApp } from '../../../../src/app';
import { IJobManagerConfig, IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { createTestJob, getExportJobMock, getTaskMock } from '../../../mocks/jobMocks';
import { calculateJobPercentage } from '../../../../src/utils/jobUtils';
import { SERVICES } from '../../../../src/common/constants';
import { registerExternalValues } from '../../../../src/containerConfig';
import { TasksRequestSender } from '../helpers/requestSender';
import { getTestContainerConfig, resetContainer } from '../helpers/containerConfig';

describe('tasks', function () {
  let requestSender: TasksRequestSender;
  let jobManagerConfigMock: IJobManagerConfig;

  registerDefaultConfig();
  const jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');

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
    it('should return 200 and create polygonParts task when getting completed init task of export job when task count and completed task are equal', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockInitTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.init,
        status: OperationStatus.COMPLETED,
      });
      const exportPolygonPartsTaskParams = {};
      const mockFullProcessFinalizeTaskParams = {
        parameters: exportPolygonPartsTaskParams,
        type: jobDefinitionsConfig.tasks.polygonParts,
        blockDuplication: false,
      };

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockInitTask.id }).reply(httpStatusCodes.OK, [mockInitTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockExportJob.id}/tasks`, mockFullProcessFinalizeTaskParams)
        .reply(httpStatusCodes.CREATED);
      const taskPercentage = calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockInitTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and create finalize task when getting completed polygonParts task of export job when task count and completed task are equal', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockPolygonPartsTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.polygonParts,
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
        type: jobDefinitionsConfig.tasks.finalize,
        blockDuplication: false,
      };
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { id: mockPolygonPartsTask.id })
        .reply(httpStatusCodes.OK, [mockPolygonPartsTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockExportJob.id}/tasks`, mockFullProcessFinalizeTaskParams)
        .reply(httpStatusCodes.CREATED);
      const taskPercentage = calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockPolygonPartsTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and update job progress only when getting completed init task of export job when task count and completed task are not equal', async () => {
      // mocks
      const mockExportJob = getExportJobMock({ completedTasks: 4 });
      const mockInitTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.init,
        status: OperationStatus.COMPLETED,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockInitTask.id }).reply(httpStatusCodes.OK, [mockInitTask]);
      const taskPercentage = calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockInitTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and create polygon-parts task when getting completed export merging task and init is completed', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockExportingTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.export,
        status: OperationStatus.COMPLETED,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockExportingTask.id }).reply(httpStatusCodes.OK, [mockExportingTask]);
      const taskPercentage = calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockExportJob.id}/tasks`, _.matches({ type: jobDefinitionsConfig.tasks.polygonParts }))
        .reply(httpStatusCodes.CREATED);

      // action
      const response = await requestSender.handleTaskNotification(mockExportingTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and create finalize task when getting failed task of export job', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockExportTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.export,
        status: OperationStatus.FAILED,
        reason: 'reason',
      });

      const mockExportErrorFinalizeTaskParams = {
        parameters: { callbacksSent: false, type: ExportFinalizeType.Error_Callback },
        type: jobDefinitionsConfig.tasks.finalize,
        blockDuplication: false,
      };
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockExportTask.id }).reply(httpStatusCodes.OK, [mockExportTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockExportJob.id}/tasks`, mockExportErrorFinalizeTaskParams)
        .reply(httpStatusCodes.CREATED);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, { status: OperationStatus.FAILED, reason: mockExportTask.reason })
        .reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockExportTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and complete job when getting completed export finalize task', async () => {
      const mockExportJob = getExportJobMock();
      const fullProccessingFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: true,
        gpkgUploadedToS3: true,
        callbacksSent: true,
      };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: fullProccessingFinalizeTaskParams,
      });
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(httpStatusCodes.OK, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, _.matches({ status: OperationStatus.COMPLETED }))
        .reply(httpStatusCodes.OK);

      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and fail export job when error callback export finalize task type is failing', async () => {
      const mockExportJob = getExportJobMock();

      const mockExportErrorFinalizeTaskParams: ExportFinalizeErrorCallbackParams = { callbacksSent: false, type: ExportFinalizeType.Error_Callback };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.FAILED,
        reason: 'error reason',
        parameters: mockExportErrorFinalizeTaskParams,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(httpStatusCodes.OK, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, { status: OperationStatus.FAILED, reason: mockFinalizeTask.reason })
        .reply(httpStatusCodes.OK);

      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and fail export job when full processing export finalize task type is failing', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockReason = 'finalize task failed';

      const mockExportFullProcessingFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: true,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.FAILED,
        reason: mockReason,
        parameters: mockExportFullProcessingFinalizeTaskParams,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(httpStatusCodes.OK, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, { status: OperationStatus.FAILED, reason: mockReason })
        .reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 update job percentage when export finalize ErrorCallback completed', async () => {
      // mocks
      const mockExportJob = getExportJobMock({ failedTasks: 1, taskCount: 6, status: OperationStatus.FAILED });
      const mockExportErrorCallbackTaskParams: ExportFinalizeErrorCallbackParams = {
        type: ExportFinalizeType.Error_Callback,
        callbacksSent: false,
      };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: mockExportErrorCallbackTaskParams,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(httpStatusCodes.OK, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, { percentage: calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount) })
        .reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 complete job and and create following task', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      setValue('taskFlowManager.exportTasksFlow', ['init', 'tilesExporting', 'polygon-parts', 'finalize', 'polygon-parts']);
      init();
      const mockExportErrorCallbackTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: true,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: mockExportErrorCallbackTaskParams,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(httpStatusCodes.OK, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockExportJob.id}/tasks`, { type: jobDefinitionsConfig.tasks.polygonParts, parameters: {}, blockDuplication: false })
        .reply(httpStatusCodes.OK);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, { percentage: calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1) })
        .reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 complete export job for notified export finalize task completed', async () => {
      const mockExportJob = getExportJobMock();

      const mockExportFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        gpkgModified: false,
        gpkgUploadedToS3: true,
        callbacksSent: true,
        type: ExportFinalizeType.Full_Processing,
      };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: mockExportFinalizeTaskParams,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(httpStatusCodes.OK, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .put(`/jobs/${mockExportJob.id}`, _.matches({ status: OperationStatus.COMPLETED }))
        .reply(httpStatusCodes.OK);

      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and create finalize task on a successful export merge', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockExportTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.polygonParts,
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
        type: jobDefinitionsConfig.tasks.finalize,
        blockDuplication: false,
      };

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockExportTask.id }).reply(httpStatusCodes.OK, [mockExportTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl).post(`/jobs/${mockExportJob.id}/tasks`, mockTaskParameters).reply(httpStatusCodes.CREATED);
      const taskPercentage = calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);
      // action
      const response = await requestSender.handleTaskNotification(mockExportTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });
  });

  describe('Complex Business Logic Scenarios', function () {
    it.each([
      {
        description: 'completed export tilesExporting task with completed init task',
        getJobMock: getExportJobMock,
        taskType: 'export',
        blockDuplication: false,
      },
      {
        description: 'completed export init task when completed after tilesExporting task',
        getJobMock: getExportJobMock,
        taskType: 'init',
        blockDuplication: false,
      },
    ])(
      'should return 200 and create polygon-parts task with correct blockDuplication for $description',
      async ({ getJobMock, taskType, blockDuplication }) => {
        // mocks
        const jobMock = getJobMock();
        const taskMock = getTaskMock(jobMock.id, {
          type: jobDefinitionsConfig.tasks[taskType as keyof typeof jobDefinitionsConfig.tasks],
          status: OperationStatus.COMPLETED,
        });

        nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: taskMock.id }).reply(httpStatusCodes.OK, [taskMock]);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${jobMock.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, jobMock);
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .post(`/jobs/${jobMock.id}/tasks`, {
            parameters: {},
            type: jobDefinitionsConfig.tasks.polygonParts,
            blockDuplication,
          })
          .reply(httpStatusCodes.CREATED);
        const taskPercentage = calculateJobPercentage(jobMock.completedTasks, jobMock.taskCount + 1);
        nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${jobMock.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);

        // action
        const response = await requestSender.handleTaskNotification(taskMock.id);

        // expectation
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      }
    );

    it('should return 200 and create export finalize task with Full_Processing type and proper defaults', async () => {
      // mocks
      const mockExportJob = getExportJobMock();
      const mockPolygonPartsTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.polygonParts,
        status: OperationStatus.COMPLETED,
      });

      const fullProccessingFinalizeTaskParams = {
        parameters: { type: ExportFinalizeType.Full_Processing, callbacksSent: false, gpkgModified: false, gpkgUploadedToS3: false },
        type: jobDefinitionsConfig.tasks.finalize,
        blockDuplication: false,
      };

      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post('/tasks/find', { id: mockPolygonPartsTask.id })
        .reply(httpStatusCodes.OK, [mockPolygonPartsTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockExportJob.id}/tasks`, fullProccessingFinalizeTaskParams)
        .reply(httpStatusCodes.CREATED);
      const taskPercentage = calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockPolygonPartsTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 200 and handle workflow continuation when export finalize triggers additional tasks', async () => {
      // mocks
      setValue('taskFlowManager.exportTasksFlow', ['init', 'tilesExporting', 'polygon-parts', 'finalize', 'polygon-parts']);
      init();

      const mockExportJob = getExportJobMock();
      const mockExportFullProcessingFinalizeTaskParams: ExportFinalizeFullProcessingParams = {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: true,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      };
      const mockFinalizeTask = getTaskMock(mockExportJob.id, {
        type: jobDefinitionsConfig.tasks.finalize,
        status: OperationStatus.COMPLETED,
        parameters: mockExportFullProcessingFinalizeTaskParams,
      });

      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockFinalizeTask.id }).reply(httpStatusCodes.OK, [mockFinalizeTask]);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .get(`/jobs/${mockExportJob.id}`)
        .query({ shouldReturnTasks: false })
        .reply(httpStatusCodes.OK, mockExportJob);
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/jobs/${mockExportJob.id}/tasks`, {
          type: jobDefinitionsConfig.tasks.polygonParts,
          parameters: {},
          blockDuplication: false,
        })
        .reply(httpStatusCodes.CREATED);
      const taskPercentage = calculateJobPercentage(mockExportJob.completedTasks, mockExportJob.taskCount + 1);
      nock(jobManagerConfigMock.jobManagerBaseUrl).put(`/jobs/${mockExportJob.id}`, { percentage: taskPercentage }).reply(httpStatusCodes.OK);

      // action
      const response = await requestSender.handleTaskNotification(mockFinalizeTask.id);

      // expectation
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response).toSatisfyApiSpec();
    });

    it.each([
      {
        taskType: 'init',
        jobType: 'export',
        getJobMock: () => getExportJobMock(),
        taskTypeKey: 'init' as const,
        reason: 'Export init task failed due to invalid parameters',
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
        nock(jobManagerConfigMock.jobManagerBaseUrl)
          .get(`/jobs/${jobMock.id}`)
          .query({ shouldReturnTasks: false })
          .reply(httpStatusCodes.OK, jobMock);
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

  describe('Bad Path', function () {
    // All requests with status code of 400
    it('should return 400 if the endpoint is called with a path parameter that is not a valid uuid', async () => {
      const response = await requestSender.handleTaskNotification('1');
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
    });
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it('should return 404 if the task given does not exists', async () => {
      // mocks
      const mockIngestionJob = createTestJob(jobDefinitionsConfig.jobs.export);
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfig.tasks.export, status: OperationStatus.COMPLETED });
      nock(jobManagerConfigMock.jobManagerBaseUrl)
        .post(`/tasks/find`, { id: mockMergeTask.id })
        .reply(httpStatusCodes.NOT_FOUND, 'message: Tasks not found');
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
      expect(response).toSatisfyApiSpec();
    });

    it('should return 428 if the task given is neither in "Completed" nor "Failed" status', async () => {
      // mocks
      const mockIngestionJob = createTestJob(jobDefinitionsConfig.jobs.export);
      const mockMergeTask = getTaskMock(mockIngestionJob.id, { type: jobDefinitionsConfig.tasks.export, status: OperationStatus.PENDING });
      nock(jobManagerConfigMock.jobManagerBaseUrl).post('/tasks/find', { id: mockMergeTask.id }).reply(httpStatusCodes.OK, [mockMergeTask]);
      // action
      const response = await requestSender.handleTaskNotification(mockMergeTask.id);
      // expectation
      expect(response.status).toBe(httpStatusCodes.PRECONDITION_REQUIRED);
      expect(response).toSatisfyApiSpec();
    });
  });
});
