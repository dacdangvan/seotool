/**
 * Crawl Scheduler - Manages queue polling and job execution
 */
import { Pool } from 'pg';
import { CrawlJobService } from '../services/crawl_job.service.js';
import { CrawlerWorker } from './crawler_worker.js';
import { CrawlJob, CrawlTriggerType } from '../types.js';

export interface SchedulerConfig {
  pollInterval: number;
  maxConcurrentCrawls: number;
  enableScheduling: boolean;
}

export class CrawlScheduler {
  private pool: Pool;
  private jobService: CrawlJobService;
  private config: SchedulerConfig;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private activeCrawls: Map<string, CrawlerWorker> = new Map();

  constructor(pool: Pool, config: SchedulerConfig) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
    this.config = config;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Scheduler] Started');
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    
    // Stop active crawls
    for (const [projectId, worker] of this.activeCrawls) {
      console.log(`[Scheduler] Stopping crawl for project ${projectId}`);
      worker.stop();
    }
    console.log('[Scheduler] Stopped');
  }

  getStatus(): { activeCrawls: number; maxConcurrentCrawls: number; activeProjects: string[] } {
    return {
      activeCrawls: this.activeCrawls.size,
      maxConcurrentCrawls: this.config.maxConcurrentCrawls,
      activeProjects: Array.from(this.activeCrawls.keys()),
    };
  }

  async triggerCrawl(
    projectId: string,
    options?: { triggeredBy?: CrawlTriggerType; config?: any }
  ): Promise<{ job: CrawlJob; isNew: boolean }> {
    // Check for existing active crawl
    const existingJob = await this.jobService.getActiveCrawlJob(projectId);
    if (existingJob) {
      return { job: existingJob, isNew: false };
    }

    // Create new job
    const job = await this.jobService.createCrawlJob({
      projectId,
      config: options?.config,
      triggeredBy: options?.triggeredBy || 'manual',
    });

    // Add to queue
    await this.jobService.addToQueue(projectId, job.id, { priority: 10 });

    // Try to process immediately
    this.processNextInQueue();

    return { job, isNew: true };
  }

  private poll(): void {
    if (!this.isRunning) return;

    this.processNextInQueue();

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
  }

  private async processNextInQueue(): Promise<void> {
    // Check capacity
    if (this.activeCrawls.size >= this.config.maxConcurrentCrawls) {
      return;
    }

    try {
      // Get next queue item
      const queueItem = await this.jobService.getNextQueueItem();
      if (!queueItem || !queueItem.jobId) return;

      // Check if project already has active crawl
      if (this.activeCrawls.has(queueItem.projectId)) {
        return;
      }

      // Get job
      const job = await this.jobService.getCrawlJob(queueItem.jobId);
      if (!job) {
        await this.jobService.markQueueItemFailed(queueItem.id);
        return;
      }

      // Mark as processing
      await this.jobService.markQueueItemProcessing(queueItem.id);

      // Create and start worker
      const worker = new CrawlerWorker(this.pool);
      this.activeCrawls.set(queueItem.projectId, worker);

      console.log(`[Scheduler] Starting crawl for project ${queueItem.projectId}`);

      // Execute in background
      worker.executeJob(job)
        .then(() => {
          this.jobService.markQueueItemCompleted(queueItem.id);
        })
        .catch((error) => {
          console.error(`[Scheduler] Crawl failed for ${queueItem.projectId}:`, error);
          this.jobService.markQueueItemFailed(queueItem.id);
        })
        .finally(() => {
          this.activeCrawls.delete(queueItem.projectId);
        });

    } catch (error) {
      console.error('[Scheduler] Error processing queue:', error);
    }
  }
}
