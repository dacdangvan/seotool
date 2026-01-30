/**
 * Crawl Job Queue Service
 * 
 * Section 18: SCHEDULED & MANUAL FULL CRAWL EXECUTION
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * This service is used by Backend API to:
 * - Create crawl jobs
 * - Add jobs to queue
 * - Check job status
 * 
 * This service does NOT execute crawl jobs.
 * Execution is handled by Standalone Crawler Worker.
 * 
 * Architecture:
 *   Backend API → CrawlJobQueueService → Creates job → Adds to queue
 *   Standalone Worker → CrawlScheduler → Polls queue → Executes crawl
 */

import { Pool } from 'pg';
import { CrawlJobService } from './crawl_job.service';
import { CrawlJob, CrawlTriggerType, CreateCrawlJobInput } from './crawl_job.types';

export interface QueueCrawlOptions {
  triggeredBy?: CrawlTriggerType;
  config?: Partial<CreateCrawlJobInput['config']>;
  priority?: number;
}

export class CrawlJobQueueService {
  private pool: Pool;
  private jobService: CrawlJobService;
  
  constructor(pool: Pool) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
  }
  
  /**
   * Queue a crawl for a project (idempotent)
   * 
   * This only creates the job and adds to queue.
   * Job execution is handled by Standalone Crawler Worker.
   * 
   * Returns existing job if one is already running/queued
   */
  async queueCrawl(
    projectId: string,
    options?: QueueCrawlOptions
  ): Promise<{ job: CrawlJob; isNew: boolean }> {
    console.log(`[CrawlJobQueueService] Queue crawl for project ${projectId}`);
    
    // Check for existing active crawl
    const existingJob = await this.jobService.getActiveCrawlJob(projectId);
    if (existingJob) {
      console.log(`[CrawlJobQueueService] Project ${projectId} already has active crawl ${existingJob.id}`);
      return { job: existingJob, isNew: false };
    }
    
    // Create new crawl job
    const job = await this.jobService.createCrawlJob({
      projectId,
      config: options?.config,
      triggeredBy: options?.triggeredBy ?? 'manual',
    });
    
    // Add to queue (will be picked up by Standalone Worker)
    await this.jobService.addToQueue(projectId, job.id, { 
      priority: options?.priority ?? 10 
    });
    
    console.log(`[CrawlJobQueueService] Created job ${job.id} and added to queue`);
    
    return { job, isNew: true };
  }
  
  /**
   * Cancel a queued/running crawl for a project
   */
  async cancelCrawl(projectId: string): Promise<boolean> {
    console.log(`[CrawlJobQueueService] Cancel crawl for project ${projectId}`);
    
    const activeJob = await this.jobService.getActiveCrawlJob(projectId);
    if (!activeJob) {
      console.log(`[CrawlJobQueueService] No active crawl for project ${projectId}`);
      return false;
    }
    
    // Mark job as cancelled in database
    // Standalone Worker will detect this and stop execution
    await this.jobService.cancelCrawlJob(activeJob.id);
    
    return true;
  }
  
  /**
   * Schedule a crawl for a project
   */
  async scheduleCrawl(
    projectId: string,
    schedule: string, // 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    const nextScheduledCrawl = this.calculateNextRun(schedule);
    
    await this.pool.query(
      `UPDATE projects 
       SET crawl_schedule = $2, next_scheduled_crawl = $3, updated_at = NOW()
       WHERE id = $1`,
      [projectId, schedule, nextScheduledCrawl]
    );
    
    console.log(`[CrawlJobQueueService] Scheduled crawl for project ${projectId} at ${nextScheduledCrawl}`);
  }
  
  /**
   * Unschedule crawls for a project
   */
  async unscheduleCrawl(projectId: string): Promise<void> {
    await this.pool.query(
      `UPDATE projects 
       SET crawl_schedule = NULL, next_scheduled_crawl = NULL, updated_at = NOW()
       WHERE id = $1`,
      [projectId]
    );
    
    console.log(`[CrawlJobQueueService] Unscheduled crawl for project ${projectId}`);
  }
  
  /**
   * Calculate next run time from schedule
   */
  private calculateNextRun(schedule: string): Date {
    const now = new Date();
    
    switch (schedule) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(2, 0, 0, 0); // 2 AM
        break;
        
      case 'weekly':
        now.setDate(now.getDate() + 7);
        now.setHours(2, 0, 0, 0);
        break;
        
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        now.setDate(1);
        now.setHours(2, 0, 0, 0);
        break;
        
      default:
        now.setDate(now.getDate() + 1);
        now.setHours(2, 0, 0, 0);
    }
    
    return now;
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    total: number;
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) as total
      FROM crawl_queue
    `);
    
    return {
      pending: parseInt(result.rows[0].pending) || 0,
      processing: parseInt(result.rows[0].processing) || 0,
      total: parseInt(result.rows[0].total) || 0,
    };
  }
}
