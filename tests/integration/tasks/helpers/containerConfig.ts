import { jsLogger } from '@map-colonies/js-logger';
import { container, instancePerContainerCachingFactory } from 'tsyringe';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import { SERVICES } from '../../../../src/common/constants';
import { InjectionObject } from '../../../../src/common/dependencyRegistration';
import { configMock, getMock, hasMock, registerDefaultConfig } from '../../../mocks/configMock';
import { TASKS_ROUTER_SYMBOL, tasksRouterFactory } from '../../../../src/tasks/routes/tasksRouter';
import { queueClientFactory } from '../../../../src/containerConfig';

async function getTestContainerConfig(): Promise<InjectionObject<unknown>[]> {
  registerDefaultConfig();

  return [
    { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
    { token: SERVICES.CONFIG, provider: { useValue: configMock } },
    { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
    { token: SERVICES.METRICS, provider: { useValue: new Registry() } },
    { token: SERVICES.QUEUE_CLIENT, provider: { useFactory: instancePerContainerCachingFactory(queueClientFactory) } },
    { token: TASKS_ROUTER_SYMBOL, provider: { useFactory: tasksRouterFactory } },
  ];
}

const resetContainer = (clearInstances = true): void => {
  if (clearInstances) {
    container.clearInstances();
  }

  getMock.mockReset();
  hasMock.mockReset();
};

export { getTestContainerConfig, resetContainer };
