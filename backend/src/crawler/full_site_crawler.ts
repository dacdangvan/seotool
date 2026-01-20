/**
 * Full Site Crawler
 * 
 * Enhanced crawler with:
 * - Sitemap-first discovery
 * - Hybrid URL discovery (sitemap + links)
 * - Progress tracking
 * - Safety mechanisms
 */

import { CrawlConfig, DEFAULT_CRAWL_CONFIG, getCrawlConfig, CrawlPreset } from './crawl_config';
import { SitemapParser } from './sitemap_parser';
import { UrlFrontier, FrontierStats } from './url_frontier';
import { RateLimiter } from './rate_limiter';
import { RobotsParser } from './robots';
import { PageFetcher, FetchResult } from './fetcher';
import { LinkExtractor } from './link_extractor';
import { PageAnalyzer } from './analyzer';
import { PageSEOData, CrawlConfig as ModelCrawlConfig } from './models';

export interface CrawlProgress {
  status: 'not_started' | 'initializing' | 'crawling' | 'completed' | 'failed' | 'cancelled';
  totalUrlsDiscovered: number;
  pagesCrawled: number;
  pagesFailed: number;
  pagesSkipped: number;
  progressPercent: number;
  currentUrl?: string;
  errorRate: number;
  elapsedTimeMs: number;
  estimatedRemainingMs?: number;
}

export interface FullCrawlResult {
  success: boolean;
  domain: string;
  pages: PageSEOData[];
  progress: CrawlProgress;
  frontierStats: FrontierStats;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

export interface CrawlCallbacks {
  onProgress?: (progress: CrawlProgress) => void;
  onPageCrawled?: (page: PageSEOData) => void;
  onError?: (url: string, error: string) => void;
}

export class FullSiteCrawler {
  private config: CrawlConfig;
  private modelConfig: ModelCrawlConfig;
  private domain: string;
  private baseUrl: string;
  private projectId: string;
  private rateLimiter: RateLimiter;
  private sitemapParser: SitemapParser;
  private frontier: UrlFrontier;
  private robotsParser: RobotsParser;
  private fetcher: PageFetcher;
  private linkExtractor: LinkExtractor;
  private analyzer: PageAnalyzer;

  private crawledPages: PageSEOData[] = [];
  private errors: string[] = [];
  private progress: CrawlProgress;
  private startTime: Date = new Date();
  private cancelled = false;
  private consecutiveErrors = 0;

  constructor(
    domain: string,
    projectId: string,
    configOrPreset: Partial<CrawlConfig> | CrawlPreset = 'standard'
  ) {
    this.domain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '');
    this.baseUrl = `https://${this.domain}`;
    this.projectId = projectId;
    
    // Get crawl config
    if (typeof configOrPreset === 'string') {
      this.config = getCrawlConfig(configOrPreset);
    } else {
      this.config = getCrawlConfig('custom', configOrPreset);
    }

    // Create model config for existing components
    this.modelConfig = {
      baseUrl: this.baseUrl,
      projectId: this.projectId,
      maxPages: this.config.maxPages,
      maxDepth: this.config.maxDepth,
      requestDelay: this.config.rateLimit,
      timeout: this.config.timeout,
      userAgent: this.config.userAgent,
      respectRobotsTxt: true,
      sameDomainOnly: true,
      retryCount: 2,
      backoffDelay: 2000,
    };

    // Initialize components
    this.rateLimiter = new RateLimiter({ minDelay: this.config.rateLimit });
    
    this.sitemapParser = new SitemapParser({
      rateLimiter: this.rateLimiter,
      maxSitemaps: this.config.maxSitemaps,
      timeout: this.config.sitemapTimeout,
      userAgent: this.config.userAgent,
    });

    this.frontier = new UrlFrontier(this.domain);
    this.robotsParser = new RobotsParser(this.baseUrl);
    this.fetcher = new PageFetcher(this.modelConfig);
    this.linkExtractor = new LinkExtractor(this.baseUrl);
    this.analyzer = new PageAnalyzer(this.baseUrl);

    // Initialize progress
    this.progress = {
      status: 'not_started',
      totalUrlsDiscovered: 0,
      pagesCrawled: 0,
      pagesFailed: 0,
      pagesSkipped: 0,
      progressPercent: 0,
      errorRate: 0,
      elapsedTimeMs: 0,
    };
  }

