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
  updateJobProgress: () => Promise<void>;

  /**
   * Check if all tasks in the job are completed
   */
  isAllTasksCompleted: () => boolean;
}
