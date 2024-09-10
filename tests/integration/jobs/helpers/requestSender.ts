import * as supertest from 'supertest';

export class JobsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async notifyFinished(jobId: string, taskId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/jobs/${jobId}/${taskId}/notify`).set('Content-Type', 'application/json');
  }
}
