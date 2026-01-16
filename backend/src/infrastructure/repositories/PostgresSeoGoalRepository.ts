/**
 * PostgreSQL Repository for SeoGoal
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Clean Architecture
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import {
  SeoGoal,
  CreateSeoGoalInput,
  GoalStatus,
  GoalPriority,
  GoalMetrics,
  GoalType,
} from '../../domain/entities/SeoGoal.js';
import { ISeoGoalRepository } from '../../domain/repositories/ISeoGoalRepository.js';
import { Logger } from '../../shared/Logger.js';
import { DatabaseError } from '../../shared/errors.js';

interface GoalRow {
  id: string;
  type: string;
  title: string;
  description: string;
  target_url: string;
  keywords: string[] | null;
  metrics: GoalMetrics;
  priority: string;
  status: string;
  deadline: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class PostgresSeoGoalRepository implements ISeoGoalRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresSeoGoalRepository');
  }

  async create(input: CreateSeoGoalInput): Promise<SeoGoal> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO seo_goals (id, type, title, description, target_url, keywords, metrics, priority, status, deadline, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      id,
      input.type,
      input.title,
      input.description,
      input.targetUrl,
      input.keywords || null,
      JSON.stringify(input.metrics),
      input.priority || GoalPriority.MEDIUM,
      GoalStatus.PENDING,
      input.deadline || null,
      now,
      now,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapRowToGoal(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to create goal', { error });
      throw new DatabaseError('Failed to create SEO goal');
    }
  }

  async findById(id: string): Promise<SeoGoal | null> {
    const query = 'SELECT * FROM seo_goals WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToGoal(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to find goal', { id, error });
      throw new DatabaseError('Failed to find SEO goal');
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<SeoGoal[]> {
    let query = 'SELECT * FROM seo_goals';
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
      return result.rows.map((row) => this.mapRowToGoal(row));
    } catch (error) {
      this.logger.error('Failed to list goals', { error });
      throw new DatabaseError('Failed to list SEO goals');
    }
  }

  async update(id: string, data: Partial<SeoGoal>): Promise<SeoGoal> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(data.title);
      paramIndex++;
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }

    if (data.metrics !== undefined) {
      updates.push(`metrics = $${paramIndex}`);
      values.push(JSON.stringify(data.metrics));
      paramIndex++;
    }

    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      values.push(data.priority);
      paramIndex++;
    }

    updates.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE seo_goals 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        throw new DatabaseError(`Goal not found: ${id}`);
      }
      return this.mapRowToGoal(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to update goal', { id, error });
      throw new DatabaseError('Failed to update SEO goal');
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM seo_goals WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      this.logger.error('Failed to delete goal', { id, error });
      throw new DatabaseError('Failed to delete SEO goal');
    }
  }

  private mapRowToGoal(row: GoalRow): SeoGoal {
    return {
      id: row.id,
      type: row.type as GoalType,
      title: row.title,
      description: row.description,
      targetUrl: row.target_url,
      keywords: row.keywords || undefined,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
      priority: row.priority as GoalPriority,
      status: row.status as GoalStatus,
      deadline: row.deadline || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
