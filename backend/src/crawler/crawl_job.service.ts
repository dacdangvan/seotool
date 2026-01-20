/**
 * Crawl Job Service
 * 
 * Manages crawl job lifecycle: create, start, update, complete
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * Responsibilities:
 * - Create crawl jobs with idempotent trigger
 * - Ensure no overlapping crawls per project
 * - Track crawl progress and status
 * - Log crawl events
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  CrawlJob,
  CrawlJobConfig,
  CrawlJobLog,
  CrawlProgressUpdate,
  CrawlQueueItem,
  CrawlResultSummary,
  CrawlStatus,
  CrawlTriggerType,
  CreateCrawlJobInput,
  LogLevel,
  ProjectCrawlState,
} from './crawl_job.types';
import { DEFAULT_CRAWL_CONFIG } from './models';

export class CrawlJobService {
  private pool: Pool;
  
  constructor(pool: Pool) {
    this.pool = pool;
  }
  
  // ===========================================================================
  // PROJECT CRAWL STATE
  // ===========================================================================
  
  /**
   * Get project crawl state
   */
  async getProjectCrawlState(projectId: string): Promise<ProjectCrawlState | null> {
    const result = await this.pool.query(
      `SELECT 
        id as "projectId",
        domain,
        crawl_status as "crawlStatus",
        crawl_progress as "crawlProgress",
        last_crawl_at as "lastCrawlAt",
        last_crawl_job_id as "lastCrawlJobId",
        crawl_error as "crawlError",
        crawl_schedule as "crawlSchedule",
        next_scheduled_crawl as "nextScheduledCrawl"
      FROM projects 
      WHERE id = $1`,
      [projectId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }
  
  /**
   * Update project crawl status
   */
  async updateProjectCrawlStatus(
    projectId: string,
    status: CrawlStatus,
    options?: {
      progress?: number;
      lastCrawlJobId?: string;
      crawlError?: string | null;
      lastCrawlAt?: Date;
    }
  ): Promise<void> {
    const updates: string[] = ['crawl_status = $2'];
    const values: unknown[] = [projectId, status];
    let paramIndex = 3;
    
    if (options?.progress !== undefined) {
      updates.push(`crawl_progress = $${paramIndex++}`);
      values.push(options.progress);
    }
    
    if (options?.lastCrawlJobId !== undefined) {
      updates.push(`last_crawl_job_id = $${paramIndex++}`);
      values.push(options.lastCrawlJobId);
    }
    
    if (options?.crawlError !== undefined) {
      updates.push(`crawl_error = $${paramIndex++}`);
      values.push(options.crawlError);
    }
    
    if (options?.lastCrawlAt !== undefined) {
      updates.push(`last_crawl_at = $${paramIndex++}`);
      values.push(options.lastCrawlAt);
    }
    
    await this.pool.query(
      `UPDATE projects SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
      values
    );
  }
  
  // ===========================================================================
  // CRAWL JOB MANAGEMENT
  // ===========================================================================
  
  /**
   * Check if project has active crawl
   */
  async hasActiveCrawl(projectId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT id FROM crawl_jobs 
       WHERE project_id = $1 AND status IN ('pending', 'running')
       LIMIT 1`,
      [projectId]
    );
    return result.rows.length > 0;
  }
  
  /**
   * Get active crawl job for project
   */
  async getActiveCrawlJob(projectId: string): Promise<CrawlJob | null> {
    const result = await this.pool.query(
      `SELECT * FROM crawl_jobs 
       WHERE project_id = $1 AND status IN ('pending', 'running')
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapCrawlJobRow(result.rows[0]);
  }
  
  /**
   * Create a new crawl job (idempotent - returns existing if active)
   */
  async createCrawlJob(input: CreateCrawlJobInput): Promise<CrawlJob> {
    // Check for existing active crawl
    const existingJob = await this.getActiveCrawlJob(input.projectId);
    if (existingJob) {
      console.log(`[CrawlJobService] Returning existing active job ${existingJob.id} for project ${input.projectId}`);
      return existingJob;
    }
    
    // Get project domain
    const projectResult = await this.pool.query(
      'SELECT domain FROM projects WHERE id = $1',
      [input.projectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error(`Project ${input.projectId} not found`);
    }
    
    const domain = projectResult.rows[0].domain;
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    
    // Build config
    const config: CrawlJobConfig = {
      maxPages: input.config?.maxPages ?? DEFAULT_CRAWL_CONFIG.maxPages,
      maxDepth: input.config?.maxDepth ?? DEFAULT_CRAWL_CONFIG.maxDepth,
      requestDelay: input.config?.requestDelay ?? DEFAULT_CRAWL_CONFIG.requestDelay,
      timeout: input.config?.timeout ?? DEFAULT_CRAWL_CONFIG.timeout,
      userAgent: input.config?.userAgent ?? DEFAULT_CRAWL_CONFIG.userAgent,
      respectRobotsTxt: true, // MANDATORY
      sameDomainOnly: true,   // MANDATORY
      includePatterns: input.config?.includePatterns,
      excludePatterns: input.config?.excludePatterns,
    };
    
    const jobId = uuidv4();
    const triggeredBy = input.triggeredBy ?? 'manual';
    
    // Create job
    await this.pool.query(
      `INSERT INTO crawl_jobs (
        id, project_id, config, status, progress, 
        total_urls_discovered, crawled_pages, failed_pages, skipped_pages,
        triggered_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        jobId,
        input.projectId,
        JSON.stringify(config),
        'pending',
        0,
        0,
        0,
        0,
        0,
        triggeredBy,
      ]
    );
    
    // Update project status to queued
    await this.updateProjectCrawlStatus(input.projectId, 'queued', {
      lastCrawlJobId: jobId,
      crawlError: null,
      progress: 0,
    });
    
    // Log
    await this.addJobLog(jobId, 'info', `Crawl job created for ${baseUrl}`, {
      triggeredBy,
      config,
    });
    
    console.log(`[CrawlJobService] Created job ${jobId} for project ${input.projectId}`);
    
    return this.getCrawlJob(jobId) as Promise<CrawlJob>;
  }
  
  /**
   * Get crawl job by ID
   */
  async getCrawlJob(jobId: string): Promise<CrawlJob | null> {
    const result = await this.pool.query(
      'SELECT * FROM crawl_jobs WHERE id = $1',
      [jobId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapCrawlJobRow(result.rows[0]);
  }
  
  /**
   * Get recent crawl jobs for project
   */
  async getRecentJobs(projectId: string, limit: number = 10): Promise<CrawlJob[]> {
    const result = await this.pool.query(
      `SELECT * FROM crawl_jobs 
       WHERE project_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [projectId, limit]
    );
    
    return result.rows.map(row => this.mapCrawlJobRow(row));
  }
  
  /**
   * Start a crawl job
   */
  async startCrawlJob(jobId: string): Promise<void> {
    const job = await this.getCrawlJob(jobId);
    if (!job) {
      throw new Error(`Crawl job ${jobId} not found`);
    }
    
    const status = job.status as string;
    if (status !== 'pending') {
      throw new Error(`Cannot start job in ${status} status`);
    }
    
    await this.pool.query(
      `UPDATE crawl_jobs 
       SET status = 'running', started_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [jobId]
    );
    
    await this.updateProjectCrawlStatus(job.projectId, 'running', {
      progress: 0,
    });
    
    await this.addJobLog(jobId, 'info', 'Crawl job started');
    
    console.log(`[CrawlJobService] Started job ${jobId}`);
  }
  
  /**
   * Update crawl progress
   */
  async updateProgress(update: CrawlProgressUpdate): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_jobs 
       SET progress = $2, 
           crawled_pages = $3, 
           failed_pages = $4, 
           skipped_pages = $5,
           total_urls_discovered = $6,
           updated_at = NOW()
       WHERE id = $1`,
      [
        update.jobId,
        update.progress,
        update.crawledPages,
        update.failedPages,
        update.skippedPages,
        update.totalUrlsDiscovered,
      ]
    );
    
    // Get project ID
    const job = await this.getCrawlJob(update.jobId);
    if (job) {
      await this.updateProjectCrawlStatus(job.projectId, 'running', {
        progress: update.progress,
      });
    }
  }
  
  /**
   * Complete a crawl job successfully
   */
  async completeCrawlJob(jobId: string, summary: Partial<CrawlResultSummary>): Promise<void> {
    const job = await this.getCrawlJob(jobId);
    if (!job) {
      throw new Error(`Crawl job ${jobId} not found`);
    }
    
    await this.pool.query(
      `UPDATE crawl_jobs 
       SET status = 'completed', 
           progress = 100,
           crawled_pages = $2,
           failed_pages = $3,
           skipped_pages = $4,
           total_urls_discovered = $5,
           completed_at = NOW(), 
           updated_at = NOW()
       WHERE id = $1`,
      [
        jobId,
        summary.successfulPages ?? 0,
        summary.failedPages ?? 0,
        summary.skippedPages ?? 0,
        summary.totalPages ?? 0,
      ]
    );
    
    await this.updateProjectCrawlStatus(job.projectId, 'completed', {
      progress: 100,
      lastCrawlAt: new Date(),
      crawlError: null,
    });
    
    await this.addJobLog(jobId, 'info', 'Crawl job completed successfully', {
      summary,
    });
    
    console.log(`[CrawlJobService] Completed job ${jobId}`);
  }
  
  /**
   * Fail a crawl job
   */
  async failCrawlJob(jobId: string, errorMessage: string): Promise<void> {
    const job = await this.getCrawlJob(jobId);
    if (!job) {
      throw new Error(`Crawl job ${jobId} not found`);
    }
    
    await this.pool.query(
      `UPDATE crawl_jobs 
       SET status = 'failed', 
           error_message = $2,
           completed_at = NOW(), 
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, errorMessage]
    );
    
    await this.updateProjectCrawlStatus(job.projectId, 'failed', {
      crawlError: errorMessage,
    });
    
    await this.addJobLog(jobId, 'error', `Crawl job failed: ${errorMessage}`);
    
    console.error(`[CrawlJobService] Job ${jobId} failed: ${errorMessage}`);
  }
  
  /**
   * Cancel a crawl job
   */
  async cancelCrawlJob(jobId: string): Promise<void> {
    const job = await this.getCrawlJob(jobId);
    if (!job) {
      throw new Error(`Crawl job ${jobId} not found`);
    }
    
    const status = job.status as string;
    if (status !== 'pending' && status !== 'running') {
      throw new Error(`Cannot cancel job in ${status} status`);
    }
    
    await this.pool.query(
      `UPDATE crawl_jobs 
       SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [jobId]
    );
    
    await this.updateProjectCrawlStatus(job.projectId, 'cancelled');
    
    await this.addJobLog(jobId, 'warn', 'Crawl job cancelled');
    
    console.log(`[CrawlJobService] Cancelled job ${jobId}`);
  }
  
  // ===========================================================================
  // JOB LOGS
  // ===========================================================================
  
  /**
   * Add log entry to job
   */
  async addJobLog(
    jobId: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO crawl_job_logs (id, job_id, level, message, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), jobId, level, message, metadata ? JSON.stringify(metadata) : null]
    );
  }
  
  /**
   * Get logs for a job
   */
  async getJobLogs(jobId: string, limit: number = 100): Promise<CrawlJobLog[]> {
    const result = await this.pool.query(
      `SELECT 
        id, job_id as "jobId", level, message, metadata, created_at as "createdAt"
       FROM crawl_job_logs 
       WHERE job_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [jobId, limit]
    );
    
    return result.rows;
  }
  
  // ===========================================================================
  // QUEUE MANAGEMENT
  // ===========================================================================
  
  /**
   * Add job to queue
   */
  async addToQueue(
    projectId: string,
    jobId: string,
    options?: { priority?: number; scheduledFor?: Date }
  ): Promise<CrawlQueueItem> {
    const queueId = uuidv4();
    
    await this.pool.query(
      `INSERT INTO crawl_queue (id, project_id, job_id, priority, status, scheduled_for, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW())`,
      [
        queueId,
        projectId,
        jobId,
        options?.priority ?? 0,
        options?.scheduledFor ?? new Date(),
      ]
    );
    
    const result = await this.pool.query(
      'SELECT * FROM crawl_queue WHERE id = $1',
      [queueId]
    );
    
    return this.mapQueueItemRow(result.rows[0]);
  }
  
  /**
   * Get next item in queue
   */
  async getNextQueueItem(): Promise<CrawlQueueItem | null> {
    const result = await this.pool.query(
      `SELECT * FROM crawl_queue 
       WHERE status = 'pending' AND scheduled_for <= NOW()
       ORDER BY priority DESC, scheduled_for ASC
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapQueueItemRow(result.rows[0]);
  }
  
  /**
   * Mark queue item as processing
   */
  async markQueueItemProcessing(queueItemId: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [queueItemId]
    );
  }
  
  /**
   * Mark queue item as completed
   */
  async markQueueItemCompleted(queueItemId: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawl_queue SET status = 'completed' WHERE id = $1`,
      [queueItemId]
    );
  }
  
  // ===========================================================================
  // HELPERS
  // ===========================================================================
  
  private mapCrawlJobRow(row: Record<string, unknown>): CrawlJob {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      config: row.config as CrawlJobConfig,
      status: row.status as CrawlStatus,
      progress: row.progress as number ?? 0,
      totalUrlsDiscovered: row.total_urls_discovered as number ?? 0,
      crawledPages: row.crawled_pages as number ?? 0,
      failedPages: row.failed_pages as number ?? 0,
      skippedPages: row.skipped_pages as number ?? 0,
      triggeredBy: row.triggered_by as CrawlTriggerType ?? 'manual',
      errorMessage: row.error_message as string | null,
      startedAt: row.started_at ? new Date(row.started_at as string) : null,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
  
  private mapQueueItemRow(row: Record<string, unknown>): CrawlQueueItem {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      jobId: row.job_id as string | null,
      priority: row.priority as number,
      status: row.status as 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
      scheduledFor: new Date(row.scheduled_for as string),
      startedAt: row.started_at ? new Date(row.started_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
