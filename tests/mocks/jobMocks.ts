import { IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { faker } from '@faker-js/faker';
import { JobType } from '../../src/common/interfaces';

export const createTestJob = (jobType: JobType, overrides?: Partial<IJobResponse<unknown, unknown>>): IJobResponse<unknown, unknown> => {
  return getMockJob(jobType, {
    completedTasks: 5,
    taskCount: 10,
    ...overrides,
  });
};
export const getMockJob = (jobType: JobType, override?: Partial<IJobResponse<unknown, unknown>>): IJobResponse<unknown, unknown> => {
  const defaultJobMock = {
    id: faker.string.uuid(),
    resourceId: 'test',
    version: '1.0',
    type: jobType,
    description: '',
    status: OperationStatus.IN_PROGRESS,
    percentage: 100,
    reason: '',
    domain: 'RASTER',
    isCleaned: false,
    priority: 0,
    parameters: {},
    expirationDate: undefined,
    internalId: faker.string.uuid(),
    producerName: undefined,
    productName: 'test',
    productType: 'Orthophoto',
    additionalIdentifiers: '',
    taskCount: 5,
    completedTasks: 5,
    failedTasks: 0,
    expiredTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    abortedTasks: 0,
    created: faker.date.anytime().toString(),
    updated: faker.date.anytime().toString(),
  };
  return { ...defaultJobMock, ...override };
};

export const getExportJobMock = (override?: Partial<IJobResponse<unknown, unknown>>): IJobResponse<unknown, unknown> => {
  const defaultJobMock = {
    id: faker.string.uuid(),
    resourceId: 'test',
    version: '1.0',
    type: 'Export',
    description: '',
    status: OperationStatus.IN_PROGRESS,
    percentage: 100,
    reason: '',
    domain: 'RASTER',
    isCleaned: false,
    priority: 0,
    parameters: {},
    expirationDate: undefined,
    internalId: faker.string.uuid(),
    producerName: undefined,
    productName: 'test',
    productType: 'Orthophoto',
    additionalIdentifiers: '',
    taskCount: 5,
    completedTasks: 5,
    failedTasks: 0,
    expiredTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    abortedTasks: 0,
    created: faker.date.anytime().toString(),
    updated: faker.date.anytime().toString(),
  };
  return { ...defaultJobMock, ...override };
};

export const getSeedingJobMock = (override?: Partial<IJobResponse<unknown, unknown>>): IJobResponse<unknown, unknown> => {
  const defaultJobMock = {
    id: faker.string.uuid(),
    resourceId: 'test',
    version: '1.0',
    type: 'TilesSeeding',
    description: '',
    status: OperationStatus.IN_PROGRESS,
    percentage: 87,
    reason: '',
    domain: 'RASTER',
    isCleaned: false,
    priority: 0,
    parameters: {},
    expirationDate: undefined,
    internalId: faker.string.uuid(),
    producerName: undefined,
    productName: 'test',
    productType: 'Orthophoto',
    additionalIdentifiers: '',
    taskCount: 6,
    completedTasks: 5,
    failedTasks: 1,
    expiredTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    abortedTasks: 0,
    created: faker.date.anytime().toString(),
    updated: faker.date.anytime().toString(),
  };
  return { ...defaultJobMock, ...override };
};

export const getTaskMock = <T>(jobId: string, override?: Partial<Omit<ITaskResponse<T>, 'jobId'>>): ITaskResponse<T> => {
  const defaultTaskMock = {
    id: faker.string.uuid(),
    jobId,
    description: '',
    parameters: {} as T,
    created: faker.date.anytime().toString(),
    updated: faker.date.anytime().toString(),
    type: '',
    status: OperationStatus.COMPLETED,
    percentage: 100,
    reason: '',
    attempts: 0,
    resettable: false,
  };

  return { ...defaultTaskMock, ...override };
};
