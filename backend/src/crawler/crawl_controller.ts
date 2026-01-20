/**
 * Crawl API Controller
 * 
 * REST API endpoints for crawl management
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * Endpoints:
 * - POST /projects/:id/crawl → trigger crawl
 * - GET /projects/:id/crawl-status → detailed status
 * - POST /projects/:id/crawl/cancel → cancel crawl
 * - GET /projects/:id/crawl-jobs → job history
 * - GET /crawl-jobs/:jobId → job details
 * - GET /crawl-jobs/:jobId/logs → job logs
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { CrawlJobService } from './crawl_job.service';
import { CrawlScheduler } from './crawl_scheduler';
import { CrawlStatusUpdater } from './crawl_status_updater';
import { CrawlTriggerType, TriggerCrawlResponse, CrawlStatusResponse } from './crawl_job.types';

interface TriggerCrawlBody {
  maxPages?: number;
  maxDepth?: number;
  requestDelay?: number;
  triggeredBy?: CrawlTriggerType;
}

interface ScheduleCrawlBody {
  schedule: string; // 'daily' | 'weekly' | 'monthly'
}

export class CrawlController {
  private pool: Pool;
  private jobService: CrawlJobService;
  private scheduler: CrawlScheduler;
  private statusUpdater: CrawlStatusUpdater;
  
  constructor(pool: Pool) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
    this.scheduler = new CrawlScheduler(pool);
    this.statusUpdater = new CrawlStatusUpdater(pool);
  }
  
  /**
   * Register routes with Fastify
   */
  registerRoutes(app: FastifyInstance): void {
    // Trigger crawl
    app.post<{
      Params: { id: string };
      Body: TriggerCrawlBody;
    }>('/projects/:id/crawl', this.triggerCrawl.bind(this));
    
    // Get crawl status
    app.get<{
      Params: { id: string };
    }>('/projects/:id/crawl-status', this.getCrawlStatus.bind(this));
    
    // Cancel crawl
    app.post<{
      Params: { id: string };
    }>('/projects/:id/crawl/cancel', this.cancelCrawl.bind(this));
    
    // Schedule crawl
    app.post<{
      Params: { id: string };
      Body: ScheduleCrawlBody;
    }>('/projects/:id/crawl/schedule', this.scheduleCrawl.bind(this));
    
    // Unschedule crawl
    app.delete<{
      Params: { id: string };
    }>('/projects/:id/crawl/schedule', this.unscheduleCrawl.bind(this));
    
    // Get crawl jobs history
    app.get<{
      Params: { id: string };
      Querystring: { limit?: number };
    }>('/projects/:id/crawl-jobs', this.getCrawlJobs.bind(this));
    
    // Get job details
    app.get<{
      Params: { jobId: string };
    }>('/crawl-jobs/:jobId', this.getJobDetails.bind(this));
    
    // Get job logs
    app.get<{
      Params: { jobId: string };
      Querystring: { limit?: number };
    }>('/crawl-jobs/:jobId/logs', this.getJobLogs.bind(this));
    
    // Get all projects crawl status
    app.get('/crawl/status', this.getAllCrawlStatus.bind(this));
    
    // Get scheduler status
    app.get('/crawl/scheduler', this.getSchedulerStatus.bind(this));
  }
  
  /**
   * Start the scheduler
   */
  startScheduler(): void {
    this.scheduler.start();
  }
  
  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    this.scheduler.stop();
  }
  
  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  
  /**
   * POST /projects/:id/crawl
   * Trigger a crawl for a project
   */
  private async triggerCrawl(
    request: FastifyRequest<{ Params: { id: string }; Body: TriggerCrawlBody }>,
    reply: FastifyReply
  ): Promise<TriggerCrawlResponse> {
    const { id: projectId } = request.params;
    const body = request.body || {};
    
    try {
      // Verify project exists
      const projectResult = await this.pool.query(
        'SELECT id, domain FROM projects WHERE id = $1',
        [projectId]
      );
      
      if (projectResult.rows.length === 0) {
        reply.status(404);
        return {
          success: false,
          jobId: '',
          message: 'Project not found',
          status: 'failed',
        };
      }
      
      // Trigger crawl
      const { job, isNew } = await this.scheduler.triggerCrawl(projectId, {
        triggeredBy: body.triggeredBy ?? 'manual',
        config: {
          maxPages: body.maxPages,
          maxDepth: body.maxDepth,
          requestDelay: body.requestDelay,
        },
      });
      
      reply.status(isNew ? 201 : 200);
      return {
        success: true,
        jobId: job.id,
        message: isNew 
          ? 'Crawl job created and queued' 
          : 'Crawl already in progress, returning existing job',
        status: job.status,
      };
      
    } catch (error) {
      console.error('[CrawlController] Trigger crawl error:', error);
      reply.status(500);
      return {
        success: false,
        jobId: '',
        message: error instanceof Error ? error.message : 'Internal server error',
        status: 'failed',
      };
    }
  }
  
  /**
   * GET /projects/:id/crawl-status
   * Get detailed crawl status for a project
   */
  private async getCrawlStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<CrawlStatusResponse | { error: string }> {
    const { id: projectId } = request.params;
    
    try {
      const status = await this.statusUpdater.getProjectCrawlStatus(projectId);
      return status;
      
    } catch (error) {
      console.error('[CrawlController] Get status error:', error);
      reply.status(404);
      return { error: error instanceof Error ? error.message : 'Not found' };
    }
  }
  
  /**
   * POST /projects/:id/crawl/cancel
   * Cancel a crawl for a project
   */
  private async cancelCrawl(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; message: string }> {
    const { id: projectId } = request.params;
    
    try {
      const cancelled = await this.scheduler.cancelCrawl(projectId);
      
      if (!cancelled) {
        reply.status(404);
        return {
          success: false,
          message: 'No active crawl found for this project',
        };
      }
      
      return {
        success: true,
        message: 'Crawl cancelled successfully',
      };
      
    } catch (error) {
      console.error('[CrawlController] Cancel crawl error:', error);
      reply.status(500);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      };
    }
  }
  
  /**
   * POST /projects/:id/crawl/schedule
   * Schedule automatic crawls for a project
   */
  private async scheduleCrawl(
    request: FastifyRequest<{ Params: { id: string }; Body: ScheduleCrawlBody }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; message: string; nextRun?: string }> {
    const { id: projectId } = request.params;
    const { schedule } = request.body || {};
    
    if (!schedule || !['daily', 'weekly', 'monthly'].includes(schedule)) {
      reply.status(400);
      return {
        success: false,
        message: 'Invalid schedule. Use: daily, weekly, or monthly',
      };
    }
    
    try {
      await this.scheduler.scheduleCrawl(projectId, schedule);
      
      // Get next scheduled run
      const result = await this.pool.query(
        'SELECT next_scheduled_crawl FROM projects WHERE id = $1',
        [projectId]
      );
      
      return {
        success: true,
        message: `Crawl scheduled: ${schedule}`,
        nextRun: result.rows[0]?.next_scheduled_crawl?.toISOString(),
      };
      
    } catch (error) {
      console.error('[CrawlController] Schedule crawl error:', error);
      reply.status(500);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      };
    }
  }
  
  /**
   * DELETE /projects/:id/crawl/schedule
   * Remove scheduled crawls for a project
   */
  private async unscheduleCrawl(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; message: string }> {
    const { id: projectId } = request.params;
    
    try {
      await this.scheduler.unscheduleCrawl(projectId);
      
      return {
        success: true,
        message: 'Crawl schedule removed',
      };
      
    } catch (error) {
      console.error('[CrawlController] Unschedule crawl error:', error);
      reply.status(500);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      };
    }
  }
  
  /**
   * GET /projects/:id/crawl-jobs
   * Get crawl job history for a project
   */
  private async getCrawlJobs(
    request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: number } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;
    const limit = request.query.limit ?? 10;
    
    try {
      const jobs = await this.jobService.getRecentJobs(projectId, limit);
      return { jobs };
      
    } catch (error) {
      console.error('[CrawlController] Get jobs error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /crawl-jobs/:jobId
   * Get job details
   */
  private async getJobDetails(
    request: FastifyRequest<{ Params: { jobId: string } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { jobId } = request.params;
    
    try {
      const job = await this.jobService.getCrawlJob(jobId);
      
      if (!job) {
        reply.status(404);
        return { error: 'Job not found' };
      }
      
      return { job };
      
    } catch (error) {
      console.error('[CrawlController] Get job details error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /crawl-jobs/:jobId/logs
   * Get job logs
   */
  private async getJobLogs(
    request: FastifyRequest<{ Params: { jobId: string }; Querystring: { limit?: number } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { jobId } = request.params;
    const limit = request.query.limit ?? 100;
    
    try {
      const logs = await this.jobService.getJobLogs(jobId, limit);
      return { logs };
      
    } catch (error) {
      console.error('[CrawlController] Get job logs error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /crawl/status
   * Get all projects crawl status
   */
  private async getAllCrawlStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> {
    try {
      const projects = await this.statusUpdater.getAllProjectsCrawlStatus();
      return { projects };
      
    } catch (error) {
      console.error('[CrawlController] Get all status error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /crawl/scheduler
   * Get scheduler status
   */
  private async getSchedulerStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> {
    return this.scheduler.getStatus();
  }
}
