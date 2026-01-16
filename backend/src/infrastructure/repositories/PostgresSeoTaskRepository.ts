/**
 * PostgreSQL Repository for SeoTask
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Clean Architecture
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import {
  SeoTask,
  CreateSeoTaskInput,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '../../domain/entities/SeoTask';
import { ISeoTaskRepository } from '../../domain/repositories/ISeoTaskRepository';
import { Logger } from '../../shared/Logger';
import { DatabaseError } from '../../shared/errors';

interface TaskRow {
  id: string;
  plan_id: string;
  type: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  input: unknown;
  output: unknown | null;
  dependencies: unknown;
  retry_count: number;
  max_retries: number;
  timeout_ms: number;
  assigned_agent: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export class PostgresSeoTaskRepository implements ISeoTaskRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresSeoTaskRepository');
  }

  async create(input: CreateSeoTaskInput): Promise<SeoTask> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO seo_tasks (
        id, plan_id, type, name, description, status, priority, 
        input, dependencies, retry_count, max_retries, timeout_ms, 
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      id,
      input.planId,
      input.type,
      input.name,
      input.description,
      TaskStatus.PENDING,
      input.priority || TaskPriority.MEDIUM,
      JSON.stringify(input.input),
      JSON.stringify(input.dependencies || []),
      0,
      input.maxRetries || 3,
      input.timeoutMs || 120000,
      now,
      now,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapRowToTask(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to create task', { error });
      throw new DatabaseError('Failed to create SEO task');
    }
  }

  async createMany(inputs: CreateSeoTaskInput[]): Promise<SeoTask[]> {
    const client = await this.pool.connect();
    const tasks: SeoTask[] = [];

    try {
      await client.query('BEGIN');

      for (const input of inputs) {
        const id = uuidv4();
        const now = new Date();

        const query = `
          INSERT INTO seo_tasks (
            id, plan_id, type, name, description, status, priority, 
            input, dependencies, retry_count, max_retries, timeout_ms, 
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `;

        const values = [
          id,
          input.planId,
          input.type,
          input.name,
          input.description,
          TaskStatus.PENDING,
          input.priority || TaskPriority.MEDIUM,
          JSON.stringify(input.input),
          JSON.stringify(input.dependencies || []),
          0,
          input.maxRetries || 3,
          input.timeoutMs || 120000,
          now,
          now,
        ];

        const result = await client.query(query, values);
        tasks.push(this.mapRowToTask(result.rows[0]));
      }

      await client.query('COMMIT');
      return tasks;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create tasks', { error });
      throw new DatabaseError('Failed to create SEO tasks');
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<SeoTask | null> {
    const query = 'SELECT * FROM seo_tasks WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToTask(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to find task', { id, error });
      throw new DatabaseError('Failed to find SEO task');
    }
  }

  async findByPlanId(planId: string): Promise<SeoTask[]> {
    const query = 'SELECT * FROM seo_tasks WHERE plan_id = $1 ORDER BY created_at';

    try {
      const result = await this.pool.query(query, [planId]);
      return result.rows.map((row) => this.mapRowToTask(row));
    } catch (error) {
      this.logger.error('Failed to find tasks by plan', { planId, error });
      throw new DatabaseError('Failed to find SEO tasks');
    }
  }

  async findPendingTasks(limit?: number): Promise<SeoTask[]> {
    let query = `SELECT * FROM seo_tasks WHERE status = $1 ORDER BY priority DESC, created_at`;
    const values: unknown[] = [TaskStatus.PENDING];

    if (limit) {
      query += ' LIMIT $2';
      values.push(limit);
    }

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map((row) => this.mapRowToTask(row));
    } catch (error) {
      this.logger.error('Failed to find pending tasks', { error });
      throw new DatabaseError('Failed to find pending SEO tasks');
    }
  }

  async findByStatus(status: TaskStatus, limit?: number): Promise<SeoTask[]> {
    let query = `SELECT * FROM seo_tasks WHERE status = $1 ORDER BY priority DESC, created_at`;
    const values: unknown[] = [status];

    if (limit) {
      query += ' LIMIT $2';
      values.push(limit);
    }

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map((row) => this.mapRowToTask(row));
    } catch (error) {
      this.logger.error('Failed to find tasks by status', { status, error });
      throw new DatabaseError('Failed to find SEO tasks');
    }
  }

  async update(id: string, data: Partial<SeoTask>): Promise<SeoTask> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    if (data.output !== undefined) {
      updates.push(`output = $${paramIndex}`);
      values.push(JSON.stringify(data.output));
      paramIndex++;
    }

    if (data.assignedAgent !== undefined) {
      updates.push(`assigned_agent = $${paramIndex}`);
      values.push(data.assignedAgent);
      paramIndex++;
    }

    if (data.retryCount !== undefined) {
      updates.push(`retry_count = $${paramIndex}`);
      values.push(data.retryCount);
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

    if (data.dependencies !== undefined) {
      updates.push(`dependencies = $${paramIndex}`);
      values.push(JSON.stringify(data.dependencies));
      paramIndex++;
    }

    updates.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE seo_tasks 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        throw new DatabaseError(`Task not found: ${id}`);
      }
      return this.mapRowToTask(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to update task', { id, error });
      throw new DatabaseError('Failed to update SEO task');
    }
  }

  async updateStatus(id: string, status: TaskStatus): Promise<SeoTask> {
    return this.update(id, { status });
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM seo_tasks WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      this.logger.error('Failed to delete task', { id, error });
      throw new DatabaseError('Failed to delete SEO task');
    }
  }

  private mapRowToTask(row: TaskRow): SeoTask {
    return {
      id: row.id,
      planId: row.plan_id,
      type: row.type as TaskType,
      name: row.name,
      description: row.description,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : undefined,
      dependencies: typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies || [],
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      timeoutMs: row.timeout_ms,
      assignedAgent: row.assigned_agent || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }
}
