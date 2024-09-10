import * as supertest from 'supertest';

export class TasksRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async notifyTaskFinished(taskId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/tasks/${taskId}/notify`).set('Content-Type', 'application/json');
  }
}
