import {
  IngestionNewFinalizeTaskParams,
  IngestionUpdateFinalizeTaskParams,
  IngestionSwapUpdateFinalizeTaskParams,
} from '@map-colonies/mc-model-types';
import { ExportFinalizeType, ExportFinalizeFullProcessingParams } from '@map-colonies/raster-shared';
import { JobAndTask, IJobDefinitionsConfig } from './interfaces';

export const createTaskParametersMapper = (jobDefinitions: IJobDefinitionsConfig): Map<JobAndTask, Record<PropertyKey, unknown>> => {
  return new Map<JobAndTask, Record<PropertyKey, unknown>>([
    [
      `${jobDefinitions.jobs.new}_${jobDefinitions.tasks.finalize}`,
      {
        insertedToCatalog: false,
        insertedToGeoServer: false,
        insertedToMapproxy: false,
      } satisfies IngestionNewFinalizeTaskParams,
    ],
    [`${jobDefinitions.jobs.new}_${jobDefinitions.tasks.polygonParts}`, {}],
    [`${jobDefinitions.jobs.update}_${jobDefinitions.tasks.polygonParts}`, {}],
    [
      `${jobDefinitions.jobs.update}_${jobDefinitions.tasks.finalize}`,
      {
        updatedInCatalog: false,
      } satisfies IngestionUpdateFinalizeTaskParams,
    ],
    [
      `${jobDefinitions.jobs.swapUpdate}_${jobDefinitions.tasks.finalize}`,
      {
        updatedInCatalog: false,
        updatedInMapproxy: false,
      } satisfies IngestionSwapUpdateFinalizeTaskParams,
    ],
    [`${jobDefinitions.jobs.swapUpdate}_${jobDefinitions.tasks.polygonParts}`, {}],
    [`${jobDefinitions.jobs.export}_${jobDefinitions.tasks.polygonParts}`, {}],
    [
      `${jobDefinitions.jobs.export}_${jobDefinitions.tasks.finalize}`,
      {
        type: ExportFinalizeType.Full_Processing,
        gpkgModified: false,
        gpkgUploadedToS3: false,
        callbacksSent: false,
      } satisfies ExportFinalizeFullProcessingParams,
    ],
  ]);
};