  /**
   * Execute full site crawl
   */
  async crawl(callbacks?: CrawlCallbacks): Promise<FullCrawlResult> {
    this.startTime = new Date();
    this.cancelled = false;
    this.crawledPages = [];
    this.errors = [];
    this.consecutiveErrors = 0;

    try {
      // Phase 1: Initialize
      this.updateProgress('initializing', callbacks?.onProgress);
      console.log(`[FullSiteCrawler] Starting crawl of ${this.domain}`);

      // Load robots.txt
      if (this.config.respectRobotsTxt) {
        await this.robotsParser.fetch(this.config.userAgent);
        console.log(`[FullSiteCrawler] Loaded robots.txt`);
      }

      // Phase 2: Discover URLs from sitemap
      if (this.config.useSitemap) {
        await this.discoverFromSitemap();
      }

      // Add homepage as seed if frontier is empty
      if (!this.frontier.hasMore()) {
        this.frontier.addSeed(`https://${this.domain}/`);
        this.frontier.addSeed(`https://www.${this.domain}/`);
      }

      this.progress.totalUrlsDiscovered = this.frontier.size();
      console.log(`[FullSiteCrawler] Total URLs in frontier: ${this.frontier.size()}`);

      // Phase 3: Crawl pages
      this.updateProgress('crawling', callbacks?.onProgress);
      await this.crawlPages(callbacks);

      // Phase 4: Complete
      this.updateProgress(this.cancelled ? 'cancelled' : 'completed', callbacks?.onProgress);
      
    } catch (error) {
      console.error(`[FullSiteCrawler] Crawl failed:`, error);
      this.errors.push(`Crawl failed: ${error}`);
      this.updateProgress('failed', callbacks?.onProgress);
    }

    const endTime = new Date();

    return {
      success: this.progress.status === 'completed',
      domain: this.domain,
      pages: this.crawledPages,
      progress: this.progress,
      frontierStats: this.frontier.getStats(),
      errors: this.errors,
      startTime: this.startTime,
      endTime,
    };
  }

  /**
   * Cancel the crawl
   */
  cancel(): void {
    this.cancelled = true;
    console.log(`[FullSiteCrawler] Crawl cancellation requested`);
  }

  /**
   * Discover URLs from sitemap
   */
  private async discoverFromSitemap(): Promise<void> {
    console.log(`[FullSiteCrawler] Discovering URLs from sitemap...`);
    
    const sitemapResult = await this.sitemapParser.parseAllSitemaps(this.domain);
    
    if (sitemapResult.urls.length > 0) {
      // Filter URLs through robots.txt
      const allowedUrls = sitemapResult.urls.filter(u => 
        this.robotsParser.isAllowed(u.loc)
      );
      
      console.log(`[FullSiteCrawler] Sitemap: ${sitemapResult.urls.length} URLs found, ${allowedUrls.length} allowed by robots.txt`);
      
      this.frontier.addFromSitemap(allowedUrls);
    }

    if (sitemapResult.errors.length > 0) {
      this.errors.push(...sitemapResult.errors);
    }
  }

  /**
   * Main crawl loop
   */
  private async crawlPages(callbacks?: CrawlCallbacks): Promise<void> {
    while (
      this.frontier.hasMore() &&
      this.progress.pagesCrawled < this.config.maxPages &&
      !this.cancelled &&
      !this.shouldAbortDueToErrors()
    ) {
      const urlItem = this.frontier.getNext();
      if (!urlItem) break;

      // Check depth limit
      if (urlItem.depth > this.config.maxDepth) {
        this.progress.pagesSkipped++;
        continue;
      }

      // Check robots.txt
      if (this.config.respectRobotsTxt && !this.robotsParser.isAllowed(urlItem.url)) {
        this.progress.pagesSkipped++;
        continue;
      }

      // Wait for rate limiter
      await this.rateLimiter.wait();

      // Crawl the page
      this.progress.currentUrl = urlItem.url;
      
      try {
        const pageData = await this.crawlSinglePage(urlItem.url, urlItem.depth);
        
        if (pageData) {
          this.crawledPages.push(pageData);
          this.progress.pagesCrawled++;
          this.consecutiveErrors = 0;
          
          callbacks?.onPageCrawled?.(pageData);

          // Discover new URLs from page links
          if (this.config.followLinks && urlItem.depth < this.config.maxDepth) {
            this.discoverLinks(pageData, urlItem.depth);
          }
        } else {
          this.progress.pagesFailed++;
        }
      } catch (error) {
        this.progress.pagesFailed++;
        this.consecutiveErrors++;
        const errorMsg = `Failed to crawl ${urlItem.url}: ${error}`;
        this.errors.push(errorMsg);
        callbacks?.onError?.(urlItem.url, String(error));
      }

      // Update progress
      this.updateProgress('crawling', callbacks?.onProgress);

      // Log progress every 10 pages
      if (this.progress.pagesCrawled % 10 === 0) {
        console.log(`[FullSiteCrawler] Progress: ${this.progress.pagesCrawled}/${this.config.maxPages} pages, ${this.frontier.size()} in queue`);
      }
    }

    console.log(`[FullSiteCrawler] Crawl loop ended. Pages: ${this.progress.pagesCrawled}, Failed: ${this.progress.pagesFailed}`);
  }

