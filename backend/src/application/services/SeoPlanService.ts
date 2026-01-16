/**
 * SeoPlanService - Business logic for SEO plans
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 */

import { SeoPlan, PlanStatus } from '../../domain/index';
import { ISeoPlanRepository } from '../../domain/repositories/index';
import { TaskPlannerService } from './TaskPlannerService';
import { Logger } from '../../shared/Logger';

export class SeoPlanService {
  private readonly logger: Logger;

  constructor(
    private readonly planRepository: ISeoPlanRepository,
    private readonly taskPlanner: TaskPlannerService,
    logger?: Logger
  ) {
    this.logger = logger || new Logger('SeoPlanService');
  }

  /**
   * Get plan by ID with full task details
   */
  async getPlan(id: string): Promise<SeoPlan | null> {
    return this.planRepository.findById(id);
  }

  /**
   * Get plans for a specific goal
   */
  async getPlansByGoal(goalId: string): Promise<SeoPlan[]> {
    return this.planRepository.findByGoalId(goalId);
  }

  /**
   * List all plans with pagination
   */
  async listPlans(options?: {
    limit?: number;
    offset?: number;
    status?: PlanStatus;
  }): Promise<SeoPlan[]> {
    return this.planRepository.findAll({
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      status: options?.status,
    });
  }

  /**
   * Get plan progress and statistics
   */
  async getPlanProgress(id: string): Promise<{
    plan: SeoPlan | null;
    progress: {
      total: number;
      completed: number;
      failed: number;
      pending: number;
      running: number;
      progress: number;
    };
  }> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      return { plan: null, progress: { total: 0, completed: 0, failed: 0, pending: 0, running: 0, progress: 0 } };
    }

    const progress = await this.taskPlanner.calculateProgress(id);
    return { plan, progress };
  }

  /**
   * Pause a running plan
   */
  async pausePlan(id: string): Promise<SeoPlan> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== PlanStatus.ACTIVE) {
      throw new Error(`Cannot pause plan with status: ${plan.status}`);
    }

    this.logger.info(`Pausing plan: ${id}`);
    return this.planRepository.update(id, { status: PlanStatus.PAUSED });
  }

  /**
   * Resume a paused plan
   */
  async resumePlan(id: string): Promise<SeoPlan> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== PlanStatus.PAUSED) {
      throw new Error(`Cannot resume plan with status: ${plan.status}`);
    }

    this.logger.info(`Resuming plan: ${id}`);
    return this.planRepository.update(id, { status: PlanStatus.ACTIVE });
  }

  /**
   * Get executable tasks for a plan
   */
  async getExecutableTasks(planId: string) {
    return this.taskPlanner.getExecutableTasks(planId);
  }
}
