/**
 * Crawler Worker - Executes crawl jobs
 */
import { Pool } from 'pg';
import { CrawlJobService } from '../services/crawl_job.service.js';
import { UrlInventoryRepository } from '../repositories/url_inventory.repository.js';
import { PageContentRepository } from '../repositories/page_content.repository.js';
import { SimpleCrawler, PageSEOData, CrawlResult } from './simple_crawler.js';
import { CrawlJob, CrawlProgressUpdate } from '../types.js';

export class CrawlerWorker {
  private pool: Pool;
  private jobService: CrawlJobService;
  private urlInventoryRepo: UrlInventoryRepository;
  private pageContentRepo: PageContentRepository;
  private isRunning = false;
  private shouldStop = false;
  private currentCrawler: SimpleCrawler | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
    this.jobService = new CrawlJobService(pool);
    this.urlInventoryRepo = new UrlInventoryRepository(pool);
    this.pageContentRepo = new PageContentRepository(pool);
  }

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

      // Seed initial URL
      console.log(`[CrawlerWorker] Seeding initial URL: ${baseUrl}`);
      await this.urlInventoryRepo.upsertUrl(job.projectId, baseUrl, job.id);

      // Get QUEUED URLs (manually added URLs pending crawl)
      const queuedUrls = await this.urlInventoryRepo.getQueuedUrls(job.projectId);
      if (queuedUrls.length > 0) {
        console.log(`[CrawlerWorker] Found ${queuedUrls.length} queued URLs to crawl`);
      }

      // Mark job as started
      await this.jobService.startCrawlJob(job.id);

      // Create crawler
      this.currentCrawler = new SimpleCrawler({
        ...job.config,
        baseUrl,
        projectId: job.projectId,
      });

      // Add queued URLs to crawler queue
      if (queuedUrls.length > 0) {
        const urlStrings = queuedUrls.map(u => u.url);
        this.currentCrawler.addUrlsToQueue(urlStrings);
      }

      let pagesProcessed = 0;

      // Process each page
      this.currentCrawler.onPage(async (pageData: PageSEOData) => {
        pagesProcessed++;
        await this.processPage(job, pageData);

        // Report progress
        if (pagesProcessed % 5 === 0) {
          const progress = Math.min(Math.round((pagesProcessed / job.config.maxPages) * 100), 99);
          await this.reportProgress(job.id, {
            jobId: job.id,
            progress,
            crawledPages: pagesProcessed,
            failedPages: 0,
            skippedPages: 0,
            totalUrlsDiscovered: 0,
          });
        }
      });

      // Run crawl
      const result = await this.currentCrawler.start();

      // Complete job
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

      console.log(`[CrawlerWorker] Job ${job.id} completed: ${result.summary.totalPages} pages`);
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

  private async processPage(job: CrawlJob, pageData: PageSEOData): Promise<void> {
    try {
      // Debug log
      console.log(`[CrawlerWorker] Processing ${pageData.url} - Title: "${pageData.title?.substring(0, 50) || '(empty)'}", Status: ${pageData.statusCode}`);
      
      // Upsert URL
      let urlRecord = await this.urlInventoryRepo.getUrlByUrl(job.projectId, pageData.url);
      if (!urlRecord) {
        urlRecord = await this.urlInventoryRepo.upsertUrl(job.projectId, pageData.url, job.id);
      }

      // Compute content hash
      const contentHash = this.pageContentRepo.computeContentHash({
        title: pageData.title,
        meta_description: pageData.metaDescription,
        headings: pageData.h1Tags.map(t => ({ level: 1, text: t })),
      });

      // Store content
      await this.pageContentRepo.storeContent({
        project_id: job.projectId,
        url: pageData.url,
        render_mode: 'html_only',
        title: pageData.title,
        meta_description: pageData.metaDescription,
        headings: [
          ...pageData.h1Tags.map(t => ({ level: 1, text: t })),
          ...pageData.h2Tags.map(t => ({ level: 2, text: t })),
          ...pageData.h3Tags.map(t => ({ level: 3, text: t })),
        ],
        internal_links: pageData.internalLinks,
        external_links: pageData.externalLinks,
        images: pageData.images,
        structured_data: pageData.structuredData,
        content_hash: contentHash,
        content_text: pageData.contentText,
        raw_html: pageData.rawHtml,
        http_status: pageData.statusCode,
        response_time_ms: pageData.responseTime,
        load_time_ms: pageData.responseTime, // Use responseTime as loadTime for now
      });

      // Mark URL as crawled
      if (urlRecord.id) {
        await this.urlInventoryRepo.markCrawled(urlRecord.id, pageData.statusCode, contentHash);
      }

      console.log(`[CrawlerWorker] Processed: ${pageData.url}`);
    } catch (error) {
      console.error(`[CrawlerWorker] Failed to process ${pageData.url}:`, error);
    }
  }

  private async reportProgress(jobId: string, update: CrawlProgressUpdate): Promise<void> {
    await this.jobService.updateProgress(update);
    console.log(`[CrawlerWorker] Progress: ${update.progress}% (${update.crawledPages} pages)`);
  }

  stop(): void {
    this.shouldStop = true;
    this.currentCrawler?.stop();
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
