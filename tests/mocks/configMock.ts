import { get, set } from 'lodash';
import type { ConfigType } from '@src/common/config';

let mockConfig: Record<string, unknown> = {};
const getMock = jest.fn();
const hasMock = jest.fn();

const configMock = {
  get: getMock,
} as unknown as ConfigType;

const init = (): void => {
  getMock.mockImplementation((key: string): unknown => {
    return get(mockConfig, key);
  });
};

const setValue = (key: string | Record<string, unknown>, value?: unknown): void => {
  if (typeof key === 'string') {
    set(mockConfig, key, value);
  } else {
    mockConfig = { ...mockConfig, ...key };
  }
};

const clear = (): void => {
  mockConfig = {};
};

const setConfigValues = (values: Record<string, unknown>): void => {
  getMock.mockImplementation((key: string) => {
    return get(values, key);
  });
};

const registerDefaultConfig = (): void => {
  const config = {
    openapiConfig: {
      filePath: './openapi3.yaml',
      basePath: '/docs',
      rawPath: '/api',
      uiPath: '/api',
    },
    telemetry: {
      logger: {
        level: 'info',
        prettyPrint: false,
      },
    },
    server: {
      port: '8080',
      request: {
        payload: {
          limit: '1mb',
        },
      },
      response: {
        compression: {
          enabled: true,
          options: null,
        },
      },
    },
    httpRetry: {
      attempts: 5,
      delay: 'exponential',
      shouldResetTimeout: true,
    },
    jobManagement: {
      config: {
        jobManagerBaseUrl: 'http://localhost:8081',
        heartbeat: {
          baseUrl: 'http://localhost:8083',
          intervalMs: 3000,
        },
        dequeueIntervalMs: 3000,
      },
    },
    jobDefinitions: {
      jobs: {
        new: 'Ingestion_New',
        update: 'Ingestion_Update',
        swapUpdate: 'Ingestion_Swap_Update',
        export: 'Export',
        seed: 'TilesSeeding',
        deleteLayer: 'Delete_Layer',
      },
      tasks: {
        validation: 'validation',
        createTasks: 'create-tasks',
        init: 'init',
        merge: 'tilesMerging',
        polygonParts: 'polygon-parts',
        finalize: 'finalize',
        export: 'tilesExporting',
        seed: 'TilesSeeding',
        tilesDeletion: 'tiles-deletion',
        delete: 'delete',
        artifactsDeletion: 'artifacts-deletion',
      },
      suspendingTaskTypes: ['validation'],
    },
    taskFlowManager: {
      ingestionTasksFlow: ['validation', 'create-tasks', 'tilesMerging', 'finalize'],
      exportTasksFlow: ['init', 'tilesExporting', 'polygon-parts', 'finalize'],
      seedTasksFlow: ['TilesSeeding'],
      deleteLayerTasksFlow: ['delete', 'tiles-deletion', 'artifacts-deletion', 'finalize'],
    },
  };

  mockConfig = config as unknown as Record<string, unknown>;
  setConfigValues(config);
};

export { getMock, hasMock, configMock, setValue, clear, init, setConfigValues, registerDefaultConfig };
