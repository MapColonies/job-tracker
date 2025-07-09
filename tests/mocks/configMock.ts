import config from 'config';
import get from 'lodash.get';
import has from 'lodash.has';
import { IConfig } from '../../src/common/interfaces';

let mockConfig: Record<string, unknown> = {};
const getMock = jest.fn();
const hasMock = jest.fn();

const configMock: IConfig = {
  get: getMock,
  has: hasMock,
};

const init = (): void => {
  getMock.mockImplementation((key: string): unknown => {
    return mockConfig[key] ?? config.get(key);
  });
};

const setValue = (key: string | Record<string, unknown>, value?: unknown): void => {
  if (typeof key === 'string') {
    mockConfig[key] = value;
  } else {
    mockConfig = { ...mockConfig, ...key };
  }
};

const clear = (): void => {
  mockConfig = {};
};

const setConfigValues = (values: Record<string, unknown>): void => {
  getMock.mockImplementation((key: string) => {
    const value: unknown = (get as (object: Record<string, unknown>, path: string) => unknown)(values, key) ?? config.get(key);
    return value;
  });
  hasMock.mockImplementation((key: string) => (has as (object: Record<string, unknown>, path: string) => boolean)(values, key) || config.has(key));
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
      disableHttpClientLogs: true,
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
        export: 'export',
        seed: 'TilesSeeding',
      },
      tasks: {
        init: 'init',
        merge: 'tilesMerging',
        polygonParts: 'polygon-parts',
        finalize: 'finalize',
        export: 'tilesExporting',
        seed: 'TilesSeeding',
      },
      suspendingTaskTypes: ['polygon-parts'],
    },
  };

  setConfigValues(config);
};

export { getMock, hasMock, configMock, setValue, clear, init, setConfigValues, registerDefaultConfig };
