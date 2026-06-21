import { type Response, agent } from 'supertest';

export class DocsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getDocs(): Promise<Response> {
    return agent(this.app).get('/docs/api/');
  }

  public async getDocsJson(): Promise<Response> {
    return agent(this.app).get('/docs/api.json');
  }
}
