/**
 * Content Repository
 * 
 * PostgreSQL persistence for generated content.
 * Uses existing schema from database migrations.
 */

import { Pool } from 'pg';
import type {
  StoredContent,
  ContentStatus,
  ArticleOutline,
  SeoMetadata,
  FaqSchema,
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

// Default values for mapping from simplified DB schema
const defaultOutline: ArticleOutline = { h1: '', sections: [] };
const defaultFaqSchema: FaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [],
};

// Map internal status to DB status
function toDbStatus(status: ContentStatus): string {
  switch (status) {
    case 'completed': return 'DRAFT';
    case 'pending': return 'PENDING_REVIEW';
    case 'generating': return 'DRAFT';
    case 'failed': return 'REJECTED';
    default: return 'DRAFT';
  }
}

// Map DB status to internal status
function fromDbStatus(status: string): ContentStatus {
  switch (status?.toUpperCase()) {
    case 'DRAFT': return 'completed' as ContentStatus;
    case 'PENDING_REVIEW': return 'pending' as ContentStatus;
    case 'APPROVED': return 'completed' as ContentStatus;
    case 'REJECTED': return 'failed' as ContentStatus;
    case 'PUBLISHED': return 'completed' as ContentStatus;
    default: return 'pending' as ContentStatus;
  }
}

export class PostgresContentRepository implements ContentRepository {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      logger.info('Database connection verified');
    } finally {
      client.release();
    }
  }

  async save(content: StoredContent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO generated_content (
          id, project_id, brief_id, title, content_markdown, 
          content_html, meta_title, meta_description,
          word_count, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          content_markdown = EXCLUDED.content_markdown,
          content_html = EXCLUDED.content_html,
          meta_title = EXCLUDED.meta_title,
          meta_description = EXCLUDED.meta_description,
          word_count = EXCLUDED.word_count,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at`,
        [
          content.id,
          content.planId,
          content.taskId,
          content.primaryKeyword,
          content.markdownContent,
          content.htmlContent || null,
          content.seoMetadata?.metaTitle || content.primaryKeyword,
          content.seoMetadata?.metaDescription || '',
          content.wordCount,
          toDbStatus(content.status),
          content.createdAt,
          content.updatedAt,
        ]
      );
      logger.info('Content saved', { id: content.id });
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
      if (result.rows.length === 0) return null;
      return this.mapRowToContent(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByTaskId(taskId: string): Promise<StoredContent | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM generated_content WHERE brief_id = $1',
        [taskId]
      );
      if (result.rows.length === 0) return null;
      return this.mapRowToContent(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByPlanId(planId: string): Promise<StoredContent[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM generated_content WHERE project_id = $1 ORDER BY created_at DESC',
        [planId]
      );
      return result.rows.map((row) => this.mapRowToContent(row));
    } finally {
      client.release();
    }
  }

  async updateStatus(id: string, status: ContentStatus): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE generated_content SET status = $1, updated_at = NOW() WHERE id = $2',
        [toDbStatus(status), id]
      );
      logger.debug('Content status updated', { id, status });
    } finally {
      client.release();
    }
  }

  private mapRowToContent(row: any): StoredContent {
    const seoMetadata: SeoMetadata = {
      metaTitle: row.meta_title || row.title,
      metaDescription: row.meta_description || '',
    };

    return {
      id: row.id,
      taskId: row.brief_id,
      planId: row.project_id,
      primaryKeyword: row.title,
      outline: defaultOutline,
      markdownContent: row.content_markdown || '',
      htmlContent: row.content_html,
      seoMetadata,
      faqSchema: defaultFaqSchema,
      wordCount: row.word_count || 0,
      status: fromDbStatus(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export class InMemoryContentRepository implements ContentRepository {
  private contents: Map<string, StoredContent> = new Map();

  async save(content: StoredContent): Promise<void> {
    this.contents.set(content.id, content);
  }

  async findById(id: string): Promise<StoredContent | null> {
    return this.contents.get(id) || null;
  }

  async findByTaskId(taskId: string): Promise<StoredContent | null> {
    for (const content of this.contents.values()) {
      if (content.taskId === taskId) return content;
    }
    return null;
  }

  async findByPlanId(planId: string): Promise<StoredContent[]> {
    const results: StoredContent[] = [];
    for (const content of this.contents.values()) {
      if (content.planId === planId) results.push(content);
    }
    return results;
  }

  async updateStatus(id: string, status: ContentStatus): Promise<void> {
    const content = this.contents.get(id);
    if (content) {
      content.status = status;
      content.updatedAt = new Date();
    }
  }
}
