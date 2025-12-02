type ValueOf<T> = T[keyof T];
export type JobType = ValueOf<IJobDefinitionsConfig['jobs']>;
export type TaskType = ValueOf<IJobDefinitionsConfig['tasks']>;
export type TaskTypes = TaskType[];
export type JobAndTask = `${JobType}_${TaskType}`;
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
    mergeTaskCreation: string;
    merge: string;
    validation: string;
    init: string;
    export: string;
    seed: string;
  };
  suspendingTaskTypes: string[];
}

export interface TaskNotificationRequest {
  taskId: string;
}

export interface IsProceedableResponse {
  result: boolean;
  reason?: string;
}
