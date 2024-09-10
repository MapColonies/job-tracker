import jsLogger from '@map-colonies/js-logger';
import { JobsManager } from '../../../../src/jobs/models/jobsManager';

let jobsManager: JobsManager;

describe('JobsManager', () => {
  beforeEach(function () {
    jobsManager = new JobsManager(jsLogger({ enabled: false }));
  });
});
