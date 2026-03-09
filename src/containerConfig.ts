import { getOtelMixin } from '@map-colonies/tracing-utils';
import { TaskHandler as QueueClient } from '@map-colonies/mc-priority-queue';
import { IHttpRetryConfig } from '@map-colonies/mc-utils';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger from '@map-colonies/js-logger';
import type { Logger } from '@map-colonies/js-logger';
import { Registry } from 'prom-client';
import { instancePerContainerCachingFactory } from 'tsyringe';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { getTracing } from './common/tracing';
import { tasksRouterFactory, TASKS_ROUTER_SYMBOL } from './tasks/routes/tasksRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { IJobManagerConfig } from './common/interfaces';
import { getConfig } from './common/config';
import type { ConfigType } from './common/config';

export const queueClientFactory = (container: DependencyContainer): QueueClient => {
  const logger = container.resolve<Logger>(SERVICES.LOGGER);
  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  const queueConfig = config.get('jobManagement.config') as unknown as IJobManagerConfig;
  const httpRetryConfig = config.get('httpRetry') as IHttpRetryConfig;
  return new QueueClient(
    logger,
    queueConfig.jobManagerBaseUrl,
    queueConfig.heartbeat.baseUrl,
    queueConfig.dequeueIntervalMs,
    queueConfig.heartbeat.intervalMs,
    httpRetryConfig
  );
};

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const configInstance = getConfig();

  const loggerConfig = configInstance.get('telemetry.logger');

  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  const tracer = trace.getTracer(SERVICE_NAME);
  const metricsRegistry = new Registry();

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METRICS, provider: { useValue: metricsRegistry } },
    { token: SERVICES.QUEUE_CLIENT, provider: { useFactory: instancePerContainerCachingFactory(queueClientFactory) } },
    { token: TASKS_ROUTER_SYMBOL, provider: { useFactory: tasksRouterFactory } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([getTracing().stop()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
