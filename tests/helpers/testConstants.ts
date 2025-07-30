// Test constants derived from job definitions config
// These constants should match the values in config/default.json

export const JOB_TYPES = {
  new: 'Ingestion_New',
  update: 'Ingestion_Update',
  swapUpdate: 'Ingestion_Swap_Update',
  export: 'Export',
  seed: 'TilesSeeding',
} as const;

export const TASK_TYPES = {
  init: 'init',
  merge: 'tilesMerging',
  polygonParts: 'polygon-parts',
  export: 'tilesExporting',
  finalize: 'finalize',
  seed: 'TilesSeeding',
} as const;

export const TASK_FLOWS = {
  ingestion: ['init', 'tilesMerging', 'polygon-parts', 'finalize', 'TilesSeeding'],
  export: ['init', 'tilesExporting', 'polygon-parts', 'finalize'],
} as const;

export const EXCLUDED_TASK_TYPES = {
  ingestion: ['tilesMerging', 'TilesSeeding'],
  export: ['tilesExporting'],
} as const;

export const SUSPENDING_TASK_TYPES = ['polygon-parts'] as const;

// Block duplication types (derived from business logic)
export const BLOCK_DUPLICATION_TYPES = ['init'] as const;
