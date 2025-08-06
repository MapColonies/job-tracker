import { IJobResponse } from '@map-colonies/mc-priority-queue';
import { getExportJobMock, getIngestionJobMock } from '../../../mocks/JobMocks';

export interface PolygonPartsTaskCreationTestCase {
  description: string;
  getJobMock: (override?: Partial<IJobResponse<unknown, unknown>>) => IJobResponse<unknown, unknown>;
  taskType: string;
}

export const polygonPartsTaskCreationTestCases: PolygonPartsTaskCreationTestCase[] = [
  {
    description: 'Completed ingestion merge task with Completed init task',
    getJobMock: getIngestionJobMock,
    taskType: 'tilesMerging',
  },
  {
    description: 'Completed ingestion init task when completed after merge task',
    getJobMock: getIngestionJobMock,
    taskType: 'init',
  },
  {
    description: 'Completed export tilesExporting task with Completed init task',
    getJobMock: getExportJobMock,
    taskType: 'tilesExporting',
  },
  {
    description: 'Completed export init task when completed after tilesExporting task',
    getJobMock: getExportJobMock,
    taskType: 'init',
  },
];
