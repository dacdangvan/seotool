/**
 * Content Repository
 * 
 * PostgreSQL persistence for generated content.
 */

import { Pool } from 'pg';
import type {
  StoredContent,
  ContentGenerationResult,
  ContentStatus,
} from '../models';
import { Logger } from '../logger';

const logger = new Logger('content-repository');

export interface ContentRepository {
  save(content: StoredContent): Promise<void>;
  findById(id: string): Promise<StoredContent | null>;
  findByTaskId(taskId: string): Promise<StoredContent | null>;
  findByPlanId(planId: string): Promise<StoredContent[]>;
  updateStatus(id: string, status: ContentStatus): Promise<void>;
}

export class PostgresContentRepository implements ContentRepository {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS generated_content (
          id UUID PRIMARY KEY,
          task_id UUID NOT NULL UNIQUE,
          plan_id UUID NOT NULL,
          primary_keyword VARCHAR(255) NOT NULL,
          outline JSONB NOT NULL,
          markdown_content TEXT NOT NULL,
          html_content TEXT,
          seo_metadata JSONB NOT NULL,
          faq_schema JSONB NOT NULL,
          word_count INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_generated_content_task_id ON generated_content(task_id);
        CREATE INDEX IF NOT EXISTS idx_generated_content_plan_id ON generated_content(plan_id);
        CREATE INDEX IF NOT EXISTS idx_generated_content_status ON generated_content(status);
      `);
      logger.info('Database schema initialized');
    } finally {
      client.release();
    }
  }

  async save(content: StoredContent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO generated_content (
          id, task_id, plan_id, primary_keyword, outline, 
          markdown_content, html_content, seo_metadata, faq_schema,
          word_count, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (task_id) DO UPDATE SET
          outline = EXCLUDED.outline,
          markdown_content = EXCLUDED.markdown_content,
          html_content = EXCLUDED.html_content,
          seo_metadata = EXCLUDED.seo_metadata,
          faq_schema = EXCLUDED.faq_schema,
          word_count = EXCLUDED.word_count,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP`,
        [
          content.id,
          content.taskId,
          content.planId,
          content.primaryKeyword,
          JSON.stringify(content.outline),
          content.markdownContent,
          content.htmlContent || null,
          JSON.stringify(content.seoMetadata),
          JSON.stringify(content.faqSchema),
          content.wordCount,
          content.status,
          content.createdAt,
          content.updatedAt,
        ]
      );
      logger.debug('Content saved', { id: content.id, taskId: content.taskId });
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<StoredContent | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM generated_content WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContent(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByTaskId(taskId: string): Promise<StoredContent | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM generated_content WHERE task_id = $1',
        [taskId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContent(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByPlanId(planId: string): Promise<StoredContent[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM generated_content WHERE plan_id = $1 ORDER BY created_at DESC',
        [planId]
      );

      return result.rows.map((row: Record<string, unknown>) => this.mapRowToContent(row));
    } finally {
      client.release();
    }
  }

  async updateStatus(id: string, status: ContentStatus): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE generated_content SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, id]
      );
      logger.debug('Content status updated', { id, status });
    } finally {
      client.release();
    }
  }

  private mapRowToContent(row: Record<string, unknown>): StoredContent {
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      planId: row.plan_id as string,
      primaryKeyword: row.primary_keyword as string,
      outline: row.outline as StoredContent['outline'],
      markdownContent: row.markdown_content as string,
      htmlContent: row.html_content as string | undefined,
      seoMetadata: row.seo_metadata as StoredContent['seoMetadata'],
      faqSchema: row.faq_schema as StoredContent['faqSchema'],
      wordCount: row.word_count as number,
      status: row.status as ContentStatus,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * In-memory repository for testing
 */
export class InMemoryContentRepository implements ContentRepository {
  private storage: Map<string, StoredContent> = new Map();
  private taskIdIndex: Map<string, string> = new Map();

  async save(content: StoredContent): Promise<void> {
    this.storage.set(content.id, content);
    this.taskIdIndex.set(content.taskId, content.id);
  }

  async findById(id: string): Promise<StoredContent | null> {
    return this.storage.get(id) || null;
  }

  async findByTaskId(taskId: string): Promise<StoredContent | null> {
    const id = this.taskIdIndex.get(taskId);
    if (!id) return null;
    return this.storage.get(id) || null;
  }

  async findByPlanId(planId: string): Promise<StoredContent[]> {
    return Array.from(this.storage.values())
      .filter((c) => c.planId === planId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateStatus(id: string, status: ContentStatus): Promise<void> {
    const content = this.storage.get(id);
    if (content) {
      content.status = status;
      content.updatedAt = new Date();
    }
  }

  clear(): void {
    this.storage.clear();
    this.taskIdIndex.clear();
  }
}
