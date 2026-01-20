/**
 * Crawler Controller
 * 
 * API endpoints for web crawler operations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebCrawler } from './crawler';
import { CrawlRepository } from './repository';
import { CrawlConfig, CrawlJob, CrawlProgress } from './types';
import { Pool } from 'pg';

// Store active crawlers for progress tracking
const activeCrawlers = new Map<string, WebCrawler>();

interface StartCrawlBody {
  baseUrl?: string;
  maxPages?: number;
  maxDepth?: number;
  requestDelay?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

interface CrawlParams {
  projectId: string;
  jobId?: string;
}

export class CrawlerController {
  private repository: CrawlRepository;
  
  constructor(private pool: Pool) {
    this.repository = new CrawlRepository(pool);
  }
  
  /**
   * Register crawler routes
   */
  registerRoutes(fastify: FastifyInstance): void {
    // Start a new crawl
    fastify.post<{ Params: CrawlParams; Body: StartCrawlBody }>(
      '/projects/:projectId/crawl',
      {
        schema: {
          tags: ['Crawler'],
          summary: 'Start a new crawl job',
          params: {
            type: 'object',
            properties: {
              projectId: { type: 'string', format: 'uuid' },
            },
            required: ['projectId'],
          },
          body: {
            type: 'object',
            properties: {
              baseUrl: { type: 'string', format: 'uri' },
              maxPages: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
              maxDepth: { type: 'number', minimum: 0, maximum: 10, default: 3 },
              requestDelay: { type: 'number', minimum: 500, maximum: 10000, default: 1000 },
              includePatterns: { type: 'array', items: { type: 'string' } },
              excludePatterns: { type: 'array', items: { type: 'string' } },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
                status: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      this.startCrawl.bind(this)
    );
    
    // Get crawl progress
    fastify.get<{ Params: CrawlParams }>(
      '/projects/:projectId/crawl/:jobId/progress',
      {
        schema: {
          tags: ['Crawler'],
          summary: 'Get crawl job progress',
          params: {
            type: 'object',
            properties: {
              projectId: { type: 'string', format: 'uuid' },
              jobId: { type: 'string', format: 'uuid' },
            },
            required: ['projectId', 'jobId'],
          },
        },
      },
      this.getProgress.bind(this)
    );
    
    // Stop a crawl
    fastify.post<{ Params: CrawlParams }>(
      '/projects/:projectId/crawl/:jobId/stop',
      {
        schema: {
          tags: ['Crawler'],
          summary: 'Stop a running crawl job',
          params: {
            type: 'object',
            properties: {
              projectId: { type: 'string', format: 'uuid' },
              jobId: { type: 'string', format: 'uuid' },
            },
            required: ['projectId', 'jobId'],
          },
        },
      },
      this.stopCrawl.bind(this)
    );
    
    // Get crawl jobs
    fastify.get<{ Params: CrawlParams; Querystring: { limit?: number } }>(
      '/projects/:projectId/crawl/jobs',
      {
        schema: {
          tags: ['Crawler'],
          summary: 'Get crawl jobs for a project',
          params: {
            type: 'object',
            properties: {
              projectId: { type: 'string', format: 'uuid' },
            },
            required: ['projectId'],
          },
          querystring: {
            type: 'object',
            properties: {
              limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
            },
          },
        },
      },
      this.getJobs.bind(this)
    );
    
    // Get crawled pages
    fastify.get<{ 
      Params: CrawlParams; 
      Querystring: { limit?: number; offset?: number; hasIssues?: boolean; issueType?: string } 
    }>(
      '/projects/:projectId/crawl/pages',
      {
        schema: {
          tags: ['Crawler'],
          summary: 'Get crawled pages for a project',
          params: {
            type: 'object',
            properties: {
              projectId: { type: 'string', format: 'uuid' },
            },
            required: ['projectId'],
          },
          querystring: {
            type: 'object',
            properties: {
              limit: { type: 'number', minimum: 1, maximum: 500, default: 50 },
              offset: { type: 'number', minimum: 0, default: 0 },
              hasIssues: { type: 'boolean' },
              issueType: { type: 'string' },
            },
          },
        },
      },
      this.getPages.bind(this)
    );
    
    // Get crawl summary
    fastify.get<{ Params: CrawlParams }>(
      '/projects/:projectId/crawl/summary',
      {
        schema: {
          tags: ['Crawler'],
          summary: 'Get SEO crawl summary for a project',
          params: {
            type: 'object',
            properties: {
              projectId: { type: 'string', format: 'uuid' },
            },
            required: ['projectId'],
          },
        },
      },
      this.getSummary.bind(this)
    );
  }
  
  /**
   * Start a new crawl job
   */
  private async startCrawl(
    request: FastifyRequest<{ Params: CrawlParams; Body: StartCrawlBody }>,
    reply: FastifyReply
  ): Promise<void> {
    const { projectId } = request.params;
    const body = request.body || {};
    
    // Get project to find domain
    const projectResult = await this.pool.query(
      'SELECT domain FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      reply.status(404).send({ error: 'Project not found' });
      return;
    }
    
    const domain = projectResult.rows[0].domain;
    const baseUrl = body.baseUrl || `https://${domain}`;
    
    // Check if there's already an active crawl
    for (const [jobId, crawler] of activeCrawlers.entries()) {
      const progress = crawler.getProgress();
      if (progress.status === 'running') {
        reply.status(409).send({ 
          error: 'A crawl is already running', 
          jobId,
          progress 
        });
        return;
      }
    }
    
    // Create crawler config
    const config: CrawlConfig = {
      baseUrl,
      projectId,
      maxPages: body.maxPages || 100,
      maxDepth: body.maxDepth || 3,
      requestDelay: body.requestDelay || 1000,
      includePatterns: body.includePatterns,
      excludePatterns: body.excludePatterns,
      respectRobotsTxt: true,
      sameDomainOnly: true,
    };
    
    // Create and start crawler
    const crawler = new WebCrawler(config);
    const progress = crawler.getProgress();
    activeCrawlers.set(progress.jobId, crawler);
    
    // Subscribe to events
    crawler.on(async (event) => {
      if (event.type === 'complete') {
        const result = event.data as { job: CrawlJob; pages: unknown[] };
        // Save job and pages to database
        await this.repository.saveJob(result.job);
        await this.repository.savePages(result.pages as any[]);
        // Remove from active crawlers
        activeCrawlers.delete(progress.jobId);
      } else if (event.type === 'error') {
        console.error('Crawl error:', event.data);
      }
    });
    
    // Start crawl in background
    crawler.start().catch(error => {
      console.error('Crawl failed:', error);
      activeCrawlers.delete(progress.jobId);
    });
    
    reply.send({
      jobId: progress.jobId,
      status: 'started',
      message: `Crawling started for ${baseUrl}`,
    });
  }
  
  /**
   * Get crawl progress
   */
  private async getProgress(
    request: FastifyRequest<{ Params: CrawlParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const { jobId } = request.params;
    
    if (!jobId) {
      reply.status(400).send({ error: 'Job ID required' });
      return;
    }
    
    // Check active crawlers first
    const crawler = activeCrawlers.get(jobId);
    if (crawler) {
      reply.send(crawler.getProgress());
      return;
    }
    
    // Check database for completed jobs
    const job = await this.repository.getJob(jobId);
    if (job) {
      reply.send({
        jobId: job.id,
        status: job.status,
        totalPages: job.totalPages,
        crawledPages: job.crawledPages,
        failedPages: job.failedPages,
      } as CrawlProgress);
      return;
    }
    
    reply.status(404).send({ error: 'Crawl job not found' });
  }
  
  /**
   * Stop a crawl
   */
  private async stopCrawl(
    request: FastifyRequest<{ Params: CrawlParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const { jobId } = request.params;
    
    if (!jobId) {
      reply.status(400).send({ error: 'Job ID required' });
      return;
    }
    
    const crawler = activeCrawlers.get(jobId);
    if (!crawler) {
      reply.status(404).send({ error: 'Active crawl job not found' });
      return;
    }
    
    crawler.stop();
    reply.send({ status: 'stopping', message: 'Crawl stop requested' });
  }
  
  /**
   * Get crawl jobs
   */
  private async getJobs(
    request: FastifyRequest<{ Params: CrawlParams; Querystring: { limit?: number } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { projectId } = request.params;
    const { limit = 10 } = request.query;
    
    const jobs = await this.repository.getJobsByProject(projectId, limit);
    
    // Add any active jobs
    for (const [_, crawler] of activeCrawlers.entries()) {
      const progress = crawler.getProgress();
      if (progress.status === 'running') {
        const result = crawler.getResult();
        if (result.job.projectId === projectId) {
          jobs.unshift(result.job);
        }
      }
    }
    
    reply.send(jobs);
  }
  
  /**
   * Get crawled pages
   */
  private async getPages(
    request: FastifyRequest<{ 
      Params: CrawlParams; 
      Querystring: { limit?: number; offset?: number; hasIssues?: boolean; issueType?: string } 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { projectId } = request.params;
    const { limit = 50, offset = 0, hasIssues, issueType } = request.query;
    
    const pages = await this.repository.getPages(projectId, {
      limit,
      offset,
      hasIssues,
      issueType,
    });
    
    reply.send(pages);
  }
  
  /**
   * Get crawl summary
   */
  private async getSummary(
    request: FastifyRequest<{ Params: CrawlParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const { projectId } = request.params;
    
    const summary = await this.repository.getSummary(projectId);
    
    if (!summary) {
      reply.send({
        totalPages: 0,
        message: 'No crawl data available. Start a crawl to collect SEO data.',
      });
      return;
    }
    
    reply.send(summary);
  }
}
