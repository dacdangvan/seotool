/**
 * Crawl Job Service - Manages crawl job lifecycle
 */
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  CrawlJob,
  CrawlJobConfig,
  CrawlProgressUpdate,
  CrawlQueueItem,
  CrawlResultSummary,
  CrawlStatus,
  CrawlTriggerType,
  LogLevel,
  DEFAULT_CRAWL_CONFIG,
} from '../types.js';

export class CrawlJobService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get active crawl job for project
   */
  async getActiveCrawlJob(projectId: string): Promise<CrawlJob | null> {
    const result = await this.pool.query(
      `SELECT * FROM crawl_jobs 
       WHERE project_id = $1 AND status IN ('pending', 'running')
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    return result.rows.length > 0 ? this.mapCrawlJobRow(result.rows[0]) : null;
  }

  /**
   * Get crawl job by ID
   */
  async getCrawlJob(jobId: string): Promise<CrawlJob | null> {
    const result = await this.pool.query(
      `SELECT * FROM crawl_jobs WHERE id = $1`,
      [jobId]
    );
    return result.rows.length > 0 ? this.mapCrawlJobRow(result.rows[0]) : null;
  }

  /**
   * Create a new crawl job
   */
  async createCrawlJob(input: {
    projectId: string;
    config?: Partial<CrawlJobConfig>;
    triggeredBy?: CrawlTriggerType;
  }): Promise<CrawlJob> {
    const id = uuidv4();
    const config = { ...DEFAULT_CRAWL_CONFIG, ...input.config };
    const triggeredBy = input.triggeredBy || 'manual';

    const result = await this.pool.query(
      `INSERT INTO crawl_jobs (
        id, project_id, config, status, progress, 
        total_urls_discovered, crawled_pages, failed_pages, skipped_pages,
        triggered_by, created_at, updated_at
      ) VALUES ($1, $2, $3, 'pending', 0, 0, 0, 0, 0, $4, NOW(), NOW())
      RETURNING *`,
      [id, input.projectId, JSON.stringify(config), triggeredBy]
    );

    return this.mapCrawlJobRow(result.rows[0]);
  }

  /**
   * Start a crawl job
   */
  async startCrawlJob(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId]
    );
    
    // Update project status
    const job = await this.getCrawlJob(jobId);
    if (job) {
      await this.pool.query(
        `UPDATE projects SET crawl_status = 'running', crawl_progress = 0, updated_at = NOW() WHERE id = $1`,
        [job.projectId]
      );
    }
  }

  /**
   * Update crawl progress
   */
  async updateProgress(update: CrawlProgressUpdate): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_jobs SET 
        progress = $2, crawled_pages = $3, failed_pages = $4, 
        skipped_pages = $5, total_urls_discovered = $6, updated_at = NOW()
       WHERE id = $1`,
      [update.jobId, update.progress, update.crawledPages, update.failedPages, 
       update.skippedPages, update.totalUrlsDiscovered]
    );

    // Update project progress
    const job = await this.getCrawlJob(update.jobId);
    if (job) {
      await this.pool.query(
        `UPDATE projects SET crawl_progress = $2, updated_at = NOW() WHERE id = $1`,
        [job.projectId, update.progress]
      );
    }
  }

  /**
   * Complete a crawl job
   */
  async completeCrawlJob(jobId: string, summary: CrawlResultSummary): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_jobs SET 
        status = 'completed', progress = 100,
        crawled_pages = $2, failed_pages = $3, skipped_pages = $4,
        completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [jobId, summary.successfulPages, summary.failedPages, summary.skippedPages]
    );

    // Update project
    const job = await this.getCrawlJob(jobId);
    if (job) {
      await this.pool.query(
        `UPDATE projects SET 
          crawl_status = 'completed', crawl_progress = 100, 
          last_crawl_at = NOW(), last_crawl_job_id = $2, crawl_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [job.projectId, jobId]
      );
    }
  }

  /**
   * Fail a crawl job
   */
  async failCrawlJob(jobId: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_jobs SET status = 'failed', error_message = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId, errorMessage]
    );

    const job = await this.getCrawlJob(jobId);
    if (job) {
      await this.pool.query(
        `UPDATE projects SET crawl_status = 'failed', crawl_error = $2, updated_at = NOW() WHERE id = $1`,
        [job.projectId, errorMessage]
      );
    }
  }

  /**
   * Add log entry
   */
  async addJobLog(jobId: string, level: LogLevel, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO crawl_job_logs (id, job_id, level, message, metadata, timestamp) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), jobId, level, message, metadata ? JSON.stringify(metadata) : null]
    );
  }

  /**
   * Add job to queue
   */
  async addToQueue(projectId: string, jobId: string, options?: { priority?: number }): Promise<void> {
    await this.pool.query(
      `INSERT INTO crawl_queue (id, project_id, job_id, priority, status, scheduled_for, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())`,
      [uuidv4(), projectId, jobId, options?.priority || 10]
    );
  }

  /**
   * Get next pending queue item
   */
  async getNextQueueItem(): Promise<CrawlQueueItem | null> {
    const result = await this.pool.query(
      `SELECT * FROM crawl_queue 
       WHERE status = 'pending' AND scheduled_for <= NOW()
       ORDER BY priority DESC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );
    
    if (result.rows.length === 0) return null;
    
    const item = result.rows[0];
    return {
      id: item.id,
      projectId: item.project_id,
      jobId: item.job_id,
      priority: item.priority,
      status: item.status,
      scheduledFor: item.scheduled_for,
      startedAt: item.started_at,
      createdAt: item.created_at,
    };
  }

  /**
   * Mark queue item as processing
   */
  async markQueueItemProcessing(itemId: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [itemId]
    );
  }

  /**
   * Mark queue item as completed
   */
  async markQueueItemCompleted(itemId: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_queue SET status = 'completed' WHERE id = $1`,
      [itemId]
    );
  }

  /**
   * Mark queue item as failed
   */
  async markQueueItemFailed(itemId: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_queue SET status = 'failed' WHERE id = $1`,
      [itemId]
    );
  }

  /**
   * Map database row to CrawlJob
   */
  private mapCrawlJobRow(row: any): CrawlJob {
    return {
      id: row.id,
      projectId: row.project_id,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      status: row.status,
      progress: row.progress,
      totalUrlsDiscovered: row.total_urls_discovered,
      crawledPages: row.crawled_pages,
      failedPages: row.failed_pages,
      skippedPages: row.skipped_pages,
      triggeredBy: row.triggered_by,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
