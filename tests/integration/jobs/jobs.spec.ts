import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';

import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { JobsRequestSender } from './helpers/requestSender';

describe('jobs', function () {
  let requestSender: JobsRequestSender;
  beforeEach(function () {
    const app = getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new JobsRequestSender(app);
  });

  describe('Happy Path', function () {
    // All requests with status code 2XX
  });
  describe('Bad Path', function () {
    // All requests with status code of 400
  });
  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
  });
});
