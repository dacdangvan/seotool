/**
 * Crawler Worker
 * 
 * Executes crawl jobs in background
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * Features:
 * - Accepts project_id & domain
 * - Crawls all public pages (respects robots.txt)
 * - Reports progress after each page batch
 * - Graceful stop & retry
 * - Rate-limited crawling
 */

import { Pool } from 'pg';
import { SEOCrawler } from './seo_crawler';
import { CrawlJobService } from './crawl_job.service';
import { CrawlJob, CrawlProgressUpdate } from './crawl_job.types';
import { CrawlResult, PageSEOData } from './models';

export interface CrawlerWorkerConfig {
  /** Batch size for progress reporting */
  progressBatchSize: number;
  /** Save pages to database */
  savePagesToDb: boolean;
}

const DEFAULT_WORKER_CONFIG: CrawlerWorkerConfig = {
  progressBatchSize: 5,
  savePagesToDb: true,
};

export class CrawlerWorker {
  private pool: Pool;
  private jobService: CrawlJobService;
  private config: CrawlerWorkerConfig;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private currentCrawler: SEOCrawler | null = null;
  
  constructor(pool: Pool, config?: Partial<CrawlerWorkerConfig>) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
  }
  
  /**
   * Execute a crawl job
   */
  async executeJob(job: CrawlJob): Promise<CrawlResult> {
    if (this.isRunning) {
      throw new Error('Worker is already running a job');
    }
    
    this.isRunning = true;
    this.shouldStop = false;
    
    console.log(`[CrawlerWorker] Starting job ${job.id} for project ${job.projectId}`);
    
    try {
      // Get project domain
      const projectResult = await this.pool.query(
        'SELECT domain FROM projects WHERE id = $1',
        [job.projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error(`Project ${job.projectId} not found`);
      }
      
      const domain = projectResult.rows[0].domain;
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      
      // Mark job as started
      await this.jobService.startCrawlJob(job.id);
      
      // Create crawler instance
      this.currentCrawler = new SEOCrawler({
        baseUrl,
        projectId: job.projectId,
        maxPages: job.config.maxPages,
        maxDepth: job.config.maxDepth,
        requestDelay: job.config.requestDelay,
        timeout: job.config.timeout,
        userAgent: job.config.userAgent,
        storeRawHtml: false,
      });
      
      // Track progress
      let pagesProcessed = 0;
      let lastReportedProgress = 0;
      
      // Subscribe to crawler events
      this.currentCrawler.on(async (event) => {
        if (this.shouldStop) {
          this.currentCrawler?.stop();
          return;
        }
        
        switch (event.type) {
          case 'crawl:page':
            pagesProcessed++;
            
            // Save page to database
            if (this.config.savePagesToDb) {
              await this.savePageToDb(job.projectId, event.data as PageSEOData);
            }
            
            // Report progress periodically
            if (pagesProcessed % this.config.progressBatchSize === 0) {
              const progress = Math.min(
                Math.round((pagesProcessed / job.config.maxPages) * 100),
                99
              );
              
              if (progress > lastReportedProgress) {
                lastReportedProgress = progress;
                await this.reportProgress(job.id, {
                  progress,
                  crawledPages: pagesProcessed,
                  failedPages: 0,
                  skippedPages: 0,
                  totalUrlsDiscovered: 0,
                });
              }
            }
            break;
            
          case 'crawl:error':
            await this.jobService.addJobLog(
              job.id,
              'error',
              `Crawl error: ${(event.data as Error).message}`
            );
            break;
            
          case 'crawl:skip':
            const skipData = event.data as { url: string; reason: string };
            await this.jobService.addJobLog(
              job.id,
              'debug',
              `Skipped: ${skipData.url} - ${skipData.reason}`
            );
            break;
        }
      });
      
      // Run the crawl
      const result = await this.currentCrawler.start();
      
      // Complete the job
      await this.jobService.completeCrawlJob(job.id, {
        totalPages: result.summary.totalPages,
        successfulPages: result.summary.successfulPages,
        failedPages: result.summary.failedPages,
        skippedPages: result.summary.skippedPages,
        duration: result.summary.totalCrawlTime,
        avgResponseTime: result.summary.avgResponseTime,
        issuesCount: result.summary.totalIssues,
        criticalIssues: result.summary.criticalIssues,
      });
      
      console.log(`[CrawlerWorker] Job ${job.id} completed: ${result.summary.totalPages} pages crawled`);
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.jobService.failCrawlJob(job.id, errorMessage);
      
      console.error(`[CrawlerWorker] Job ${job.id} failed:`, error);
      
      throw error;
      
    } finally {
      this.isRunning = false;
      this.currentCrawler = null;
    }
  }
  
  /**
   * Stop current crawl gracefully
   */
  stop(): void {
    console.log('[CrawlerWorker] Stop requested');
    this.shouldStop = true;
    this.currentCrawler?.stop();
  }
  
  /**
   * Check if worker is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }
  
  /**
   * Report progress to job service
   */
  private async reportProgress(jobId: string, update: Omit<CrawlProgressUpdate, 'jobId'>): Promise<void> {
    await this.jobService.updateProgress({
      jobId,
      ...update,
    });
    
    console.log(`[CrawlerWorker] Progress: ${update.progress}% (${update.crawledPages} pages)`);
  }
  
  /**
   * Save crawled page to database
   */
  private async savePageToDb(projectId: string, page: PageSEOData): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO crawled_pages (
          id, project_id, url, canonical_url, status_code, response_time,
          title, meta_description, meta_robots, h1_tags, h2_tags, h3_tags,
          word_count, internal_links, external_links, images, page_size,
          crawl_depth, issues, crawled_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, NOW()
        )
        ON CONFLICT (project_id, url) DO UPDATE SET
          canonical_url = EXCLUDED.canonical_url,
          status_code = EXCLUDED.status_code,
          response_time = EXCLUDED.response_time,
          title = EXCLUDED.title,
          meta_description = EXCLUDED.meta_description,
          meta_robots = EXCLUDED.meta_robots,
          h1_tags = EXCLUDED.h1_tags,
          h2_tags = EXCLUDED.h2_tags,
          h3_tags = EXCLUDED.h3_tags,
          word_count = EXCLUDED.word_count,
          internal_links = EXCLUDED.internal_links,
          external_links = EXCLUDED.external_links,
          images = EXCLUDED.images,
          page_size = EXCLUDED.page_size,
          crawl_depth = EXCLUDED.crawl_depth,
          issues = EXCLUDED.issues,
          crawled_at = NOW()`,
        [
          projectId,
          page.url,
          page.canonicalUrl || null,
          page.statusCode,
          page.responseTime,
          page.title,
          page.metaDescription,
          page.metaRobots,
          JSON.stringify(page.h1Tags),
          JSON.stringify(page.h2Tags),
          JSON.stringify(page.h3Tags),
          page.wordCount,
          JSON.stringify(page.internalLinks),
          JSON.stringify(page.externalLinks),
          JSON.stringify(page.images),
          page.contentLength,
          0, // depth - not tracked in PageSEOData
          JSON.stringify(page.issues),
        ]
      );
    } catch (error) {
      console.error(`[CrawlerWorker] Failed to save page ${page.url}:`, error);
      // Don't throw - continue crawling
    }
  }
}
