import { readPackageJsonSync } from '@map-colonies/read-pkg';
import config from 'config';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';
export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];
export const JOB_COMPLETED_MESSAGE = 'Job completed successfully';

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METER: Symbol('Meter'),
  QUEUE_CLIENT: Symbol('QueueClient'),
} satisfies Record<string, symbol>;
/* eslint-enable @typescript-eslint/naming-convention */

/* eslint-disable @typescript-eslint/naming-convention */
export const HANDLERS = {
  INGESTION: config.get<string>('jobDefinitions.jobs.new.type'), EXPORT: config.get<string>('jobDefinitions.jobs.export.type'),
} satisfies Record<string, string>;
/* eslint-enable @typescript-eslint/naming-convention */