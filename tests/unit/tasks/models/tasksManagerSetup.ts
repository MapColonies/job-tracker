import { JobManagerClient, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { jsLogger } from '@map-colonies/js-logger';
import { TasksManager } from '../../../../src/tasks/models/tasksManager';
import { configMock } from '../../../mocks/configMock';
import { IJobManagerConfig, IJobDefinitionsConfig } from '../../../../src/common/interfaces';

interface QueueClientTestContext {
  mockGetJob: MockGetJob;
  mockFindTasks: MockFindTasks;
  mockUpdateJob: MockUpdateJob;
  mockCreateTaskForJob: MockCreateTaskForJob;
  queueClient: QueueClient;
}

async function setupQueueClient(useMockQueueClient = false): Promise<QueueClientTestContext> {
  const mockLogger = await jsLogger({ enabled: false });
  const mockGetJob = jest.fn() as MockGetJob;
  const mockFindTasks = jest.fn() as MockFindTasks;
  const mockUpdateJob = jest.fn() as MockUpdateJob;
  const mockCreateTaskForJob = jest.fn() as MockCreateTaskForJob;

  const mockQueueClient = {
    jobManagerClient: {
      getJob: mockGetJob,
      findTasks: mockFindTasks,
      updateJob: mockUpdateJob,
      createTaskForJob: mockCreateTaskForJob,
    },
  } as unknown as jest.Mocked<QueueClient>;

  const jobManagerConfig = configMock.get('jobManagement.config') as unknown as IJobManagerConfig;
  const queueClientInstance = new QueueClient(
    mockLogger,
    jobManagerConfig.jobManagerBaseUrl,
    jobManagerConfig.heartbeat.baseUrl,
    jobManagerConfig.dequeueIntervalMs,
    jobManagerConfig.heartbeat.intervalMs
  );

  const queueClient = useMockQueueClient ? mockQueueClient : queueClientInstance;
  return {
    mockGetJob,
    mockFindTasks,
    mockUpdateJob,
    mockCreateTaskForJob,
    queueClient,
  };
}

export type MockGetJob = jest.MockedFunction<JobManagerClient['getJob']>;
export type MockFindTasks = jest.MockedFunction<JobManagerClient['findTasks']>;
export type MockUpdateJob = jest.MockedFunction<JobManagerClient['updateJob']>;
export type MockCreateTaskForJob = jest.MockedFunction<JobManagerClient['createTaskForJob']>;

export interface TasksModelTestContext {
  tasksManager: TasksManager;
  configMock: typeof configMock;
  jobDefinitionsConfigMock: IJobDefinitionsConfig;
  mockGetJob: MockGetJob;
  mockFindTasks: MockFindTasks;
  mockUpdateJob: MockUpdateJob;
  mockCreateTaskForJob: MockCreateTaskForJob;
  queueClient: QueueClient;
}

export async function setupTasksManagerTest(useMockQueueClient = false): Promise<TasksModelTestContext> {
  const mockLogger = await jsLogger({ enabled: false });

  const queueContext = await setupQueueClient(useMockQueueClient);
  const tasksManager = new TasksManager(mockLogger, queueContext.queueClient, configMock);
  const jobDefinitionsConfigMock = configMock.get('jobDefinitions') as IJobDefinitionsConfig;
  return {
    tasksManager,
    configMock,
    jobDefinitionsConfigMock,
    ...queueContext,
  };
}
