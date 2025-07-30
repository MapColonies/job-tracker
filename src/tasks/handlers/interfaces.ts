/**
 * Interface for handling job-level operations
 */
export interface IJobHandler {
  /**
   * Complete the job successfully
   */
  completeJob: () => Promise<void>;

  /**
   * Fail the job with an optional reason
   */
  failJob: (reason?: string) => Promise<void>;

  /**
   * Suspend the job with an optional reason
   */
  suspendJob: (reason?: string) => Promise<void>;

  /**
   * Update job progress percentage
   */
  updateJobProgress: (percentage: number) => Promise<void>;

  /**
   * Update job progress after a new task is created
   */
  updateJobForHavingNewTask: (taskType: string) => Promise<void>;

  /**
   * Check if all tasks in the job are completed
   */
  isAllTasksCompleted: () => boolean;
}

/**
 * Interface for handling task-level operations
 */
export interface ITaskHandler {
  /**
   * Handle a completed task notification
   */
  handleTaskCompletion: () => Promise<void>;

  /**
   * Handle a failed task
   */
  handleTaskFailure: () => Promise<void>;

  /**
   * Create the next task in the workflow
   */
  createNextTask: (taskType: string) => Promise<void>;

  /**
   * Check if the workflow can proceed to the next task
   */
  canProceedToNextTask: () => Promise<boolean>;

  /**
   * Get the next task type in the workflow
   */
  getNextTaskType: () => string | undefined;

  /**
   * Check if task creation should be skipped for a given task type
   */
  shouldSkipTaskCreation: (taskType: string) => boolean;

  /**
   * Get task parameters for a specific job and task type combination
   */
  getTaskParameters: (jobType: string, taskType: string) => unknown;
}

/**
 * Interface for workflow orchestration combining job and task operations
 */
export interface IWorkflowHandler {
  /**
   * Handle a completed task notification and orchestrate the workflow
   */
  handleCompletedNotification: () => Promise<void>;

  /**
   * Handle a failed task and decide job-level actions
   */
  handleFailedTask: () => Promise<void>;
}

/**
 * Interface for task validation strategies
 */
export interface ITaskValidationStrategy {
  /**
   * Check if the workflow can proceed based on validation rules
   */
  canProceed: () => Promise<boolean>;

  /**
   * Handle failed task with specific validation logic
   */
  handleFailedTask: () => Promise<void>;
}
