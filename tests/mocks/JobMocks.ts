import { IJobResponse, ITaskResponse } from '@map-colonies/mc-priority-queue';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { faker } from '@faker-js/faker';

export const getIngestionJobMock = (): IJobResponse<unknown, unknown> => {
  return {
    id: faker.string.uuid(),
    resourceId: 'test',
    version: '1.0',
    type: 'Ingestion_New',
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
};

export const getTaskMock = (jobId: string, type: string, status: OperationStatus): ITaskResponse<unknown> => {
  return {
    id: faker.string.uuid(),
    jobId,
    description: '',
    parameters: {},
    created: faker.date.anytime().toString(),
    updated: faker.date.anytime().toString(),
    type,
    status,
    percentage: 100,
    reason: '',
    attempts: 0,
    resettable: false,
  };
};
