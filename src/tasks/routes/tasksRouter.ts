import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { tasksController } from '../controllers/tasksController';

const tasksRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(tasksController);

  router.post('/:taskId/notify', controller.notifyTaskFinished);

  return router;
};

export const TASKS_ROUTER_SYMBOL = Symbol('tasksRouterFactory');

export { tasksRouterFactory };
