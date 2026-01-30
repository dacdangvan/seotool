/**
 * Crawl API Controller
 * 
 * REST API endpoints for crawl management
 * Following AI_SEO_TOOL_PROMPT_BOOK.md Section 18
 * 
 * Architecture:
 * - Backend API → Creates jobs → Adds to queue
 * - Standalone Worker → Polls queue → Executes crawls
 * - Frontend → Triggers and observes, never crawls
 * 
 * Endpoints:
 * - POST /projects/:id/crawl → trigger crawl (queue only)
 * - GET /projects/:id/crawl-status → detailed status
 * - POST /projects/:id/crawl/cancel → cancel crawl
 * - GET /projects/:id/crawl-jobs → job history
 * - GET /crawl-jobs/:jobId → job details
 * - GET /crawl-jobs/:jobId/logs → job logs
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { CrawlJobService } from './crawl_job.service';
import { CrawlJobQueueService } from './crawl_job_queue.service';
import { CrawlStatusUpdater } from './crawl_status_updater';
import { CrawlTriggerType, TriggerCrawlResponse, CrawlStatusResponse } from './crawl_job.types';
import { PostgresCrawledPagesRepository } from '../infrastructure/repositories/PostgresCrawledPagesRepository';
import { PostgresCWVResultsRepository } from '../infrastructure/repositories/PostgresCWVResultsRepository';

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
  private queueService: CrawlJobQueueService;
  private statusUpdater: CrawlStatusUpdater;
  private crawledPagesRepo: PostgresCrawledPagesRepository;
  private cwvRepo: PostgresCWVResultsRepository;
  
  constructor(pool: Pool) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
    this.queueService = new CrawlJobQueueService(pool);
    this.statusUpdater = new CrawlStatusUpdater(pool);
    this.crawledPagesRepo = new PostgresCrawledPagesRepository(pool);
    this.cwvRepo = new PostgresCWVResultsRepository(pool);
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
    
    // Get queue status
    app.get('/crawl/queue-stats', this.getQueueStats.bind(this));
    
    // Get latest crawl results for a project
    app.get<{
      Params: { id: string };
    }>('/projects/:id/crawl-results', this.getCrawlResults.bind(this));
    
    // Get crawl summary for dashboard
    app.get<{
      Params: { id: string };
    }>('/projects/:id/crawl/summary', this.getCrawlSummary.bind(this));
    
    // Get latest crawl data (for frontend compatibility)
    app.get('/crawl/latest', this.getLatestCrawlData.bind(this));
    
    // Get CWV data for a URL
    app.get<{
      Params: { id: string };
      Querystring: { url: string; device?: string };
    }>('/projects/:id/cwv', this.getCWVForUrl.bind(this));
    
    // Get batch CWV data
    app.post<{
      Params: { id: string };
      Body: { urls: string[]; device?: string };
    }>('/projects/:id/cwv/batch', this.getBatchCWV.bind(this));
    
    // Get CWV dashboard data for a project
    app.get<{
      Querystring: { projectId: string; device?: string };
    }>('/cwv/dashboard', this.getCWVDashboard.bind(this));
    
    // Add URLs to crawl queue (manual URL submission)
    app.post<{
      Params: { id: string };
      Body: { urls: string[]; priority?: number };
    }>('/projects/:id/crawl/urls', this.addUrlsToCrawl.bind(this));
    
    // Get crawl queue status
    app.get<{
      Params: { id: string };
      Querystring: { limit?: number; offset?: number };
    }>('/projects/:id/crawl/queue', this.getCrawlQueue.bind(this));
  }
  
  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  
  /**
   * POST /projects/:id/crawl
   * Queue a crawl for a project (job execution by Standalone Worker)
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
      
      // Queue crawl (execution handled by Standalone Worker)
      const { job, isNew } = await this.queueService.queueCrawl(projectId, {
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
      const cancelled = await this.queueService.cancelCrawl(projectId);
      
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
      await this.queueService.scheduleCrawl(projectId, schedule);
      
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
      await this.queueService.unscheduleCrawl(projectId);
      
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
   * GET /crawl/queue-stats
   * Get queue statistics
   */
  private async getQueueStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> {
    try {
      const stats = await this.queueService.getQueueStats();
      return { 
        ...stats,
        message: 'Queue stats - jobs are executed by Standalone Crawler Worker'
      };
    } catch (error) {
      console.error('[CrawlController] Get queue stats error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /projects/:id/crawl-results
   * Get latest crawl results for a project
   */
  private async getCrawlResults(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;
    
    try {
      const results = await this.crawledPagesRepo.getLatestCrawlResult(projectId);
      
      if (!results) {
        return null;
      }
      
      // Transform the data to match frontend expectations (snake_case to camelCase)
      const transformedResults = {
        ...results,
        pages: results.pages.map(page => this.transformPageForFrontend(page))
      };
      
      return transformedResults;
      
    } catch (error) {
      console.error('[CrawlController] Get crawl results error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /projects/:id/crawl/summary
   * Get crawl summary for dashboard
   */
  private async getCrawlSummary(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;
    
    try {
      // Get URL inventory stats with http_status
      const inventoryQuery = `
        SELECT 
          COUNT(*) as total_pages,
          COUNT(*) FILTER (WHERE state = 'CRAWLED') as crawled_pages,
          COUNT(*) FILTER (WHERE state = 'DISCOVERED') as discovered_pages,
          COUNT(*) FILTER (WHERE state = 'ERROR') as error_pages,
          COUNT(*) FILTER (WHERE http_status >= 200 AND http_status < 300) as success_2xx,
          COUNT(*) FILTER (WHERE http_status >= 300 AND http_status < 400) as redirect_3xx,
          COUNT(*) FILTER (WHERE http_status >= 400 AND http_status < 500) as error_4xx,
          COUNT(*) FILTER (WHERE http_status >= 500) as error_5xx
        FROM url_inventory
        WHERE project_id = $1
      `;
      const inventoryResult = await this.pool.query(inventoryQuery, [projectId]);
      const inventoryStats = inventoryResult.rows[0];
      
      // Get page content stats with issues (headings is jsonb array with {text, level})
      const contentQuery = `
        SELECT 
          COUNT(*) as total_content,
          COUNT(*) FILTER (WHERE title IS NULL OR title = '') as missing_title,
          COUNT(*) FILTER (WHERE meta_description IS NULL OR meta_description = '') as missing_meta_desc,
          COUNT(*) FILTER (WHERE headings IS NULL OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(headings) elem WHERE (elem->>'level')::int = 1
          )) as missing_h1,
          COUNT(*) FILTER (WHERE (
            SELECT COUNT(*) FROM jsonb_array_elements(headings) elem WHERE (elem->>'level')::int = 1
          ) > 1) as multiple_h1
        FROM page_content_normalized
        WHERE project_id = $1
      `;
      const contentResult = await this.pool.query(contentQuery, [projectId]);
      const contentStats = contentResult.rows[0];
      
      // Get latest crawl job
      const jobQuery = `
        SELECT id, status, started_at, completed_at, crawled_pages, total_pages
        FROM crawl_jobs
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const jobResult = await this.pool.query(jobQuery, [projectId]);
      const latestJob = jobResult.rows[0];
      
      // Get average load time from CWV results (using LCP as load time indicator)
      const cwvQuery = `
        SELECT 
          ROUND(AVG(lcp_value)) as avg_lcp,
          ROUND(AVG(fcp_value)) as avg_fcp,
          ROUND(AVG(ttfb_value)) as avg_ttfb
        FROM cwv_results
        WHERE project_id = $1
      `;
      const cwvResult = await this.pool.query(cwvQuery, [projectId]);
      const cwvStats = cwvResult.rows[0];
      const avgLoadTime = parseInt(cwvStats?.avg_lcp) || 0;
      
      // Get project name
      const projectQuery = `SELECT name FROM projects WHERE id = $1`;
      const projectResult = await this.pool.query(projectQuery, [projectId]);
      const projectName = projectResult.rows[0]?.name || 'Unknown Project';
      
      // Calculate status codes distribution from url_inventory
      const totalWithStatus = (parseInt(inventoryStats.success_2xx) || 0) + 
                              (parseInt(inventoryStats.redirect_3xx) || 0) + 
                              (parseInt(inventoryStats.error_4xx) || 0) + 
                              (parseInt(inventoryStats.error_5xx) || 0);
      const statusCodes = [
        {
          code: '2xx',
          count: parseInt(inventoryStats.success_2xx) || 0,
          percentage: totalWithStatus > 0 ? Math.round((parseInt(inventoryStats.success_2xx) || 0) / totalWithStatus * 1000) / 10 : 0,
          label: 'Success',
          color: '#22c55e'
        },
        {
          code: '3xx',
          count: parseInt(inventoryStats.redirect_3xx) || 0,
          percentage: totalWithStatus > 0 ? Math.round((parseInt(inventoryStats.redirect_3xx) || 0) / totalWithStatus * 1000) / 10 : 0,
          label: 'Redirect',
          color: '#3b82f6'
        },
        {
          code: '4xx',
          count: parseInt(inventoryStats.error_4xx) || 0,
          percentage: totalWithStatus > 0 ? Math.round((parseInt(inventoryStats.error_4xx) || 0) / totalWithStatus * 1000) / 10 : 0,
          label: 'Client Error',
          color: '#f59e0b'
        },
        {
          code: '5xx',
          count: parseInt(inventoryStats.error_5xx) || 0,
          percentage: totalWithStatus > 0 ? Math.round((parseInt(inventoryStats.error_5xx) || 0) / totalWithStatus * 1000) / 10 : 0,
          label: 'Server Error',
          color: '#ef4444'
        }
      ];
      
      // Build issues array
      const issues = [];
      
      if (parseInt(contentStats.missing_meta_desc) > 0) {
        issues.push({
          type: 'missing_meta_description',
          count: parseInt(contentStats.missing_meta_desc),
          severity: 'warning',
          label: 'Missing Meta Description',
          description: 'Pages without meta description may have lower CTR in search results'
        });
      }
      
      if (parseInt(contentStats.missing_h1) > 0) {
        issues.push({
          type: 'missing_h1',
          count: parseInt(contentStats.missing_h1),
          severity: 'critical',
          label: 'Missing H1 Tag',
          description: 'Every page should have exactly one H1 tag for SEO'
        });
      }
      
      if (parseInt(contentStats.multiple_h1) > 0) {
        issues.push({
          type: 'multiple_h1',
          count: parseInt(contentStats.multiple_h1),
          severity: 'warning',
          label: 'Multiple H1 Tags',
          description: 'Pages should have exactly one H1 tag'
        });
      }
      
      if (parseInt(contentStats.missing_title) > 0) {
        issues.push({
          type: 'missing_title',
          count: parseInt(contentStats.missing_title),
          severity: 'critical',
          label: 'Missing Title Tag',
          description: 'Every page must have a title tag for SEO'
        });
      }
      
      if (parseInt(contentStats.slow_pages) > 0) {
        issues.push({
          type: 'slow_pages',
          count: parseInt(contentStats.slow_pages),
          severity: 'warning',
          label: 'Slow Loading Pages',
          description: 'Pages taking more than 3 seconds to load'
        });
      }
      
      if (parseInt(inventoryStats.error_4xx) > 0) {
        issues.push({
          type: 'broken_links',
          count: parseInt(inventoryStats.error_4xx),
          severity: 'critical',
          label: 'Broken Links (4xx)',
          description: 'Pages returning client error status codes'
        });
      }
      
      // Calculate KPIs
      const totalPages = parseInt(inventoryStats.total_pages) || 0;
      const totalContent = parseInt(contentStats.total_content) || 0;
      const pagesWithIssues = issues.reduce((sum, issue) => sum + issue.count, 0);
      const errorPages4xx = parseInt(inventoryStats.error_4xx) || 0;
      const errorPages5xx = parseInt(inventoryStats.error_5xx) || 0;
      const noindexPages = 0; // Not tracked in current schema
      const healthyPages = Math.max(0, totalContent - pagesWithIssues);
      
      // Determine crawl status
      let crawlStatus = 'not_started';
      let crawlProgress = 0;
      
      if (latestJob) {
        if (latestJob.status === 'running' || latestJob.status === 'processing') {
          crawlStatus = 'running';
          crawlProgress = latestJob.total_pages > 0 
            ? Math.round((latestJob.crawled_pages / latestJob.total_pages) * 100)
            : 50;
        } else if (latestJob.status === 'completed') {
          crawlStatus = 'completed';
          crawlProgress = 100;
        } else if (latestJob.status === 'failed') {
          crawlStatus = 'failed';
        } else if (latestJob.status === 'pending' && totalContent > 0) {
          // Job is pending but we have data from previous crawls
          crawlStatus = 'completed';
          crawlProgress = 100;
        }
      }
      
      // If no job or job not determinative, check if we have content
      if (crawlStatus === 'not_started' && totalContent > 0) {
        crawlStatus = 'completed';
        crawlProgress = 100;
      }
      
      return {
        projectId,
        projectName,
        kpis: {
          totalPages,
          pagesWithIssues,
          noindexPages,
          errorPages4xx,
          errorPages5xx,
          healthyPages: Math.max(0, healthyPages),
          avgLoadTime, // From CWV LCP measurements
          lastCrawlDate: latestJob?.completed_at || latestJob?.started_at || null
        },
        statusCodes,
        issues,
        crawlStatus,
        crawlProgress
      };
      
    } catch (error) {
      console.error('[CrawlController] Get crawl summary error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /crawl/latest
   * Get latest crawl data (for frontend compatibility)
   */
  private async getLatestCrawlData(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> {
    try {
      // For now, get data for default VIB project
      const defaultProjectId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const data = await this.crawledPagesRepo.getLatestCrawlResult(defaultProjectId);
      
      if (!data) {
        return null;
      }
      
      // Transform the data to match frontend expectations (snake_case to camelCase)
      const transformedData = {
        ...data,
        pages: data.pages.map(page => this.transformPageForFrontend(page))
      };
      
      return transformedData;
      
    } catch (error) {
      console.error('[CrawlController] Get latest crawl data error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * GET /projects/:id/cwv
   * Get CWV data for a specific URL
   */
  private async getCWVForUrl(
    request: FastifyRequest<{ Params: { id: string }; Querystring: { url: string; device?: string } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;
    const { url, device = 'mobile' } = request.query;
    
    try {
      const cwvData = await this.cwvRepo.getCWVForUrl(projectId, url, device as 'mobile' | 'desktop');
      return { cwvData };
      
    } catch (error) {
      console.error('[CrawlController] Get CWV for URL error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  /**
   * POST /projects/:id/cwv/batch
   * Get CWV data for multiple URLs
   */
  private async getBatchCWV(
    request: FastifyRequest<{ Params: { id: string }; Body: { urls: string[]; device?: string } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;
    const { urls, device = 'mobile' } = request.body;
    
    try {
      const cwvDataMap = await this.cwvRepo.getBatchCWV(projectId, urls, device as 'mobile' | 'desktop');
      
      // Convert Map to plain object for JSON serialization
      const cwvData: Record<string, any[]> = {};
      for (const [url, data] of cwvDataMap.entries()) {
        cwvData[url] = data;
      }
      
      return { cwvData };
      
    } catch (error) {
      console.error('[CrawlController] Get batch CWV error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }

  /**
   * GET /cwv/dashboard
   * Get CWV dashboard data for a project - aggregated stats and distributions
   */
  private async getCWVDashboard(
    request: FastifyRequest<{ Querystring: { projectId: string; device?: string } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { projectId, device = 'mobile' } = request.query;
    
    try {
      // Get project info
      const projectResult = await this.pool.query(
        'SELECT id, name, domain FROM projects WHERE id = $1',
        [projectId]
      );
      
      const project = projectResult.rows[0];
      if (!project) {
        reply.status(404);
        return { error: 'Project not found' };
      }
      
      // Get all CWV results for this project (latest per URL/device)
      const allCwvResults = await this.cwvRepo.getLatestCWVResults(projectId, 1000);
      
      // Filter by device
      const cwvResults = allCwvResults.filter(r => r.device === device);
      
      if (cwvResults.length === 0) {
        return {
          projectId,
          projectName: project.name || project.domain,
          device,
          lastUpdated: new Date().toISOString(),
          kpi: {
            totalUrls: 0,
            goodUrls: 0,
            needsImprovementUrls: 0,
            poorUrls: 0,
            avgPerformanceScore: 0,
            avgLcp: 0,
            avgCls: 0,
            avgInp: 0,
            passRate: 0
          },
          distribution: {
            lcp: { good: 0, needsImprovement: 0, poor: 0 },
            inp: { good: 0, needsImprovement: 0, poor: 0 },
            cls: { good: 0, needsImprovement: 0, poor: 0 }
          },
          urlSamples: {
            lcp: { worst: [] },
            inp: { worst: [] },
            cls: { worst: [] }
          }
        };
      }
      
      // Calculate distributions
      const lcpDistribution = { good: 0, needsImprovement: 0, poor: 0 };
      const inpDistribution = { good: 0, needsImprovement: 0, poor: 0 };
      const clsDistribution = { good: 0, needsImprovement: 0, poor: 0 };
      
      let totalLcp = 0, totalCls = 0, totalInp = 0, totalScore = 0;
      let goodUrls = 0, needsImprovementUrls = 0, poorUrls = 0;
      
      const lcpWorst: Array<{ url: string; value: number }> = [];
      const inpWorst: Array<{ url: string; value: number }> = [];
      const clsWorst: Array<{ url: string; value: number }> = [];
      
      for (const result of cwvResults) {
        // Parse values from DB (may be strings)
        const lcpValue = parseFloat(String(result.lcp_value)) || 0;
        const clsValue = parseFloat(String(result.cls_value)) || 0;
        const inpValue = result.inp_value ? parseFloat(String(result.inp_value)) : null;
        
        // LCP distribution (using snake_case from DB)
        if (result.lcp_status === 'good') lcpDistribution.good++;
        else if (result.lcp_status === 'needs_improvement') lcpDistribution.needsImprovement++;
        else lcpDistribution.poor++;
        
        totalLcp += lcpValue;
        lcpWorst.push({ url: result.url, value: lcpValue });
        
        // CLS distribution
        if (result.cls_status === 'good') clsDistribution.good++;
        else if (result.cls_status === 'needs_improvement') clsDistribution.needsImprovement++;
        else clsDistribution.poor++;
        
        totalCls += clsValue;
        clsWorst.push({ url: result.url, value: clsValue });
        
        // INP distribution (if available)
        if (inpValue !== null) {
          if (result.inp_status === 'good') inpDistribution.good++;
          else if (result.inp_status === 'needs_improvement') inpDistribution.needsImprovement++;
          else inpDistribution.poor++;
          
          totalInp += inpValue;
          inpWorst.push({ url: result.url, value: inpValue });
        }
        
        // Overall status
        if (result.overall_status === 'good') goodUrls++;
        else if (result.overall_status === 'needs_improvement') needsImprovementUrls++;
        else poorUrls++;
        
        totalScore += result.performance_score || 0;
      }
      
      const totalUrls = cwvResults.length;
      
      // Sort and get top 5 worst
      lcpWorst.sort((a, b) => b.value - a.value);
      inpWorst.sort((a, b) => b.value - a.value);
      clsWorst.sort((a, b) => b.value - a.value);
      
      // Get latest measurement time
      const lastMeasured = cwvResults.reduce((latest: string, r) => 
        r.measured_at > latest ? r.measured_at : latest, 
        cwvResults[0].measured_at
      );
      
      return {
        projectId,
        projectName: project.name || project.domain,
        device,
        lastUpdated: lastMeasured,
        kpi: {
          totalUrls,
          goodUrls,
          needsImprovementUrls,
          poorUrls,
          avgPerformanceScore: Math.round(totalScore / totalUrls),
          avgLcp: Math.round(totalLcp / totalUrls),
          avgCls: Number((totalCls / totalUrls).toFixed(3)),
          avgInp: inpWorst.length > 0 ? Math.round(totalInp / inpWorst.length) : 0,
          passRate: (goodUrls / totalUrls) * 100
        },
        distribution: {
          lcp: lcpDistribution,
          inp: inpDistribution,
          cls: clsDistribution
        },
        urlSamples: {
          lcp: { worst: lcpWorst.slice(0, 5).map(w => ({ url: w.url, value: w.value, status: this.getLCPStatus(w.value) })) },
          inp: { worst: inpWorst.slice(0, 5).map(w => ({ url: w.url, value: w.value, status: this.getINPStatus(w.value) })) },
          cls: { worst: clsWorst.slice(0, 5).map(w => ({ url: w.url, value: w.value, status: this.getCLSStatus(w.value) })) }
        }
      };
      
    } catch (error) {
      console.error('[CrawlController] Get CWV dashboard error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }
  
  // Helper methods for CWV status
  private getLCPStatus(value: number): string {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs_improvement';
    return 'poor';
  }
  
  private getINPStatus(value: number): string {
    if (value <= 200) return 'good';
    if (value <= 500) return 'needs_improvement';
    return 'poor';
  }
  
  private getCLSStatus(value: number): string {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs_improvement';
    return 'poor';
  }

  /**
   * Transform page data from snake_case to camelCase for frontend compatibility
   */
  private transformPageForFrontend(page: any): any {
    // Calculate derived fields
    const titleLength = page.title ? page.title.length : 0;
    const metaDescriptionLength = page.meta_description ? page.meta_description.length : 0;
    const h1Count = (page.h1_tags || []).length;
    const h2Count = (page.h2_tags || []).length;
    const h3Count = (page.h3_tags || []).length;
    const internalLinksCount = (page.internal_links || []).length;
    const externalLinksCount = (page.external_links || []).length;
    const imagesCount = (page.images || []).length;
    const imagesWithoutAlt = (page.images || []).filter((img: any) => !img.alt || img.alt.trim() === '').length;
    const contentLength = page.page_size || 0;
    
    // Check for noindex/nofollow
    const hasNoindex = page.meta_robots ? page.meta_robots.toLowerCase().includes('noindex') : false;
    const hasNofollow = page.meta_robots ? page.meta_robots.toLowerCase().includes('nofollow') : false;
    
    return {
      projectId: page.project_id,
      url: page.url,
      statusCode: page.status_code,
      responseTime: page.response_time,
      loadTime: page.load_time || 0,  // Total page load time in ms
      
      // Meta tags
      title: page.title,
      titleLength,
      metaDescription: page.meta_description,
      metaDescriptionLength,
      metaRobots: page.meta_robots,
      canonical: page.canonical_url,
      hasNoindex,
      hasNofollow,
      language: null, // Not available in current data
      
      // Headings
      h1Tags: page.h1_tags || [],
      h1Count,
      h2Tags: page.h2_tags || [],
      h2Count,
      h3Tags: page.h3_tags || [],
      h3Count,
      
      // Content
      wordCount: page.word_count,
      contentLength,
      
      // Links
      internalLinks: page.internal_links || [],
      internalLinksCount,
      externalLinks: page.external_links || [],
      externalLinksCount,
      
      // Images
      images: page.images || [],
      imagesCount,
      imagesWithoutAlt,
      
      // Issues
      issues: page.issues || [],
      
      // Metadata
      crawledAt: page.crawled_at,
      depth: page.crawl_depth,
    };
  }
  
  // ===========================================================================
  // ADD URLS TO CRAWL
  // ===========================================================================
  
  /**
   * POST /projects/:id/crawl/urls
   * Add multiple URLs to the crawl queue for a project
   * URLs must be pages within the project's domain
   */
  private async addUrlsToCrawl(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { urls: string[]; priority?: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: projectId } = request.params;
    const { urls, priority = 50 } = request.body || {};

    try {
      console.log('[CrawlController] Adding URLs to crawl', { projectId, urlCount: urls?.length });

      // Validate input
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'At least one URL is required' },
        });
        return;
      }

      if (urls.length > 100) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 URLs can be added at once' },
        });
        return;
      }

      // Validate project exists and get domain
      const projectResult = await this.pool.query(
        'SELECT id, name, domain FROM projects WHERE id = $1',
        [projectId]
      );
      
      if (projectResult.rows.length === 0) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
        return;
      }

      const project = projectResult.rows[0];
      const baseUrl = `https://${project.domain}`;

      // Validate and normalize URLs
      const validUrls: string[] = [];
      const invalidUrls: { url: string; reason: string }[] = [];

      for (const rawUrl of urls) {
        try {
          const trimmedUrl = rawUrl.trim();
          if (!trimmedUrl) continue;

          let normalizedUrl: string;

          // Handle relative URLs (paths)
          if (trimmedUrl.startsWith('/')) {
            normalizedUrl = new URL(trimmedUrl, baseUrl).href;
          } else if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            // Assume it's a path without leading slash
            normalizedUrl = new URL('/' + trimmedUrl, baseUrl).href;
          } else {
            normalizedUrl = new URL(trimmedUrl).href;
          }

          // Check if URL belongs to the project's domain
          const urlObj = new URL(normalizedUrl);
          const baseUrlObj = new URL(baseUrl);
          
          if (urlObj.hostname !== baseUrlObj.hostname) {
            invalidUrls.push({ url: rawUrl, reason: `URL must be from ${baseUrlObj.hostname}` });
            continue;
          }

          validUrls.push(normalizedUrl);
        } catch (error) {
          invalidUrls.push({ url: rawUrl, reason: 'Invalid URL format' });
        }
      }

      if (validUrls.length === 0) {
        reply.status(400).send({
          success: false,
          error: { code: 'NO_VALID_URLS', message: 'No valid URLs provided' },
          invalidUrls,
        });
        return;
      }

      // Insert URLs into url_inventory
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        const addedUrls: { url: string; state: string }[] = [];
        const skippedUrls: { url: string; reason: string }[] = [];

        for (const url of validUrls) {
          // Insert into url_inventory with QUEUED state (or update if exists)
          const result = await client.query(`
            INSERT INTO url_inventory (project_id, url, state, discovered_from, first_seen_at)
            VALUES ($1, $2, 'QUEUED', 'manual', NOW())
            ON CONFLICT (project_id, url) 
            DO UPDATE SET 
              state = CASE 
                WHEN url_inventory.state IN ('DISCOVERED', 'ERROR') THEN 'QUEUED'
                ELSE url_inventory.state 
              END,
              discovered_from = CASE 
                WHEN url_inventory.discovered_from IS NULL THEN 'manual'
                ELSE url_inventory.discovered_from 
              END
            RETURNING url, state
          `, [projectId, url]);

          const row = result.rows[0];
          
          if (row.state === 'QUEUED') {
            addedUrls.push({ url: row.url, state: row.state });
          } else {
            skippedUrls.push({ url: row.url, reason: `Already ${row.state.toLowerCase()}` });
          }
        }

        await client.query('COMMIT');

        console.log('[CrawlController] URLs added to inventory', { 
          projectId, 
          added: addedUrls.length,
          skipped: skippedUrls.length,
          invalid: invalidUrls.length,
        });

        reply.send({
          success: true,
          data: {
            added: addedUrls,
            skipped: skippedUrls,
            invalid: invalidUrls,
            summary: {
              total: urls.length,
              added: addedUrls.length,
              skipped: skippedUrls.length,
              invalid: invalidUrls.length,
            },
          },
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error: any) {
      console.error('[CrawlController] Add URLs error:', error);
      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to add URLs to crawl queue' },
      });
    }
  }
  
  /**
   * GET /projects/:id/crawl/queue
   * Get URLs in queue (QUEUED state) for a project
   */
  private async getCrawlQueue(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { limit?: number; offset?: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: projectId } = request.params;
    const limit = Math.min(request.query.limit || 50, 200);
    const offset = request.query.offset || 0;

    try {
      // Get queued URLs
      const result = await this.pool.query(`
        SELECT 
          id, url, state, discovered_from, first_seen_at, last_crawled_at
        FROM url_inventory
        WHERE project_id = $1 AND state = 'QUEUED'
        ORDER BY first_seen_at DESC
        LIMIT $2 OFFSET $3
      `, [projectId, limit, offset]);

      // Get total count
      const countResult = await this.pool.query(`
        SELECT COUNT(*) as total FROM url_inventory 
        WHERE project_id = $1 AND state = 'QUEUED'
      `, [projectId]);

      // Get stats by state
      const statsResult = await this.pool.query(`
        SELECT 
          state,
          COUNT(*) as count
        FROM url_inventory
        WHERE project_id = $1
        GROUP BY state
      `, [projectId]);

      const stats: Record<string, number> = {};
      statsResult.rows.forEach(row => {
        stats[row.state] = parseInt(row.count);
      });

      reply.send({
        success: true,
        data: {
          items: result.rows.map(row => ({
            id: row.id,
            url: row.url,
            state: row.state,
            source: row.discovered_from,
            addedAt: row.first_seen_at,
            lastCrawledAt: row.last_crawled_at,
          })),
          pagination: {
            total: parseInt(countResult.rows[0].total),
            limit,
            offset,
          },
          stats,
        },
      });

    } catch (error: any) {
      console.error('[CrawlController] Get crawl queue error:', error);
      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get crawl queue' },
      });
    }
  }
}
