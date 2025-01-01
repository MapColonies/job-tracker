export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface IHeartbeatConfig {
  baseUrl: string;
  intervalMs: number;
}

export interface IJobManagerConfig {
  jobManagerBaseUrl: string;
  heartbeat: IHeartbeatConfig;
  dequeueIntervalMs: number;
}

export interface IJobDefinitionsConfig {
  jobs: {
    new: string;
    update: string;
    swapUpdate: string;
    export: string;
  };
  tasks: {
    polygonParts: string;
    finalize: string;
    merge: string;
    init: string;
    export: string;
  };
  suspendingTaskTypes: string[];
}

export interface TaskNotificationRequest {
  taskId: string;
}
