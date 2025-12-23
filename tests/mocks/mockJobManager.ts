import { JobManagerClient, TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';

export const mockJobManager = {
  updateJob: jest.fn(),
  createTaskForJob: jest.fn(),
  findTasks: jest.fn(),
} as unknown as jest.Mocked<JobManagerClient>;

export const queueClientMock = {
  jobManagerClient: mockJobManager,
  ack: jest.fn(),
  reject: jest.fn(),
} as unknown as jest.Mocked<QueueClient>;
