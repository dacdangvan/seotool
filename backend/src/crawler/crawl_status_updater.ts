/**
 * Crawl Status Updater
 * 
 * Real-time status updates for crawl jobs
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * Features:
 * - Status change notifications
 * - Progress tracking
 * - Event emission for SSE/WebSocket
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import {
  CrawlJob,
  CrawlProgressUpdate,
  CrawlStatus,
  CrawlStatusResponse,
  ProjectCrawlState,
} from './crawl_job.types';
import { CrawlJobService } from './crawl_job.service';

export type CrawlStatusEventType = 
  | 'status:changed'
  | 'progress:updated'
  | 'job:started'
  | 'job:completed'
  | 'job:failed'
  | 'job:cancelled';

export interface CrawlStatusEvent {
  type: CrawlStatusEventType;
  projectId: string;
  jobId?: string;
  status: CrawlStatus;
  progress: number;
  timestamp: Date;
  data?: unknown;
}

export class CrawlStatusUpdater extends EventEmitter {
  private pool: Pool;
  private jobService: CrawlJobService;
  
  constructor(pool: Pool) {
    super();
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
  }
  
  // ===========================================================================
  // STATUS QUERIES
  // ===========================================================================
  
  /**
   * Get detailed crawl status for a project
   */
  async getProjectCrawlStatus(projectId: string): Promise<CrawlStatusResponse> {
    const state = await this.jobService.getProjectCrawlState(projectId);
    
    if (!state) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const currentJob = await this.jobService.getActiveCrawlJob(projectId);
    
    const lastCompletedJob = await this.getLastCompletedJob(projectId);
    
    const isRunning = state.crawlStatus === 'running' || state.crawlStatus === 'queued';
    const canTrigger = !isRunning && state.crawlStatus !== 'failed';
    
    return {
      projectId,
      status: state.crawlStatus,
      progress: state.crawlProgress,
      currentJob,
      lastCompletedJob,
      lastCrawlAt: state.lastCrawlAt,
      isRunning,
      canTrigger,
    };
  }
  
  /**
   * Get last completed crawl job for a project
   */
  private async getLastCompletedJob(projectId: string): Promise<CrawlJob | null> {
    const result = await this.pool.query(
      `SELECT * FROM crawl_jobs 
       WHERE project_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 1`,
      [projectId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapCrawlJobRow(result.rows[0]);
  }
  
  /**
   * Get all projects with their crawl status
   */
  async getAllProjectsCrawlStatus(): Promise<ProjectCrawlState[]> {
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
      ORDER BY name ASC`
    );
    
    return result.rows;
  }
  
  // ===========================================================================
  // STATUS UPDATES
  // ===========================================================================
  
  /**
   * Emit status change event
   */
  emitStatusChange(
    projectId: string,
    status: CrawlStatus,
    jobId?: string,
    data?: unknown
  ): void {
    const event: CrawlStatusEvent = {
      type: 'status:changed',
      projectId,
      jobId,
      status,
      progress: status === 'completed' ? 100 : 0,
      timestamp: new Date(),
      data,
    };
    
    this.emit('status', event);
    console.log(`[CrawlStatusUpdater] Status changed: ${projectId} -> ${status}`);
  }
  
  /**
   * Emit progress update event
   */
  emitProgressUpdate(
    projectId: string,
    jobId: string,
    progress: number,
    data?: unknown
  ): void {
    const event: CrawlStatusEvent = {
      type: 'progress:updated',
      projectId,
      jobId,
      status: 'running',
      progress,
      timestamp: new Date(),
      data,
    };
    
    this.emit('progress', event);
  }
  
  /**
   * Emit job started event
   */
  emitJobStarted(projectId: string, jobId: string): void {
    const event: CrawlStatusEvent = {
      type: 'job:started',
      projectId,
      jobId,
      status: 'running',
      progress: 0,
      timestamp: new Date(),
    };
    
    this.emit('status', event);
    console.log(`[CrawlStatusUpdater] Job started: ${jobId}`);
  }
  
  /**
   * Emit job completed event
   */
  emitJobCompleted(projectId: string, jobId: string, summary?: unknown): void {
    const event: CrawlStatusEvent = {
      type: 'job:completed',
      projectId,
      jobId,
      status: 'completed',
      progress: 100,
      timestamp: new Date(),
      data: summary,
    };
    
    this.emit('status', event);
    console.log(`[CrawlStatusUpdater] Job completed: ${jobId}`);
  }
  
  /**
   * Emit job failed event
   */
  emitJobFailed(projectId: string, jobId: string, error: string): void {
    const event: CrawlStatusEvent = {
      type: 'job:failed',
      projectId,
      jobId,
      status: 'failed',
      progress: 0,
      timestamp: new Date(),
      data: { error },
    };
    
    this.emit('status', event);
    console.error(`[CrawlStatusUpdater] Job failed: ${jobId} - ${error}`);
  }
  
  /**
   * Emit job cancelled event
   */
  emitJobCancelled(projectId: string, jobId: string): void {
    const event: CrawlStatusEvent = {
      type: 'job:cancelled',
      projectId,
      jobId,
      status: 'cancelled',
      progress: 0,
      timestamp: new Date(),
    };
    
    this.emit('status', event);
    console.log(`[CrawlStatusUpdater] Job cancelled: ${jobId}`);
  }
  
  // ===========================================================================
  // HELPERS
  // ===========================================================================
  
  private mapCrawlJobRow(row: Record<string, unknown>): CrawlJob {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      config: row.config as CrawlJob['config'],
      status: row.status as CrawlStatus,
      progress: row.progress as number ?? 0,
      totalUrlsDiscovered: row.total_urls_discovered as number ?? 0,
      crawledPages: row.crawled_pages as number ?? 0,
      failedPages: row.failed_pages as number ?? 0,
      skippedPages: row.skipped_pages as number ?? 0,
      triggeredBy: row.triggered_by as CrawlJob['triggeredBy'] ?? 'manual',
      errorMessage: row.error_message as string | null,
      startedAt: row.started_at ? new Date(row.started_at as string) : null,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
