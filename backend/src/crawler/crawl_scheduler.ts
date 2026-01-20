/**
 * Crawl Scheduler
 * 
 * Manages scheduled and manual crawl triggers
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * Features:
 * - Manual trigger support
 * - Scheduled trigger (cron-like)
 * - Ensures only one crawl per project at a time
 * - No overlapping crawl jobs
 */

import { Pool } from 'pg';
import { CrawlJobService } from './crawl_job.service';
import { CrawlerWorker } from './crawler_worker';
import { CrawlJob, CrawlTriggerType, CreateCrawlJobInput } from './crawl_job.types';

export interface SchedulerConfig {
  /** Poll interval for queue processing in ms */
  pollInterval: number;
  /** Maximum concurrent crawls (usually 1 per project) */
  maxConcurrentCrawls: number;
  /** Enable automatic scheduling */
  enableScheduling: boolean;
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  pollInterval: 10000, // 10 seconds
  maxConcurrentCrawls: 1,
  enableScheduling: true,
};

export class CrawlScheduler {
  private pool: Pool;
  private jobService: CrawlJobService;
  private worker: CrawlerWorker;
  private config: SchedulerConfig;
  
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private activeCrawls: Map<string, CrawlerWorker> = new Map();
  
  constructor(pool: Pool, config?: Partial<SchedulerConfig>) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
    this.worker = new CrawlerWorker(pool);
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }
  
  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================
  
  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[CrawlScheduler] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[CrawlScheduler] Started');
    
    // Start polling for queue items
    this.poll();
  }
  
  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    
    // Stop all active crawls
    for (const [projectId, worker] of this.activeCrawls) {
      console.log(`[CrawlScheduler] Stopping crawl for project ${projectId}`);
      worker.stop();
    }
    
    console.log('[CrawlScheduler] Stopped');
  }
  
  // ===========================================================================
  // MANUAL TRIGGER
  // ===========================================================================
  
  /**
   * Trigger a crawl for a project (idempotent)
   * 
   * Returns existing job if one is already running/queued
   */
  async triggerCrawl(
    projectId: string,
    options?: {
      triggeredBy?: CrawlTriggerType;
      config?: Partial<CreateCrawlJobInput['config']>;
    }
  ): Promise<{ job: CrawlJob; isNew: boolean }> {
    console.log(`[CrawlScheduler] Trigger crawl for project ${projectId}`);
    
    // Check for existing active crawl
    const existingJob = await this.jobService.getActiveCrawlJob(projectId);
    if (existingJob) {
      console.log(`[CrawlScheduler] Project ${projectId} already has active crawl ${existingJob.id}`);
      return { job: existingJob, isNew: false };
    }
    
    // Create new crawl job
    const job = await this.jobService.createCrawlJob({
      projectId,
      config: options?.config,
      triggeredBy: options?.triggeredBy ?? 'manual',
    });
    
    // Add to queue
    await this.jobService.addToQueue(projectId, job.id, { priority: 10 });
    
    console.log(`[CrawlScheduler] Created job ${job.id} for project ${projectId}`);
    
    // Immediately try to process if not at capacity
    this.processNextInQueue();
    
    return { job, isNew: true };
  }
  
  /**
   * Cancel a crawl for a project
   */
  async cancelCrawl(projectId: string): Promise<boolean> {
    console.log(`[CrawlScheduler] Cancel crawl for project ${projectId}`);
    
    const activeJob = await this.jobService.getActiveCrawlJob(projectId);
    if (!activeJob) {
      console.log(`[CrawlScheduler] No active crawl for project ${projectId}`);
      return false;
    }
    
    // Stop worker if running
    const worker = this.activeCrawls.get(projectId);
    if (worker) {
      worker.stop();
      this.activeCrawls.delete(projectId);
    }
    
    // Cancel job
    await this.jobService.cancelCrawlJob(activeJob.id);
    
    return true;
  }
  
  // ===========================================================================
  // SCHEDULING
  // ===========================================================================
  
  /**
   * Schedule a crawl for a project
   */
  async scheduleCrawl(
    projectId: string,
    schedule: string, // cron expression
    nextRun?: Date
  ): Promise<void> {
    const nextScheduledCrawl = nextRun ?? this.calculateNextRun(schedule);
    
    await this.pool.query(
      `UPDATE projects 
       SET crawl_schedule = $2, next_scheduled_crawl = $3, updated_at = NOW()
       WHERE id = $1`,
      [projectId, schedule, nextScheduledCrawl]
    );
    
    console.log(`[CrawlScheduler] Scheduled crawl for project ${projectId} at ${nextScheduledCrawl}`);
  }
  
  /**
   * Cancel scheduled crawls for a project
   */
  async unscheduleCrawl(projectId: string): Promise<void> {
    await this.pool.query(
      `UPDATE projects 
       SET crawl_schedule = NULL, next_scheduled_crawl = NULL, updated_at = NOW()
       WHERE id = $1`,
      [projectId]
    );
    
    console.log(`[CrawlScheduler] Unscheduled crawl for project ${projectId}`);
  }
  
  /**
   * Check for due scheduled crawls
   */
  private async checkScheduledCrawls(): Promise<void> {
    if (!this.config.enableScheduling) return;
    
    // Find projects with due scheduled crawls
    const result = await this.pool.query(
      `SELECT id, domain, crawl_schedule, next_scheduled_crawl
       FROM projects 
       WHERE crawl_schedule IS NOT NULL 
         AND next_scheduled_crawl <= NOW()
         AND crawl_status NOT IN ('queued', 'running')
       ORDER BY next_scheduled_crawl ASC
       LIMIT 10`
    );
    
    for (const project of result.rows) {
      console.log(`[CrawlScheduler] Triggering scheduled crawl for project ${project.id}`);
      
      await this.triggerCrawl(project.id, { triggeredBy: 'scheduled' });
      
      // Update next scheduled run
      const nextRun = this.calculateNextRun(project.crawl_schedule);
      await this.pool.query(
        `UPDATE projects SET next_scheduled_crawl = $2 WHERE id = $1`,
        [project.id, nextRun]
      );
    }
  }
  
  /**
   * Calculate next run time from cron expression
   * Simple implementation - supports: daily, weekly, monthly
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
        // Default to next day
        now.setDate(now.getDate() + 1);
        now.setHours(2, 0, 0, 0);
    }
    
    return now;
  }
  
  // ===========================================================================
  // QUEUE PROCESSING
  // ===========================================================================
  
  /**
   * Poll for queue items
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      // Check scheduled crawls
      await this.checkScheduledCrawls();
      
      // Process queue
      await this.processNextInQueue();
      
    } catch (error) {
      console.error('[CrawlScheduler] Poll error:', error);
    }
    
    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
  }
  
  /**
   * Process next item in queue
   */
  private async processNextInQueue(): Promise<void> {
    // Check capacity
    if (this.activeCrawls.size >= this.config.maxConcurrentCrawls) {
      return;
    }
    
    // Get next queue item
    const queueItem = await this.jobService.getNextQueueItem();
    if (!queueItem || !queueItem.jobId) {
      return;
    }
    
    // Check if project already has active crawl
    if (this.activeCrawls.has(queueItem.projectId)) {
      return;
    }
    
    // Get job
    const job = await this.jobService.getCrawlJob(queueItem.jobId);
    if (!job) {
      console.error(`[CrawlScheduler] Job ${queueItem.jobId} not found`);
      return;
    }
    
    // Mark queue item as processing
    await this.jobService.markQueueItemProcessing(queueItem.id);
    
    // Create worker for this job
    const worker = new CrawlerWorker(this.pool);
    this.activeCrawls.set(queueItem.projectId, worker);
    
    // Execute job in background
    this.executeJobAsync(job, queueItem.id, worker);
  }
  
  /**
   * Execute job asynchronously
   */
  private async executeJobAsync(
    job: CrawlJob, 
    queueItemId: string,
    worker: CrawlerWorker
  ): Promise<void> {
    try {
      await worker.executeJob(job);
      await this.jobService.markQueueItemCompleted(queueItemId);
      
    } catch (error) {
      console.error(`[CrawlScheduler] Job ${job.id} execution failed:`, error);
      
    } finally {
      this.activeCrawls.delete(job.projectId);
      
      // Try to process next item
      if (this.isRunning) {
        this.processNextInQueue();
      }
    }
  }
  
  // ===========================================================================
  // STATUS
  // ===========================================================================
  
  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    activeCrawls: number;
    maxConcurrentCrawls: number;
    activeProjects: string[];
  } {
    return {
      isRunning: this.isRunning,
      activeCrawls: this.activeCrawls.size,
      maxConcurrentCrawls: this.config.maxConcurrentCrawls,
      activeProjects: Array.from(this.activeCrawls.keys()),
    };
  }
}
