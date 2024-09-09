import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { JobsController } from '../controllers/jobsController';

const jobsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(JobsController);

  router.get('/', controller.getResource);
  router.post('/', controller.createResource);

  return router;
};

export const JOBS_ROUTER_SYMBOL = Symbol('jobsRouterFactory');

export { jobsRouterFactory };
