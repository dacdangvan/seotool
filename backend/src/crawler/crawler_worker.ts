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
import { UrlInventoryRepository } from './repositories/urlInventoryRepository';
import { PageContentRepository, NormalizedContent } from './repositories/pageContentRepository';
import { CWVRunner, selectRepresentativePages } from './cwv/cwv_runner';
import { CWVRepository } from './cwv/vitals_repository';
import { DEFAULT_CWV_CONFIG } from './cwv/cwv_types';

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
  private urlInventoryRepo: UrlInventoryRepository;
  private pageContentRepo: PageContentRepository;
  
  constructor(pool: Pool, config?: Partial<CrawlerWorkerConfig>) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
    this.urlInventoryRepo = new UrlInventoryRepository(pool);
    this.pageContentRepo = new PageContentRepository(pool);
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
      
      // CRITICAL: Seed initial URL into inventory before crawl starts
      console.log(`[CrawlerWorker] Seeding initial URL into inventory: ${baseUrl}`);
      await this.urlInventoryRepo.upsertUrl(job.projectId, baseUrl, job.id);
      
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
        storeRawHtml: true, // Enable HTML content storage for SEO analysis
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
            
            // Process page with mandatory content storage
            const pageData = event.data as PageSEOData;
            await this.processCrawledPage(job, pageData);
            
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
      
      // CRITICAL: Check that content storage matches crawled URLs before completing
      const stats = await this.urlInventoryRepo.getCrawlJobStats(job.id);
      
      if (stats.content_stored !== stats.urls_crawled) {
        const errorMsg = `Content storage validation failed: ${stats.content_stored} content stored vs ${stats.urls_crawled} URLs crawled`;
        console.error(`[CrawlerWorker] ${errorMsg}`);
        
        await this.jobService.failCrawlJob(job.id, errorMsg);
        throw new Error(errorMsg);
      }
      
      // Collect Core Web Vitals for representative pages
      console.log(`[CrawlerWorker] Starting Core Web Vitals collection...`);
      await this.collectCoreWebVitals(job, result.pages.map(p => p.url));
      
      // Complete the job only if content storage is validated
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
      
      console.log(`[CrawlerWorker] Job ${job.id} completed: ${result.summary.totalPages} pages crawled, ${stats.content_stored} content stored`);
      
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
   * Process a crawled page with mandatory content storage
   * CRITICAL: Content MUST be stored before URL is marked as CRAWLED
   */
  private async processCrawledPage(job: CrawlJob, pageData: PageSEOData): Promise<void> {
    try {
      // 1. Ensure URL exists in inventory (should already be there from discovery)
      let urlRecord = await this.urlInventoryRepo.getUrlByUrl(
        job.projectId,
        pageData.url
      );

      if (!urlRecord) {
        // URL not in inventory - this shouldn't happen but handle gracefully
        console.warn(`[CrawlerWorker] URL not found in inventory: ${pageData.url}`);
        urlRecord = await this.urlInventoryRepo.upsertUrl(
          job.projectId,
          pageData.url,
          job.id
        );
      }

      // 2. Mark URL as PROCESSING (if not already)
      if (urlRecord.state === 'DISCOVERED') {
        // Note: url_inventory doesn't have PROCESSING state, skip this step
      }

      // 3. Normalize and store content
      const contentHash = this.pageContentRepo.computeContentHash({
        url: pageData.url,
        title: pageData.title,
        meta_description: pageData.metaDescription,
        h1: pageData.h1Tags.length > 0 ? pageData.h1Tags[0] : undefined,
        h2: pageData.h2Tags,
        h3: pageData.h3Tags,
        visible_text: '',
        word_count: pageData.wordCount,
        links: {
          internal: pageData.internalLinks.map(url => ({ url, anchor_text: '', context: undefined })),
          external: pageData.externalLinks.map(url => ({ url, anchor_text: '', rel: undefined }))
        },
        structured_data: pageData.structuredData || [],
        media: {
          images: pageData.images.map(img => ({ src: img.src, alt: img.alt, context: undefined })),
          videos: []
        },
        content_structure: {
          sections: [],
          lists: [],
          tables: []
        }
      });

      const contentRecord = await this.pageContentRepo.storeContent({
        project_id: job.projectId,
        url: pageData.url,
        render_mode: 'html_only',
        title: pageData.title,
        meta_description: pageData.metaDescription,
        headings: this.extractHeadings(pageData),
        internal_links: pageData.internalLinks,
        external_links: pageData.externalLinks,
        images: pageData.images.map(img => ({ src: img.src, alt: img.alt })),
        structured_data: pageData.structuredData,
        content_text: '', // TODO: Extract visible text
        content_hash: contentHash,
        raw_html: pageData.rawHtml, // Store raw HTML for SEO analysis
      });

      // 4. ONLY after content storage succeeds, mark URL as CRAWLED
      await this.urlInventoryRepo.markCrawled(urlRecord.id!);

      console.log(`[CrawlerWorker] Processed page: ${pageData.url} (content stored)`);

    } catch (error) {
      console.error(`[CrawlerWorker] Failed to process page ${pageData.url}:`, error);
      
      // Mark URL as failed
      const urlRecord = await this.urlInventoryRepo.getUrlByUrl(
        job.projectId,
        pageData.url
      );
      
      if (urlRecord) {
        await this.urlInventoryRepo.markFailed(
          urlRecord.id!,
          error instanceof Error ? error.message : 'Content storage failed'
        );
      }
      
      throw error;
    }
  }

  /**
   * Extract headings from page data
   */
  private extractHeadings(pageData: PageSEOData): any[] {
    const headings = [];
    if (pageData.h1Tags.length > 0) {
      headings.push({ level: 1, text: pageData.h1Tags[0] });
    }
    pageData.h2Tags.forEach(h => headings.push({ level: 2, text: h }));
    pageData.h3Tags.forEach(h => headings.push({ level: 3, text: h }));
    return headings;
  }

  /**
   * Collect Core Web Vitals from GA4 instead of Playwright measurement
   * Updated to use GA4 web vitals data instead of synthetic measurements
   */
  private async collectCoreWebVitals(job: CrawlJob, crawledUrls: string[]): Promise<void> {
    try {
      console.log(`[CrawlerWorker] Collecting CWV from GA4 web vitals data`);

      // Check if GA4 is configured for this project
      const ga4Config = await this.pool.query(`
        SELECT ga4_property_id, ga4_credentials, ga4_sync_enabled
        FROM projects
        WHERE id = $1
      `, [job.projectId]);

      if (ga4Config.rows.length === 0) {
        console.log(`[CrawlerWorker] Project not found, skipping GA4 CWV sync`);
        return;
      }

      const config = ga4Config.rows[0];
      if (!config.ga4_property_id || !config.ga4_credentials || !config.ga4_sync_enabled) {
        console.log(`[CrawlerWorker] GA4 not configured or disabled, skipping CWV sync`);
        return;
      }

      // Trigger GA4 CWV sync using child process
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const workerPath = `${process.cwd()}/../workers/ga4_worker`;
      const command = `cd "${workerPath}" && npm run sync-cwv -- --project-id=${job.projectId} --days=30`;

      console.log(`[CrawlerWorker] Triggering GA4 CWV sync: ${command}`);

      // Run sync in background
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`[CrawlerWorker] GA4 CWV sync failed:`, stderr);
        } else {
          console.log(`[CrawlerWorker] GA4 CWV sync completed:`, stdout);
        }
      });

      console.log(`[CrawlerWorker] GA4 CWV sync triggered successfully`);

    } catch (error) {
      console.error(`[CrawlerWorker] Failed to trigger GA4 CWV sync:`, error);
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
}
