import { ExportFinalizeType, ExportFinalizeFullProcessingParams, IngestionNewFinalizeTaskParams, IngestionUpdateFinalizeTaskParams, IngestionSwapUpdateFinalizeTaskParams } from '@map-colonies/raster-shared';
import { JobAndTask, IJobDefinitionsConfig } from './interfaces';

export const createTaskParametersMapper = (jobDefinitions: IJobDefinitionsConfig): Map<JobAndTask, Record<PropertyKey, unknown>> => {
  return new Map<JobAndTask, Record<PropertyKey, unknown>>([
    [`${jobDefinitions.jobs.new}_${jobDefinitions.tasks.mergeTaskCreation}`, {}],
    [`${jobDefinitions.jobs.update}_${jobDefinitions.tasks.mergeTaskCreation}`, {}],
    [`${jobDefinitions.jobs.swapUpdate}_${jobDefinitions.tasks.mergeTaskCreation}`, {}],
    [
      `${jobDefinitions.jobs.new}_${jobDefinitions.tasks.finalize}`,
      {
        processParts: false,
        insertedToCatalog: false,
        insertedToGeoServer: false,
        insertedToMapproxy: false,
      } satisfies IngestionNewFinalizeTaskParams,
    ],
    [
      `${jobDefinitions.jobs.update}_${jobDefinitions.tasks.finalize}`,
      {
        processParts: false,
        updatedInCatalog: false,
      } satisfies IngestionUpdateFinalizeTaskParams,
    ],
    [
      `${jobDefinitions.jobs.swapUpdate}_${jobDefinitions.tasks.finalize}`,
      {
        processParts: false,
        updatedInCatalog: false,
        updatedInMapproxy: false,
      } satisfies IngestionSwapUpdateFinalizeTaskParams,
    ],
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
