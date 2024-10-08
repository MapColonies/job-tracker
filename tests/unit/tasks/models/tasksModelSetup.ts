import { ICreateTaskBody, IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import jsLogger from '@map-colonies/js-logger';
import { TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { TasksManager } from '../../../../src/tasks/models/tasksManager';
import { configMock } from '../../../mocks/configMock';
import { IJobManagerConfig, ITaskTypesConfig } from '../../../../src/common/interfaces';

export type MockGetJob = jest.MockedFunction<(jobId: string) => Promise<IJobResponse<unknown, unknown>>>;
export type MockFindTasks = jest.MockedFunction<(taskId: string) => Promise<ITaskResponse<unknown>[] | null>>;
export type MockUpdateJob = jest.MockedFunction<(jobId: string, update: Record<string, unknown>) => Promise<void>>;
export type MockCreateTaskForJob = jest.MockedFunction<(jobId: string, body: ICreateTaskBody<unknown>) => Promise<void>>;

export interface TasksModelTestContext {
  tasksManager: TasksManager;
  mockGetJob: MockGetJob;
  mockFindTasks: MockFindTasks;
  mockUpdateJob: MockUpdateJob;
  mockCreateTaskForJob: MockCreateTaskForJob;
  configMock: typeof configMock;
  queueClient: QueueClient;
  taskTypesConfigMock: ITaskTypesConfig;
}

export function setupTasksModelTest({ useMockQueueClient = false }: { useMockQueueClient?: boolean }): TasksModelTestContext {
  const mockLogger = jsLogger({ enabled: false });

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

  const jobManagerConfig = configMock.get<IJobManagerConfig>('jobManagement.config');

  const queueClientInstance = new QueueClient(
    mockLogger,
    jobManagerConfig.jobManagerBaseUrl,
    jobManagerConfig.heartbeat.baseUrl,
    jobManagerConfig.dequeueIntervalMs,
    jobManagerConfig.heartbeat.intervalMs
  );

  const queueClient = useMockQueueClient ? mockQueueClient : queueClientInstance;
  const tasksManager = new TasksManager(mockLogger, queueClient, configMock);
  const taskTypesConfigMock = configMock.get<ITaskTypesConfig>('taskTypes');
  return {
    tasksManager,
    mockGetJob,
    mockFindTasks,
    mockUpdateJob,
    mockCreateTaskForJob,
    configMock,
    queueClient,
    taskTypesConfigMock,
  };
}
