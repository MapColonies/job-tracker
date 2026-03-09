import { type Response, agent } from 'supertest';

export class TasksRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async handleTaskNotification(taskId: string): Promise<Response> {
    return agent(this.app).post(`/tasks/${taskId}/notify`).set('Content-Type', 'application/json');
  }
}
