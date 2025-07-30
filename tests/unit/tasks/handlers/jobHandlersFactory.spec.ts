import { BadRequestError } from '@map-colonies/error-types';
import jsLogger from '@map-colonies/js-logger';
import { TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { registerDefaultConfig, clear as clearConfig } from '../../../mocks/configMock';
import { configMock } from '../../../mocks/configMock';
import { getExportJobMock, getIngestionJobMock, getTaskMock } from '../../../mocks/JobMocks';
import { jobHandlerFactory } from '../../../../src/tasks/handlers/jobHandlersFactory';
import { IJobDefinitionsConfig } from '../../../../src/common/interfaces';

describe('jobHandlerFactory', () => {
  const logger = jsLogger({ enabled: false });
  let jobDefinitionsConfigMock: IJobDefinitionsConfig;

  beforeEach(() => {
    registerDefaultConfig();
    jobDefinitionsConfigMock = configMock.get<IJobDefinitionsConfig>('jobDefinitions');
  });

  afterEach(() => {
    clearConfig();
    jest.resetAllMocks();
  });

  it('should create IngestionJobHandler for ingestion job types', () => {
    const mockJob = getIngestionJobMock();
    const mockTask = getTaskMock(mockJob.id);
    const mockQueueClient = {} as QueueClient;

    // Test new job type
    let handler = jobHandlerFactory(
      jobDefinitionsConfigMock.jobs.new,
      jobDefinitionsConfigMock,
      logger,
      mockQueueClient,
      configMock,
      mockJob,
      mockTask
    );
    expect(handler).toBeDefined();
    expect(handler.constructor.name).toBe('IngestionJobHandler');

    // Test update job type
    handler = jobHandlerFactory(
      jobDefinitionsConfigMock.jobs.update,
      jobDefinitionsConfigMock,
      logger,
      mockQueueClient,
      configMock,
      mockJob,
      mockTask
    );
    expect(handler).toBeDefined();
    expect(handler.constructor.name).toBe('IngestionJobHandler');

    // Test swapUpdate job type
    handler = jobHandlerFactory(
      jobDefinitionsConfigMock.jobs.swapUpdate,
      jobDefinitionsConfigMock,
      logger,
      mockQueueClient,
      configMock,
      mockJob,
      mockTask
    );
    expect(handler).toBeDefined();
    expect(handler.constructor.name).toBe('IngestionJobHandler');

    // Test seed job type
    handler = jobHandlerFactory(jobDefinitionsConfigMock.jobs.seed, jobDefinitionsConfigMock, logger, mockQueueClient, configMock, mockJob, mockTask);
    expect(handler).toBeDefined();
    expect(handler.constructor.name).toBe('IngestionJobHandler');
  });

  it('should create ExportJobHandler for export job type', () => {
    const mockJob = getExportJobMock();
    const mockTask = getTaskMock(mockJob.id);
    const mockQueueClient = {} as QueueClient;

    const handler = jobHandlerFactory(
      jobDefinitionsConfigMock.jobs.export,
      jobDefinitionsConfigMock,
      logger,
      mockQueueClient,
      configMock,
      mockJob,
      mockTask
    );

    expect(handler).toBeDefined();
    expect(handler.constructor.name).toBe('ExportJobHandler');
  });

  it('should throw BadRequestError for invalid job type', () => {
    const mockJob = getExportJobMock();
    const mockTask = getTaskMock(mockJob.id);
    const mockQueueClient = {} as QueueClient;

    expect(() => {
      jobHandlerFactory('InvalidJobType', jobDefinitionsConfigMock, logger, mockQueueClient, configMock, mockJob, mockTask);
    }).toThrow(BadRequestError);

    expect(() => {
      jobHandlerFactory('InvalidJobType', jobDefinitionsConfigMock, logger, mockQueueClient, configMock, mockJob, mockTask);
    }).toThrow('InvalidJobType job type is invalid');
  });
});
