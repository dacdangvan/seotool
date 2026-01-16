/**
 * SeoGoalService - Business logic for SEO goals
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 */

import {
  SeoGoal,
  CreateSeoGoalInput,
  GoalStatus,
  GoalPriority,
} from '../../domain/index.js';
import { ISeoGoalRepository } from '../../domain/repositories/index.js';
import { TaskPlannerService } from './TaskPlannerService.js';
import { Logger } from '../../shared/Logger.js';

export class SeoGoalService {
  private readonly logger: Logger;

  constructor(
    private readonly goalRepository: ISeoGoalRepository,
    private readonly taskPlanner: TaskPlannerService,
    logger?: Logger
  ) {
    this.logger = logger || new Logger('SeoGoalService');
  }

  /**
   * Create a new SEO goal and generate execution plan
   */
  async createGoal(input: CreateSeoGoalInput): Promise<{ goal: SeoGoal; planId: string }> {
    this.logger.info(`Creating SEO goal: ${input.title} (${input.type})`);

    // Validate input
    this.validateGoalInput(input);

    // Create goal with default values
    const goalInput: CreateSeoGoalInput = {
      ...input,
      priority: input.priority || GoalPriority.MEDIUM,
    };

    const goal = await this.goalRepository.create(goalInput);
    this.logger.info(`Goal created: ${goal.id}`);

    // Update status to planning
    await this.goalRepository.update(goal.id, { status: GoalStatus.PLANNING });

    // Create execution plan
    const plan = await this.taskPlanner.createPlan(goal);
    this.logger.info(`Plan created for goal ${goal.id}: ${plan.id}`);

    // Update goal status to in progress
    await this.goalRepository.update(goal.id, { status: GoalStatus.IN_PROGRESS });

    return { goal, planId: plan.id };
  }

  /**
   * Get goal by ID
   */
  async getGoal(id: string): Promise<SeoGoal | null> {
    return this.goalRepository.findById(id);
  }

  /**
   * List all goals with pagination
   */
  async listGoals(options?: {
    limit?: number;
    offset?: number;
    status?: GoalStatus;
  }): Promise<SeoGoal[]> {
    return this.goalRepository.findAll({
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      status: options?.status,
    });
  }

  /**
   * Update goal status
   */
  async updateGoalStatus(id: string, status: GoalStatus): Promise<SeoGoal> {
    const goal = await this.goalRepository.findById(id);
    if (!goal) {
      throw new Error(`Goal not found: ${id}`);
    }

    return this.goalRepository.update(id, { status, updatedAt: new Date() });
  }

  /**
   * Cancel a goal
   */
  async cancelGoal(id: string): Promise<SeoGoal> {
    this.logger.info(`Cancelling goal: ${id}`);
    return this.updateGoalStatus(id, GoalStatus.CANCELLED);
  }

  /**
   * Validate goal input
   */
  private validateGoalInput(input: CreateSeoGoalInput): void {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Goal title is required');
    }

    if (!input.targetUrl || !this.isValidUrl(input.targetUrl)) {
      throw new Error('Valid target URL is required');
    }

    if (!input.metrics || input.metrics.targetValue <= 0) {
      throw new Error('Valid target metrics are required');
    }
  }

  /**
   * Simple URL validation
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
