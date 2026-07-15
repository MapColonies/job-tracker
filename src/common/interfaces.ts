type ValueOf<T> = T[keyof T];
export type JobType = ValueOf<IJobDefinitionsConfig['jobs']>;
export type TaskType = ValueOf<IJobDefinitionsConfig['tasks']>;
export type TaskTypes = TaskType[];
export type JobAndTask = `${JobType}_${TaskType}`;

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
    deleteLayer: string;
  };
  tasks: {
    polygonParts: string;
    finalize: string;
    createTasks: string;
    merge: string;
    validation: string;
    init: string;
    export: string;
    seed: string;
    tilesDeletion: string;
    delete: string;
    artifactsDeletion: string;
  };
  suspendingTaskTypes: string[];
}

export interface TaskNotificationRequest {
  taskId: string;
}
