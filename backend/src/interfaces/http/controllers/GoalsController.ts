/**
 * SEO Goals Controller
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 * 
 * RULE: Controllers are thin - no business logic here
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SeoGoalService } from '../../../application/services/SeoGoalService.js';
import {
  CreateGoalRequestSchema,
  CreateGoalRequest,
  ListGoalsQuerySchema,
  ListGoalsQuery,
} from '../schemas.js';
import { Logger } from '../../../shared/Logger.js';
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors.js';
import { SeoGoal } from '../../../domain/entities/SeoGoal.js';

export class GoalsController {
  private readonly logger: Logger;

  constructor(private readonly goalService: SeoGoalService) {
    this.logger = new Logger('GoalsController');
  }

  /**
   * Register routes
   */
  registerRoutes(app: FastifyInstance): void {
    app.post('/seo/goals', this.createGoal.bind(this));
    app.get('/seo/goals', this.listGoals.bind(this));
    app.get('/seo/goals/:id', this.getGoal.bind(this));
  }

  /**
   * POST /seo/goals
   * Create a new SEO goal and generate execution plan
   */
  async createGoal(
    request: FastifyRequest<{ Body: CreateGoalRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    this.logger.info('Creating new SEO goal', { body: request.body });

    try {
      // Validate request body
      const validationResult = CreateGoalRequestSchema.safeParse(request.body);
      if (!validationResult.success) {
        const errors = validationResult.error.flatten();
        throw new ValidationError('Invalid request body', { errors: errors.fieldErrors });
      }

      const input = validationResult.data;

      // Create goal (business logic in service)
      const result = await this.goalService.createGoal({
        type: input.type,
        title: input.title,
        description: input.description,
        targetUrl: input.targetUrl,
        keywords: input.keywords,
        metrics: input.metrics,
        priority: input.priority,
        deadline: input.deadline,
      });

      this.logger.info('SEO goal created successfully', { 
        goalId: result.goal.id, 
        planId: result.planId 
      });

      reply.status(201).send({
        success: true,
        data: {
          goal: this.serializeGoal(result.goal),
          planId: result.planId,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /seo/goals
   * List all SEO goals with pagination
   */
  async listGoals(
    request: FastifyRequest<{ Querystring: ListGoalsQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const validationResult = ListGoalsQuerySchema.safeParse(request.query);
      if (!validationResult.success) {
        throw new ValidationError('Invalid query parameters');
      }

      const query = validationResult.data;
      const goals = await this.goalService.listGoals({
        limit: query.limit,
        offset: query.offset,
        status: query.status,
      });

      reply.send({
        success: true,
        data: {
          goals: goals.map((g: SeoGoal) => this.serializeGoal(g)),
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total: goals.length, // TODO: Get actual total count
          },
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /seo/goals/:id
   * Get a specific SEO goal
   */
  async getGoal(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const goal = await this.goalService.getGoal(id);

      if (!goal) {
        throw new NotFoundError('Goal', id);
      }

      reply.send({
        success: true,
        data: { goal: this.serializeGoal(goal) },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * Serialize goal for API response
   */
  private serializeGoal(goal: SeoGoal) {
    return {
      id: goal.id,
      type: goal.type,
      title: goal.title,
      description: goal.description,
      targetUrl: goal.targetUrl,
      keywords: goal.keywords,
      metrics: goal.metrics,
      priority: goal.priority,
      status: goal.status,
      deadline: goal.deadline?.toISOString(),
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
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
