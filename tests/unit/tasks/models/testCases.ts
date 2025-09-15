import { IJobResponse } from '@map-colonies/mc-priority-queue';
import { getExportJobMock, getIngestionJobMock } from '../../../mocks/JobMocks';

export interface PolygonPartsTaskCreationTestCase {
  description: string;
  getJobMock: (override?: Partial<IJobResponse<unknown, unknown>>) => IJobResponse<unknown, unknown>;
  taskType: string;
}

export const polygonPartsTaskCreationTestCases: PolygonPartsTaskCreationTestCase[] = [
  {
    description: 'completed ingestion merge task with completed init task',
    getJobMock: getIngestionJobMock,
    taskType: 'tilesMerging',
  },
  {
    description: 'completed ingestion init task when completed after merge task',
    getJobMock: getIngestionJobMock,
    taskType: 'init',
  },
  {
    description: 'completed export tilesExporting task with completed init task',
    getJobMock: getExportJobMock,
    taskType: 'tilesExporting',
  },
  {
    description: 'completed export init task when completed after tilesExporting task',
    getJobMock: getExportJobMock,
    taskType: 'init',
  },
];
