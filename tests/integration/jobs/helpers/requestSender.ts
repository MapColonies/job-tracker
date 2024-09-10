import * as supertest from 'supertest';

export class JobsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getResource(): Promise<supertest.Response> {
    return supertest.agent(this.app).get('/jobs').set('Content-Type', 'application/json');
  }

  public async createResource(): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/jobs').set('Content-Type', 'application/json');
  }
}
