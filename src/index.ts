// this import must be called before the first import of tsyringe
import 'reflect-metadata';
import { createServer } from 'http';
import { createTerminus } from '@godaddy/terminus';
import type { Logger } from '@map-colonies/js-logger';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';
import { getApp } from './app';
import type { ConfigType } from './common/config';

const [app, container] = getApp();

const logger = container.resolve<Logger>(SERVICES.LOGGER);
const config = container.resolve<ConfigType>(SERVICES.CONFIG);
const serverConfig = config.get('server');
const port: number = (serverConfig as { port: number }).port || DEFAULT_SERVER_PORT;

const stubHealthCheck = async (): Promise<void> => Promise.resolve();
const server = createTerminus(createServer(app), { healthChecks: { '/liveness': stubHealthCheck, onSignal: container.resolve('onSignal') } });

server.listen(port, () => {
  logger.info(`app started on port ${port}`);
});
