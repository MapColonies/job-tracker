import { BadRequestError } from '@map-colonies/error-types';
import jsLogger from '@map-colonies/js-logger';
import { TaskHandler as QueueClient, IJobResponse } from '@map-colonies/mc-priority-queue';
import { registerDefaultConfig, clear as clearConfig } from '../../../mocks/configMock';
import { configMock } from '../../../mocks/configMock';
import { getExportJobMock, getIngestionJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { getJobHandler } from '../../../../src/tasks/handlers/jobHandlerFactory';
import { IJobDefinitionsConfig } from '../../../../src/common/interfaces';
import { IngestionJobHandler } from '../../../../src/tasks/handlers/ingestion/ingestionHandler';
import { ExportJobHandler } from '../../../../src/tasks/handlers/export/exportHandler';

// Test helper functions
const createTestLogger = () => jsLogger({ enabled: false });
const createMockQueueClient = () => ({} as QueueClient);

interface TestCase {
  name: string;
  jobType: string;
  mockJob: IJobResponse<unknown, unknown>;
}

const createIngestionJobTestCase = (jobType: string, jobDefinition: string): TestCase => ({
  name: jobType,
  jobType: jobDefinition,
  mockJob: getIngestionJobMock({ type: jobDefinition }),
});

const createExportJobTestCase = (jobDefinitionsConfig: IJobDefinitionsConfig): TestCase => ({
  name: 'export',
  jobType: jobDefinitionsConfig.jobs.export,
  mockJob: getExportJobMock({ type: jobDefinitionsConfig.jobs.export }),
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
    it.each([
      { jobName: 'new', getJobType: (config: IJobDefinitionsConfig) => config.jobs.new },
      { jobName: 'update', getJobType: (config: IJobDefinitionsConfig) => config.jobs.update },
      { jobName: 'swapUpdate', getJobType: (config: IJobDefinitionsConfig) => config.jobs.swapUpdate },
      { jobName: 'seed', getJobType: (config: IJobDefinitionsConfig) => config.jobs.seed },
    ])('should create IngestionJobHandler for $jobName job type', ({ jobName, getJobType }) => {
      // Given: ingestion job and task
      const jobType = getJobType(jobDefinitionsConfig);
      const testCase = createIngestionJobTestCase(jobName, jobType);
      const mockTask = getTaskMock(testCase.mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When: creating handler for job type
      const handler = getJobHandler(jobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, testCase.mockJob, mockTask);

      // Then: should create IngestionJobHandler
      expect(handler).toBeInstanceOf(IngestionJobHandler);
    });
  });

  describe('Export job handlers', () => {
    it('should create ExportJobHandler for export job type', () => {
      // Given: export job and task
      const exportTestCase = createExportJobTestCase(jobDefinitionsConfig);
      const mockTask = getTaskMock(exportTestCase.mockJob.id);
      const mockQueueClient = createMockQueueClient();

      // When: creating handler for export job type
      const handler = getJobHandler(
        exportTestCase.jobType,
        jobDefinitionsConfig,
        logger,
        mockQueueClient,
        configMock,
        exportTestCase.mockJob,
        mockTask
      );

      // Then: should create ExportJobHandler
      expect(handler).toBeInstanceOf(ExportJobHandler);
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
        getJobHandler(invalidJobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, mockJob, mockTask);
      }).toThrow(BadRequestError);

      expect(() => {
        getJobHandler(invalidJobType, jobDefinitionsConfig, logger, mockQueueClient, configMock, mockJob, mockTask);
      }).toThrow(new BadRequestError(`${invalidJobType} job type is invalid`));
    });
  });
});