  /**
   * Crawl a single page
   */
  private async crawlSinglePage(url: string, depth: number): Promise<PageSEOData | null> {
    try {
      const fetchResult = await this.fetcher.fetch(url);
      
      // Check if we got valid HTML
      if (fetchResult.statusCode >= 400 || !fetchResult.html) {
        return null;
      }

      // Analyze SEO
      const seoData = this.analyzer.analyze(
        fetchResult,
        this.projectId,
        depth,
        false // don't store raw HTML
      );
      
      return seoData;
    } catch (error) {
      console.error(`[FullSiteCrawler] Error crawling ${url}:`, error);
      return null;
    }
  }

  /**
   * Discover links from a crawled page
   */
  private discoverLinks(pageData: PageSEOData, currentDepth: number): void {
    // Use internal links from SEO data
    const links = pageData.internalLinks || [];
    
    let addedCount = 0;
    for (const link of links) {
      if (this.frontier.addDiscovered(link, currentDepth + 1, pageData.url)) {
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this.progress.totalUrlsDiscovered = this.frontier.getStats().totalDiscovered;
    }
  }

  /**
   * Check if we should abort due to high error rate
   */
  private shouldAbortDueToErrors(): boolean {
    const totalAttempts = this.progress.pagesCrawled + this.progress.pagesFailed;
    
    // Check consecutive errors
    if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      console.warn(`[FullSiteCrawler] Aborting: ${this.consecutiveErrors} consecutive errors`);
      this.errors.push(`Aborted: Too many consecutive errors (${this.consecutiveErrors})`);
      return true;
    }

    // Check error rate after minimum pages
    if (totalAttempts >= this.config.minPagesForErrorCheck) {
      const errorRate = this.progress.pagesFailed / totalAttempts;
      if (errorRate > this.config.maxErrorRate) {
        console.warn(`[FullSiteCrawler] Aborting: Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold`);
        this.errors.push(`Aborted: Error rate too high (${(errorRate * 100).toFixed(1)}%)`);
        return true;
      }
    }

    return false;
  }

  /**
   * Update progress state
   */
  private updateProgress(
    status: CrawlProgress['status'],
    callback?: (progress: CrawlProgress) => void
  ): void {
    const totalAttempts = this.progress.pagesCrawled + this.progress.pagesFailed;
    const targetPages = Math.min(this.config.maxPages, this.progress.totalUrlsDiscovered || this.config.maxPages);

    this.progress.status = status;
    this.progress.elapsedTimeMs = Date.now() - this.startTime.getTime();
    this.progress.errorRate = totalAttempts > 0 ? this.progress.pagesFailed / totalAttempts : 0;
    this.progress.progressPercent = targetPages > 0 
      ? Math.round((this.progress.pagesCrawled / targetPages) * 100)
      : 0;

    // Estimate remaining time
    if (this.progress.pagesCrawled > 0 && status === 'crawling') {
      const avgTimePerPage = this.progress.elapsedTimeMs / this.progress.pagesCrawled;
      const remainingPages = targetPages - this.progress.pagesCrawled;
      this.progress.estimatedRemainingMs = Math.round(avgTimePerPage * remainingPages);
    }

    callback?.(this.progress);
  }

  /**
   * Get current progress
   */
  getProgress(): CrawlProgress {
    return { ...this.progress };
  }

  /**
   * Get crawled pages
   */
  getCrawledPages(): PageSEOData[] {
    return [...this.crawledPages];
  }
}

export default FullSiteCrawler;
