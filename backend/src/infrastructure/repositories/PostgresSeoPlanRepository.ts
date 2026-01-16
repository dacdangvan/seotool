/**
 * PostgreSQL Repository for SeoPlan
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Clean Architecture
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import {
  SeoPlan,
  CreateSeoPlanInput,
  PlanStatus,
  PlanMetadata,
} from '../../domain/entities/SeoPlan.js';
import { SeoTask, TaskStatus } from '../../domain/entities/SeoTask.js';
import { ISeoPlanRepository } from '../../domain/repositories/ISeoPlanRepository.js';
import { Logger } from '../../shared/Logger.js';
import { DatabaseError } from '../../shared/errors.js';

interface PlanRow {
  id: string;
  goal_id: string;
  name: string;
  description: string;
  status: string;
  metadata: PlanMetadata;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export class PostgresSeoPlanRepository implements ISeoPlanRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresSeoPlanRepository');
  }

  async create(input: CreateSeoPlanInput): Promise<SeoPlan> {
    const id = uuidv4();
    const now = new Date();

    const metadata: PlanMetadata = {
      estimatedDurationDays: this.estimateDuration(input.tasks),
      totalTasks: input.tasks.length,
      completedTasks: 0,
      failedTasks: 0,
    };

    const query = `
      INSERT INTO seo_plans (id, goal_id, name, description, status, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      input.goalId,
      input.name,
      input.description,
      PlanStatus.DRAFT,
      JSON.stringify(metadata),
      now,
      now,
    ];

    try {
      const result = await this.pool.query(query, values);
      const plan = this.mapRowToPlan(result.rows[0]);
      plan.tasks = input.tasks;
      return plan;
    } catch (error) {
      this.logger.error('Failed to create plan', { error });
      throw new DatabaseError('Failed to create SEO plan');
    }
  }

  async findById(id: string): Promise<SeoPlan | null> {
    const planQuery = 'SELECT * FROM seo_plans WHERE id = $1';
    const tasksQuery = 'SELECT * FROM seo_tasks WHERE plan_id = $1 ORDER BY created_at';

    try {
      const planResult = await this.pool.query(planQuery, [id]);
      if (planResult.rows.length === 0) {
        return null;
      }

      const tasksResult = await this.pool.query(tasksQuery, [id]);
      const plan = this.mapRowToPlan(planResult.rows[0]);
      plan.tasks = tasksResult.rows.map((row) => this.mapRowToTask(row));

      return plan;
    } catch (error) {
      this.logger.error('Failed to find plan', { id, error });
      throw new DatabaseError('Failed to find SEO plan');
    }
  }

  async findByGoalId(goalId: string): Promise<SeoPlan[]> {
    const query = 'SELECT * FROM seo_plans WHERE goal_id = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [goalId]);
      const plans: SeoPlan[] = [];

      for (const row of result.rows) {
        const plan = this.mapRowToPlan(row);
        const tasksResult = await this.pool.query(
          'SELECT * FROM seo_tasks WHERE plan_id = $1 ORDER BY created_at',
          [plan.id]
        );
        plan.tasks = tasksResult.rows.map((r) => this.mapRowToTask(r));
        plans.push(plan);
      }

      return plans;
    } catch (error) {
      this.logger.error('Failed to find plans by goal', { goalId, error });
      throw new DatabaseError('Failed to find SEO plans');
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<SeoPlan[]> {
    let query = 'SELECT * FROM seo_plans';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options?.status) {
      query += ` WHERE status = $${paramIndex}`;
      values.push(options.status);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(options.limit);
      paramIndex++;
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(options.offset);
    }

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map((row) => {
        const plan = this.mapRowToPlan(row);
        plan.tasks = []; // Don't load tasks for list view
        return plan;
      });
    } catch (error) {
      this.logger.error('Failed to list plans', { error });
      throw new DatabaseError('Failed to list SEO plans');
    }
  }

  async update(id: string, data: Partial<SeoPlan>): Promise<SeoPlan> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }

    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(data.metadata));
      paramIndex++;
    }

    if (data.startedAt !== undefined) {
      updates.push(`started_at = $${paramIndex}`);
      values.push(data.startedAt);
      paramIndex++;
    }

    if (data.completedAt !== undefined) {
      updates.push(`completed_at = $${paramIndex}`);
      values.push(data.completedAt);
      paramIndex++;
    }

    updates.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE seo_plans 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        throw new DatabaseError(`Plan not found: ${id}`);
      }

      const plan = this.mapRowToPlan(result.rows[0]);
      const tasksResult = await this.pool.query(
        'SELECT * FROM seo_tasks WHERE plan_id = $1 ORDER BY created_at',
        [id]
      );
      plan.tasks = tasksResult.rows.map((row) => this.mapRowToTask(row));

      return plan;
    } catch (error) {
      this.logger.error('Failed to update plan', { id, error });
      throw new DatabaseError('Failed to update SEO plan');
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM seo_tasks WHERE plan_id = $1', [id]);
      const result = await client.query('DELETE FROM seo_plans WHERE id = $1', [id]);
      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to delete plan', { id, error });
      throw new DatabaseError('Failed to delete SEO plan');
    } finally {
      client.release();
    }
  }

  private estimateDuration(tasks: SeoTask[]): number {
    // Simple estimation: 1 day per 3 tasks
    return Math.max(1, Math.ceil(tasks.length / 3));
  }

  private mapRowToPlan(row: PlanRow): SeoPlan {
    return {
      id: row.id,
      goalId: row.goal_id,
      name: row.name,
      description: row.description,
      status: row.status as PlanStatus,
      tasks: [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }

  private mapRowToTask(row: Record<string, unknown>): SeoTask {
    return {
      id: row.id as string,
      planId: row.plan_id as string,
      type: row.type as SeoTask['type'],
      name: row.name as string,
      description: row.description as string,
      status: row.status as TaskStatus,
      priority: row.priority as SeoTask['priority'],
      input: typeof row.input === 'string' ? JSON.parse(row.input as string) : row.input as SeoTask['input'],
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output as string) : row.output as SeoTask['output']) : undefined,
      dependencies: row.dependencies ? (typeof row.dependencies === 'string' ? JSON.parse(row.dependencies as string) : row.dependencies as SeoTask['dependencies']) : [],
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      timeoutMs: row.timeout_ms as number,
      assignedAgent: row.assigned_agent as string | undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      startedAt: row.started_at as Date | undefined,
      completedAt: row.completed_at as Date | undefined,
    };
  }
}
