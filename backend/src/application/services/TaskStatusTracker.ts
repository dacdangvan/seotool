/**
 * TaskStatusTracker - Track and update task execution status
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 */

import {
  SeoTask,
  TaskStatus,
  TaskOutput,
  SeoPlan,
  PlanStatus,
} from '../../domain/index';
import { ISeoTaskRepository, ISeoPlanRepository } from '../../domain/repositories/index';
import { Logger } from '../../shared/Logger';

export interface TaskStatusUpdate {
  taskId: string;
  status: TaskStatus;
  output?: TaskOutput;
  error?: string;
}

export class TaskStatusTracker {
  private readonly logger: Logger;

  constructor(
    private readonly taskRepository: ISeoTaskRepository,
    private readonly planRepository: ISeoPlanRepository,
    logger?: Logger
  ) {
    this.logger = logger || new Logger('TaskStatusTracker');
  }

  /**
   * Update task status and handle state transitions
   */
  async updateTaskStatus(update: TaskStatusUpdate): Promise<SeoTask> {
    const { taskId, status, output, error } = update;

    this.logger.info(`Updating task ${taskId} status to ${status}`);

    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Validate state transition
    this.validateTransition(task.status, status);

    // Prepare update data
    const updateData: Partial<SeoTask> = {
      status,
      updatedAt: new Date(),
    };

    if (status === TaskStatus.RUNNING) {
      updateData.startedAt = new Date();
    }

    if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    if (output) {
      updateData.output = output;
    }

    if (error && status === TaskStatus.FAILED) {
      updateData.output = {
        success: false,
        error,
      };
    }

    if (status === TaskStatus.RETRYING) {
      updateData.retryCount = task.retryCount + 1;
    }

    const updatedTask = await this.taskRepository.update(taskId, updateData);

    // Update plan status if needed
    await this.updatePlanStatusIfNeeded(task.planId);

    return updatedTask;
  }

  /**
   * Mark task as started
   */
  async startTask(taskId: string, agentName: string): Promise<SeoTask> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return this.taskRepository.update(taskId, {
      status: TaskStatus.RUNNING,
      startedAt: new Date(),
      assignedAgent: agentName,
      updatedAt: new Date(),
    });
  }

  /**
   * Mark task as completed with output
   */
  async completeTask(taskId: string, output: TaskOutput): Promise<SeoTask> {
    return this.updateTaskStatus({
      taskId,
      status: TaskStatus.COMPLETED,
      output,
    });
  }

  /**
   * Mark task as failed
   */
  async failTask(taskId: string, error: string): Promise<SeoTask> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Check if we should retry
    if (task.retryCount < task.maxRetries) {
      this.logger.info(`Task ${taskId} will be retried (${task.retryCount + 1}/${task.maxRetries})`);
      return this.updateTaskStatus({
        taskId,
        status: TaskStatus.RETRYING,
        error,
      });
    }

    return this.updateTaskStatus({
      taskId,
      status: TaskStatus.FAILED,
      error,
    });
  }

  /**
   * Validate task status transition
   */
  private validateTransition(from: TaskStatus, to: TaskStatus): void {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.PENDING]: [TaskStatus.QUEUED, TaskStatus.CANCELLED],
      [TaskStatus.QUEUED]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
      [TaskStatus.RUNNING]: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED],
      [TaskStatus.RETRYING]: [TaskStatus.QUEUED, TaskStatus.FAILED, TaskStatus.CANCELLED],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.FAILED]: [TaskStatus.RETRYING, TaskStatus.QUEUED], // Allow retry
      [TaskStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[from] || [];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid task status transition: ${from} -> ${to}`);
    }
  }

  /**
   * Update plan status based on task statuses
   */
  private async updatePlanStatusIfNeeded(planId: string): Promise<void> {
    const tasks = await this.taskRepository.findByPlanId(planId);
    const plan = await this.planRepository.findById(planId);

    if (!plan) {
      this.logger.warn(`Plan not found: ${planId}`);
      return;
    }

    const allCompleted = tasks.every((t) => t.status === TaskStatus.COMPLETED);
    const anyFailed = tasks.some((t) => t.status === TaskStatus.FAILED);
    const anyRunning = tasks.some((t) => t.status === TaskStatus.RUNNING);

    let newStatus = plan.status;

    if (allCompleted) {
      newStatus = PlanStatus.COMPLETED;
    } else if (anyFailed && !anyRunning) {
      newStatus = PlanStatus.FAILED;
    } else if (anyRunning && plan.status === PlanStatus.DRAFT) {
      newStatus = PlanStatus.ACTIVE;
    }

    if (newStatus !== plan.status) {
      this.logger.info(`Updating plan ${planId} status: ${plan.status} -> ${newStatus}`);
      await this.planRepository.update(planId, {
        status: newStatus,
        completedAt: newStatus === PlanStatus.COMPLETED ? new Date() : undefined,
        metadata: {
          ...plan.metadata,
          completedTasks: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
          failedTasks: tasks.filter((t) => t.status === TaskStatus.FAILED).length,
        },
      });
    }
  }

  /**
   * Get task execution summary for a plan
   */
  async getPlanSummary(planId: string): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    avgExecutionTimeMs: number;
  }> {
    const tasks = await this.taskRepository.findByPlanId(planId);

    const byStatus = {} as Record<TaskStatus, number>;
    let totalExecutionTime = 0;
    let completedCount = 0;

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;

      if (task.status === TaskStatus.COMPLETED && task.startedAt && task.completedAt) {
        totalExecutionTime += task.completedAt.getTime() - task.startedAt.getTime();
        completedCount++;
      }
    }

    return {
      total: tasks.length,
      byStatus,
      avgExecutionTimeMs: completedCount > 0 ? totalExecutionTime / completedCount : 0,
    };
  }
}
