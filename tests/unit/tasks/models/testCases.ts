import { IJobResponse } from '@map-colonies/mc-priority-queue';
import { getExportJobMock, getIngestionJobMock } from '../../../mocks/JobMocks';

export interface PolygonPartsTaskCreationTestCase {
  description: string;
  getJobMock: (override?: Partial<IJobResponse<unknown, unknown>>) => IJobResponse<unknown, unknown>;
  taskType: string;
}

export const polygonPartsTaskCreationTestCases: PolygonPartsTaskCreationTestCase[] = [
  {
    description: 'Completed merge task with Completed init task',
    getJobMock: getIngestionJobMock,
    taskType: 'tilesMerging',
  },
  {
    description: 'Init task when completed after merge task',
    getJobMock: getIngestionJobMock,
    taskType: 'init',
  },
  {
    description: 'Completed merge task with Completed init task',
    getJobMock: getExportJobMock,
    taskType: 'tilesExporting',
  },
  {
    description: 'Init task when completed after merge task',
    getJobMock: getExportJobMock,
    taskType: 'init',
  },
];
