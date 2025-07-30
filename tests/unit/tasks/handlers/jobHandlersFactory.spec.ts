import { BadRequestError } from '@map-colonies/error-types';
import jsLogger from '@map-colonies/js-logger';
import { TaskHandler as QueueClient, IJobResponse } from '@map-colonies/mc-priority-queue';
import { registerDefaultConfig, clear as clearConfig } from '../../../mocks/configMock';
import { configMock } from '../../../mocks/configMock';
import { getExportJobMock, getIngestionJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { jobHandlerFactory } from '../../../../src/tasks/handlers/jobHandlersFactory';
import { IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { JOB_TYPES } from '../../../helpers/testConstants';

// Test helper functions
const createTestLogger = () => jsLogger({ enabled: false });
const createMockQueueClient = () => ({} as QueueClient);

interface TestCase {
  name: string;
  jobType: string;
  mockJob: IJobResponse<unknown, unknown>;
  expectedHandlerName: string;
}

const createIngestionJobTestCase = (jobType: string, jobDefinition: string): TestCase => ({
  name: jobType,
  jobType: jobDefinition,
  mockJob: getIngestionJobMock({ type: jobDefinition }),
  expectedHandlerName: 'IngestionJobHandler',
});

const createExportJobTestCase = (): TestCase => ({
  name: 'export',
  jobType: JOB_TYPES.export,
  mockJob: getExportJobMock({ type: JOB_TYPES.export }),
  expectedHandlerName: 'ExportJobHandler',
});

describe('jobHandlerFactory', () => {
  const logger = createTestLogger();
  let jobDefinitionsConfig: IJobDefinitionsConfig;

  beforeEach(() => {
    registerDefaultConfig();
    jobDefinitionsConfig = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  describe('Ingestion job handlers', () => {
    it('should create IngestionJobHandler for new job type', () => {
      // Given: new ingestion job and task
      const testCase = createIngestionJobTestCase('new', jobDefinitionsConfig.jobs.new);
      const mockTask = getTaskMock(testCase.mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When: creating handler for new job type
      const handler = jobHandlerFactory(testCase.jobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, testCase.mockJob, mockTask);

      // Then: should create IngestionJobHandler
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('IngestionJobHandler');
    });

    it('should create IngestionJobHandler for update job type', () => {
      // Given: update ingestion job and task
      const testCase = createIngestionJobTestCase('update', jobDefinitionsConfig.jobs.update);
      const mockTask = getTaskMock(testCase.mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When: creating handler for update job type
      const handler = jobHandlerFactory(testCase.jobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, testCase.mockJob, mockTask);

      // Then: should create IngestionJobHandler
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('IngestionJobHandler');
    });

    it('should create IngestionJobHandler for swapUpdate job type', () => {
      // Given: swapUpdate ingestion job and task
      const testCase = createIngestionJobTestCase('swapUpdate', jobDefinitionsConfig.jobs.swapUpdate);
      const mockTask = getTaskMock(testCase.mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When: creating handler for swapUpdate job type
      const handler = jobHandlerFactory(testCase.jobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, testCase.mockJob, mockTask);

      // Then: should create IngestionJobHandler
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('IngestionJobHandler');
    });

    it('should create IngestionJobHandler for seed job type', () => {
      // Given: seed ingestion job and task
      const testCase = createIngestionJobTestCase('seed', jobDefinitionsConfig.jobs.seed);
      const mockTask = getTaskMock(testCase.mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When: creating handler for seed job type
      const handler = jobHandlerFactory(testCase.jobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, testCase.mockJob, mockTask);

      // Then: should create IngestionJobHandler
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('IngestionJobHandler');
    });
  });

  describe('Export job handlers', () => {
    it('should create ExportJobHandler for export job type', () => {
      // Given: export job and task
      const exportTestCase = createExportJobTestCase();
      const mockTask = getTaskMock(exportTestCase.mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When: creating handler for export job type
      const handler = jobHandlerFactory(
        exportTestCase.jobType,
        jobDefinitionsConfig,
        logger,
        mockQueueClient,
        configMock,
        exportTestCase.mockJob,
        mockTask
      );

      // Then: should create ExportJobHandler
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe(exportTestCase.expectedHandlerName);
    });
  });

  describe('Error handling', () => {
    it('should throw BadRequestError for invalid job type', () => {
      // Given: invalid job type
      const invalidJobType = 'InvalidJobType';
      const mockJob = getExportJobMock();
      const mockTask = getTaskMock(mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When & Then: should throw BadRequestError for invalid job type
      expect(() => {
        jobHandlerFactory(invalidJobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, mockJob, mockTask);
      }).toThrow(BadRequestError);

      expect(() => {
        jobHandlerFactory(invalidJobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, mockJob, mockTask);
      }).toThrow(`${invalidJobType} job type is invalid`);
    });
  });
});
