import { IngestionNewFinalizeTaskParams, IngestionUpdateFinalizeTaskParams, IngestionSwapUpdateFinalizeTaskParams } from "@map-colonies/mc-model-types";
import { ExportFinalizeType, ExportFinalizeFullProcessingParams } from "@map-colonies/raster-shared";
import { JobAndTask } from "./interfaces";

// export const taskParameterMapper: Partial<Record<JobAndTask, unknown>> = {
//     [`Ingestion_New_finalize`]: ({
//         insertedToCatalog: false,
//         insertedToGeoServer: false,
//         insertedToMapproxy: false,
//     } satisfies IngestionNewFinalizeTaskParams),

//     [`Ingestion_Update_finalize`]: ({
//         updatedInCatalog: false,
//     } satisfies IngestionUpdateFinalizeTaskParams),

//     [`Ingestion_Swap_Update_finalize`]: ({
//         updatedInCatalog: false,
//         updatedInMapproxy: false,
//     } satisfies IngestionSwapUpdateFinalizeTaskParams),

//     [`Ingestion_New_polygon-parts`]: {},

//     [`Export_finalize`]: ({
//         type: ExportFinalizeType.Full_Processing,
//         gpkgModified: false,
//         gpkgUploadedToS3: false,
//         callbacksSent: false,
//     } satisfies ExportFinalizeFullProcessingParams),
// };


export const taskParameterMapper = new Map<JobAndTask, unknown>([
    [
        'Ingestion_New_finalize',
        {
            insertedToCatalog: false,
            insertedToGeoServer: false,
            insertedToMapproxy: false,
        } satisfies IngestionNewFinalizeTaskParams,
    ],
    [
        'Ingestion_Update_finalize',
        {
            updatedInCatalog: false,
        } satisfies IngestionUpdateFinalizeTaskParams,
    ],
    [
        'Ingestion_Swap_Update_finalize',
        {
            updatedInCatalog: false,
            updatedInMapproxy: false,
        } satisfies IngestionSwapUpdateFinalizeTaskParams,
    ],
    ['Ingestion_New_polygon-parts', {}],
    [
        'Export_finalize',
        {
            type: ExportFinalizeType.Full_Processing,
            gpkgModified: false,
            gpkgUploadedToS3: false,
            callbacksSent: false,
        } satisfies ExportFinalizeFullProcessingParams,
    ],
]);
