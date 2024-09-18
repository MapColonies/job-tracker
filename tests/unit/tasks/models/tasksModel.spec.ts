import jsLogger from '@map-colonies/js-logger';
import nock from 'nock';
import { TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { TasksManager } from '../../../../src/tasks/models/tasksManager';
import { configMock, registerDefaultConfig, clear as clearConfig } from '../../../mocks/configMock';
import { IJobManagerConfig } from '../../../../src/common/interfaces';

describe('TasksManager', () => {
  let jobManagerClient: TasksManager;
  let jobManagerURL: string;
  const mockLogger = jsLogger({ enabled: false });

  beforeEach(function () {
    registerDefaultConfig();
    const jobManagerConfig = configMock.get<IJobManagerConfig>('jobManagement.config');
    const queueClientInstance = new QueueClient(
      mockLogger,
      jobManagerConfig.jobManagerBaseUrl,
      jobManagerConfig.heartbeat.baseUrl,
      jobManagerConfig.dequeueIntervalMs,
      jobManagerConfig.heartbeat.intervalMs
    );
    jobManagerClient = new TasksManager(mockLogger, queueClientInstance);
    jobManagerURL = configMock.get<string>('jobManagement.config.jobManagerBaseUrl');
  });

  afterEach(() => {
    nock.cleanAll();
    clearConfig();
    jest.resetAllMocks();
  });

  describe('handleTaskNotification', () => {});
});
