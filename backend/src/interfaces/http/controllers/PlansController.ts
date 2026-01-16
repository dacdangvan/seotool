/**
 * SEO Plans Controller
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 * 
 * RULE: Controllers are thin - no business logic here
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SeoPlanService } from '../../../application/services/SeoPlanService';
import { PlanParamsSchema } from '../schemas';
import { Logger } from '../../../shared/Logger';
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors';
import { SeoPlan } from '../../../domain/entities/SeoPlan';
import { SeoTask } from '../../../domain/entities/SeoTask';

export class PlansController {
  private readonly logger: Logger;

  constructor(private readonly planService: SeoPlanService) {
    this.logger = new Logger('PlansController');
  }

  /**
   * Register routes
   */
  registerRoutes(app: FastifyInstance): void {
    app.get('/seo/plans/:id', this.getPlan.bind(this));
    app.get('/seo/plans/:id/progress', this.getPlanProgress.bind(this));
    app.get('/seo/plans/:id/tasks', this.getPlanTasks.bind(this));
    app.post('/seo/plans/:id/pause', this.pausePlan.bind(this));
    app.post('/seo/plans/:id/resume', this.resumePlan.bind(this));
  }

  /**
   * GET /seo/plans/:id
   * Get a specific SEO plan with all tasks
   */
  async getPlan(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const validationResult = PlanParamsSchema.safeParse(request.params);
      if (!validationResult.success) {
        throw new ValidationError('Invalid plan ID');
      }

      const { id } = validationResult.data;
      const plan = await this.planService.getPlan(id);

      if (!plan) {
        throw new NotFoundError('Plan', id);
      }

      reply.send({
        success: true,
        data: { plan: this.serializePlan(plan) },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /seo/plans/:id/progress
   * Get plan progress and statistics
   */
  async getPlanProgress(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { plan, progress } = await this.planService.getPlanProgress(id);

      if (!plan) {
        throw new NotFoundError('Plan', id);
      }

      reply.send({
        success: true,
        data: {
          planId: id,
          status: plan.status,
          progress,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /seo/plans/:id/tasks
   * Get executable tasks for a plan
   */
  async getPlanTasks(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const plan = await this.planService.getPlan(id);

      if (!plan) {
        throw new NotFoundError('Plan', id);
      }

      const executableTasks = await this.planService.getExecutableTasks(id);

      reply.send({
        success: true,
        data: {
          planId: id,
          allTasks: plan.tasks.map((t: SeoTask) => this.serializeTask(t)),
          executableTasks: executableTasks.map((t: SeoTask) => this.serializeTask(t)),
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * POST /seo/plans/:id/pause
   * Pause a running plan
   */
  async pausePlan(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const plan = await this.planService.pausePlan(id);

      reply.send({
        success: true,
        data: { plan: this.serializePlan(plan) },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * POST /seo/plans/:id/resume
   * Resume a paused plan
   */
  async resumePlan(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const plan = await this.planService.resumePlan(id);

      reply.send({
        success: true,
        data: { plan: this.serializePlan(plan) },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * Serialize plan for API response
   */
  private serializePlan(plan: SeoPlan) {
    return {
      id: plan.id,
      goalId: plan.goalId,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      tasks: plan.tasks.map((t: SeoTask) => this.serializeTask(t)),
      metadata: plan.metadata,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      startedAt: plan.startedAt?.toISOString(),
      completedAt: plan.completedAt?.toISOString(),
    };
  }

  /**
   * Serialize task for API response
   */
  private serializeTask(task: SeoTask) {
    return {
      id: task.id,
      type: task.type,
      name: task.name,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dependencies: task.dependencies,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      assignedAgent: task.assignedAgent,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
    };
  }

  /**
   * Handle errors and send appropriate response
   */
  private handleError(error: unknown, reply: FastifyReply): void {
    if (error instanceof AppError) {
      this.logger.warn('Request error', { 
        code: error.code, 
        message: error.message 
      });
      reply.status(error.statusCode).send(error.toJSON());
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Unexpected error', { error: message });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  }
}
