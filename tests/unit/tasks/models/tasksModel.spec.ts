import jsLogger from '@map-colonies/js-logger';
import { TasksManager } from '../../../../src/tasks/models/tasksManager';

let tasksManager: TasksManager;

describe('TasksManager', () => {
  beforeEach(function () {
    tasksManager = new TasksManager(jsLogger({ enabled: false }));
  });
});
