import { jsLogger, type Logger } from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { BadRequestError } from '@map-colonies/error-types';
import type { IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { getCacheDeletionJobParamsMock, getDeleteCacheJobMock, getTaskMock } from '../../../mocks/jobMocks';
import { registerDefaultConfig, clear as clearConfig, configMock } from '../../../mocks/configMock';
import { queueClientMock } from '../../../mocks/mockJobManager';
import { getJobHandler } from '../../../../src/tasks/handlers/jobHandlerFactory';

describe('DeleteCacheJobHandler', () => {
  let mockLogger: Logger;
  beforeAll(async () => {
    mockLogger = await jsLogger({ enabled: false });
  });

  registerDefaultConfig();
  const jobDefinitionsConfig = configMock.get('jobDefinitions') as IJobDefinitionsConfig;
  const testCases = [{ jobType: jobDefinitionsConfig.jobs.updateCacheDeletion }, { jobType: jobDefinitionsConfig.jobs.swapCacheDeletion }];

  const testCaseHandlerLog = '$jobType handler';

  beforeEach(() => {
    registerDefaultConfig();
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('isJobCompleted', () => {
    const getHandler = (jobType: string, completedTasks: number, taskCount: number, parameters: unknown): ReturnType<typeof getJobHandler> => {
      const mockJob = getDeleteCacheJobMock(jobType, { completedTasks, taskCount, parameters });
      const mockTask = getTaskMock<unknown>(mockJob.id, { type: jobDefinitionsConfig.tasks.tilesDeletion, status: OperationStatus.COMPLETED });
      return getJobHandler(mockJob.type, jobDefinitionsConfig, mockLogger, queueClientMock, configMock, mockJob, mockTask);
    };

    it.each(testCases)(`should return true when all tasks are completed and tasks creation is completed - ${testCaseHandlerLog}`, ({ jobType }) => {
      const handler = getHandler(jobType, 10, 10, getCacheDeletionJobParamsMock({ tasksCreationCompleted: true }));

      expect(handler.isJobCompleted(jobDefinitionsConfig.tasks.tilesDeletion)).toBe(true);
    });

    it.each(testCases)(`should return false when not all of the tasks are completed - ${testCaseHandlerLog}`, ({ jobType }) => {
      const handler = getHandler(jobType, 5, 10, getCacheDeletionJobParamsMock({ tasksCreationCompleted: true }));

      expect(handler.isJobCompleted(jobDefinitionsConfig.tasks.tilesDeletion)).toBe(false);
    });

    it.each(testCases)(`should return false when all tasks are completed but tasks creation is not - ${testCaseHandlerLog}`, ({ jobType }) => {
      const handler = getHandler(jobType, 10, 10, getCacheDeletionJobParamsMock({ tasksCreationCompleted: false }));

      expect(handler.isJobCompleted(jobDefinitionsConfig.tasks.tilesDeletion)).toBe(false);
    });

    it.each(testCases)(`should throw BadRequestError when job parameters are invalid - ${testCaseHandlerLog}`, ({ jobType }) => {
      const handler = getHandler(jobType, 10, 10, {});

      expect(() => handler.isJobCompleted(jobDefinitionsConfig.tasks.tilesDeletion)).toThrow(BadRequestError);
    });
  });
});
