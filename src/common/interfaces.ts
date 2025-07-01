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
    seed: string;
  };
  tasks: {
    polygonParts: string;
    finalize: string;
    merge: string;
    init: string;
    export: string;
    seed: string;
  };
  suspendingTaskTypes: string[];
}

export interface TaskNotificationRequest {
  taskId: string;
}

export interface IJobHandler {
  handleInitTask: (taskId: string) => Promise<void>;
  handleFinalizeTask: (taskId: string) => Promise<void>;
  handlePolygonTask: (taskId: string) => Promise<void>;
  handleWorkTask: (taskId: string) => Promise<void>;
  handleFailedTask: (taskId: string) => Promise<void>;
}
