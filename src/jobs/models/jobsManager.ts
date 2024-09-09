import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';

const resourceInstance: IJobsModel = {
  id: 1,
  name: 'ronin',
  description: 'can you do a logistics run?',
};

function generateRandomId(): number {
  const rangeOfIds = 100;
  return Math.floor(Math.random() * rangeOfIds);
}
export interface IJobsModel {
  id?: number;
  name: string;
  description: string;
}

@injectable()
export class JobsManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public getResource(): IJobsModel {
    this.logger.info({ msg: 'getting resource', resourceId: resourceInstance.id });

    return resourceInstance;
  }

  public createResource(resource: IJobsModel): IJobsModel {
    const resourceId = generateRandomId();

    this.logger.info({ msg: 'creating resource', resourceId });

    return { id: resourceId, ...resource };
  }
}
