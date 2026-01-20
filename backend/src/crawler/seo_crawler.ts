/**
 * SEO-safe Web Crawler
 * 
 * Main crawler engine for www.vib.com.vn
 * Following AI_SEO_TOOL_PROMPT_BOOK.md strictly
 * 
 * LEGAL & SAFETY REQUIREMENTS:
 * - Respects robots.txt strictly ✓
 * - Crawls public HTML pages only ✓
 * - No form submission ✓
 * - No authentication ✓
 * - No PII extraction ✓
 * - Rate-limited crawling ✓
 * - SEO audit use only ✓
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CrawlConfig,
  CrawlJob,
  CrawlProgress,
  CrawlResult,
  CrawlSummary,
  CrawlStatus,
  PageSEOData,
  QueuedUrl,
  CrawlEvent,
  CrawlEventCallback,
  DEFAULT_CRAWL_CONFIG,
  SEOIssueType,
} from './models';
import { RobotsParser } from './robots';
import { RateLimiter } from './rate_limiter';
import { PageFetcher, FetchResult } from './fetcher';
import { LinkExtractor } from './link_extractor';
import { PageAnalyzer } from './analyzer';

export class SEOCrawler {
  private config: CrawlConfig;
  private job: CrawlJob;
  
  // Components
  private robotsParser: RobotsParser;
  private rateLimiter: RateLimiter;
  private fetcher: PageFetcher;
  private linkExtractor: LinkExtractor;
  private analyzer: PageAnalyzer;
  
  // State
  private queue: QueuedUrl[] = [];
  private seenUrls: Set<string> = new Set();
  private pages: PageSEOData[] = [];
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private startTime: number = 0;
  
  // Event handling
  private eventCallbacks: CrawlEventCallback[] = [];
  
  constructor(config: Partial<CrawlConfig> & { baseUrl: string; projectId: string }) {
    // Merge with defaults, enforce safety constraints
    this.config = {
      ...DEFAULT_CRAWL_CONFIG,
      ...config,
      respectRobotsTxt: true, // MANDATORY
      sameDomainOnly: true,   // MANDATORY
    };
    
    // Validate configuration
    this.validateConfig();
    
    // Initialize job
    this.job = {
      id: uuidv4(),
      projectId: this.config.projectId,
      config: this.config,
      status: 'pending',
      totalUrlsDiscovered: 0,
      crawledPages: 0,
      failedPages: 0,
      skippedPages: 0,
      createdAt: new Date(),
    };
    
    // Initialize components
    this.robotsParser = new RobotsParser(this.config.baseUrl);
    this.rateLimiter = new RateLimiter({
      minDelay: this.config.requestDelay,
    });
    this.fetcher = new PageFetcher(this.config);
    this.linkExtractor = new LinkExtractor(this.config.baseUrl);
    this.analyzer = new PageAnalyzer(this.config.baseUrl);
    
    console.log(`[Crawler] Initialized for ${this.config.baseUrl}`);
    console.log(`[Crawler] Max pages: ${this.config.maxPages}, Max depth: ${this.config.maxDepth}`);
  }
  
  /**
   * Subscribe to crawl events
   */
  on(callback: CrawlEventCallback): void {
    this.eventCallbacks.push(callback);
  }
  
  /**
   * Start the crawl
   */
  async start(): Promise<CrawlResult> {
    if (this.isRunning) {
      throw new Error('Crawler is already running');
    }
    
    this.isRunning = true;
    this.shouldStop = false;
    this.startTime = Date.now();
    this.job.status = 'running';
    this.job.startedAt = new Date();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Crawler] Starting crawl of ${this.config.baseUrl}`);
    console.log(`${'='.repeat(60)}\n`);
    
    this.emit('crawl:start', this.getProgress());
    
    try {
      // STEP 1: Fetch and parse robots.txt (MANDATORY)
      console.log(`[Crawler] Step 1: Fetching robots.txt...`);
      await this.robotsParser.fetch(this.config.userAgent);
      
      // Apply crawl delay from robots.txt
      const robotsDelay = this.robotsParser.getCrawlDelay();
      if (robotsDelay > this.config.requestDelay) {
        console.log(`[Crawler] Respecting robots.txt crawl-delay: ${robotsDelay}ms`);
        this.rateLimiter.setMinDelayFromRobots(robotsDelay);
      }
      
      // STEP 2: Add starting URL to queue
      console.log(`[Crawler] Step 2: Adding starting URL to queue...`);
      this.addToQueue(this.config.baseUrl, 0, 100); // Highest priority
      
      // STEP 3: Main crawl loop
      console.log(`[Crawler] Step 3: Starting crawl loop...\n`);
      
      while (!this.shouldStop && this.queue.length > 0) {
        // Check page limit
        if (this.job.crawledPages >= this.config.maxPages) {
          console.log(`\n[Crawler] Reached max pages limit (${this.config.maxPages})`);
          break;
        }
        
        // Get next URL from queue
        const queueItem = this.queue.shift();
        if (!queueItem) break;
        
        // Check depth limit
        if (queueItem.depth > this.config.maxDepth) {
          this.job.skippedPages++;
          this.emit('crawl:skip', { url: queueItem.url, reason: 'Exceeds max depth' });
          continue;
        }
        
        // Check robots.txt (MANDATORY)
        if (!this.robotsParser.isAllowed(queueItem.url, this.config.userAgent)) {
          this.job.skippedPages++;
          this.emit('crawl:skip', { url: queueItem.url, reason: 'Blocked by robots.txt' });
          continue;
        }
        
        // Wait for rate limiter
        await this.rateLimiter.wait();
        
        // Crawl the page
        const success = await this.crawlPage(queueItem);
        
        if (success) {
          this.rateLimiter.reportSuccess();
        } else {
          this.rateLimiter.reportFailure();
        }
        
        // Emit progress
        this.emit('crawl:progress', this.getProgress());
      }
      
      // Complete
      this.job.status = this.shouldStop ? 'cancelled' : 'completed';
      this.job.completedAt = new Date();
      
      const result = this.buildResult();
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[Crawler] Crawl ${this.job.status}`);
      console.log(`[Crawler] Pages: ${this.job.crawledPages} crawled, ${this.job.failedPages} failed, ${this.job.skippedPages} skipped`);
      console.log(`[Crawler] Duration: ${((Date.now() - this.startTime) / 1000).toFixed(1)}s`);
      console.log(`${'='.repeat(60)}\n`);
      
      this.emit('crawl:complete', result);
      
      return result;
      
    } catch (error) {
      this.job.status = 'failed';
      this.job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.job.completedAt = new Date();
      
      console.error(`[Crawler] Crawl failed:`, error);
      this.emit('crawl:error', error as Error);
      
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Stop the crawl gracefully
   */
  stop(): void {
    console.log(`[Crawler] Stop requested...`);
    this.shouldStop = true;
    this.emit('crawl:cancel', this.getProgress());
  }
  
  /**
   * Get current progress
   */
  getProgress(): CrawlProgress {
    const elapsed = Date.now() - this.startTime;
    const pagesPerMinute = elapsed > 0 
      ? (this.job.crawledPages / elapsed) * 60000 
      : 0;
    
    return {
      jobId: this.job.id,
      status: this.job.status,
      totalUrlsDiscovered: this.job.totalUrlsDiscovered,
      crawledPages: this.job.crawledPages,
      failedPages: this.job.failedPages,
      skippedPages: this.job.skippedPages,
      queueSize: this.queue.length,
      pagesPerMinute: Math.round(pagesPerMinute * 10) / 10,
      elapsedTime: elapsed,
      estimatedTimeRemaining: pagesPerMinute > 0
        ? Math.round((this.queue.length / pagesPerMinute) * 60000)
        : undefined,
    };
  }
  
  /**
   * Get the job ID
   */
  getJobId(): string {
    return this.job.id;
  }
  
  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  
  /**
   * Validate configuration
   */
  private validateConfig(): void {
    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new Error(`Invalid base URL: ${this.config.baseUrl}`);
    }
    
    if (this.config.maxPages < 1 || this.config.maxPages > 10000) {
      throw new Error('maxPages must be between 1 and 10000');
    }
    
    if (this.config.maxDepth < 0 || this.config.maxDepth > 10) {
      throw new Error('maxDepth must be between 0 and 10');
    }
    
    if (this.config.requestDelay < 500) {
      console.warn('[Crawler] requestDelay too low, setting to 500ms minimum');
      this.config.requestDelay = 500;
    }
  }
  
  /**
   * Add URL to crawl queue
   */
  private addToQueue(url: string, depth: number, priority: number = 0): boolean {
    // Normalize URL
    const normalized = this.linkExtractor.normalizeUrl(url, this.config.baseUrl);
    if (!normalized) return false;
    
    // Check if already seen
    if (this.seenUrls.has(normalized)) return false;
    
    // Check if internal
    if (!this.linkExtractor.isInternalUrl(normalized)) return false;
    
    // Add to seen and queue
    this.seenUrls.add(normalized);
    this.job.totalUrlsDiscovered++;
    
    this.queue.push({
      url: normalized,
      depth,
      priority,
      addedAt: new Date(),
    });
    
    // Sort queue by priority (descending) then depth (ascending)
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.depth - b.depth;
    });
    
    return true;
  }
  
  /**
   * Crawl a single page
   */
  private async crawlPage(queueItem: QueuedUrl): Promise<boolean> {
    const { url, depth } = queueItem;
    
    console.log(`[Crawl] [${this.job.crawledPages + 1}/${this.config.maxPages}] [depth=${depth}] ${url}`);
    
    try {
      // Fetch the page
      const fetchResult = await this.fetcher.fetch(url);
      
      // Check if we should analyze this page
      if (!this.fetcher.isHtmlResponse(fetchResult)) {
        console.log(`[Crawl] Skipping non-HTML: ${fetchResult.contentType}`);
        this.job.skippedPages++;
        return true;
      }
      
      // Analyze the page
      const pageData = this.analyzer.analyze(
        fetchResult,
        this.config.projectId,
        depth,
        this.config.storeRawHtml
      );
      
      // Extract and queue internal links
      const links = this.linkExtractor.extract(fetchResult.html, url);
      pageData.internalLinks = links.internal.map(l => l.url);
      pageData.internalLinksCount = pageData.internalLinks.length;
      pageData.externalLinks = links.external.map(l => l.url);
      pageData.externalLinksCount = pageData.externalLinks.length;
      
      // Add discovered internal links to queue
      for (const link of links.internal) {
        this.addToQueue(link.url, depth + 1, this.calculateLinkPriority(link.url));
      }
      
      // Store page data
      this.pages.push(pageData);
      this.job.crawledPages++;
      
      // Emit page event
      this.emit('crawl:page', pageData);
      
      // Log issues summary
      if (pageData.issues.length > 0) {
        const critical = pageData.issues.filter(i => i.severity === 'critical').length;
        const warnings = pageData.issues.filter(i => i.severity === 'warning').length;
        console.log(`[Crawl] Issues: ${critical} critical, ${warnings} warnings`);
      }
      
      return true;
      
    } catch (error) {
      console.error(`[Crawl] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      this.job.failedPages++;
      this.emit('crawl:error', error as Error);
      return false;
    }
  }
  
  /**
   * Calculate link priority based on URL pattern
   */
  private calculateLinkPriority(url: string): number {
    let priority = 50; // Default
    
    // Higher priority for main sections
    if (url.match(/\/(san-pham|the-tin-dung|vay|tai-khoan|tiet-kiem)/i)) {
      priority = 80;
    }
    
    // Lower priority for utility pages
    if (url.match(/\/(sitemap|lien-he|dieu-khoan|chinh-sach)/i)) {
      priority = 30;
    }
    
    // Very low priority for paginated/filtered URLs
    if (url.includes('page=') || url.includes('filter=')) {
      priority = 10;
    }
    
    return priority;
  }
  
  /**
   * Build final crawl result
   */
  private buildResult(): CrawlResult {
    return {
      job: this.job,
      pages: this.pages,
      summary: this.calculateSummary(),
      robotsTxt: this.robotsParser.getData() || undefined,
    };
  }
  
  /**
   * Calculate crawl summary statistics
   */
  private calculateSummary(): CrawlSummary {
    const pages = this.pages;
    const totalPages = pages.length;
    
    if (totalPages === 0) {
      return this.createEmptySummary();
    }
    
    // Timing stats
    const responseTimes = pages.map(p => p.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / totalPages;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    // Content stats
    const avgWordCount = pages.reduce((sum, p) => sum + p.wordCount, 0) / totalPages;
    const avgContentLength = pages.reduce((sum, p) => sum + p.contentLength, 0) / totalPages;
    
    // Link stats
    const totalInternalLinks = pages.reduce((sum, p) => sum + p.internalLinksCount, 0);
    const totalExternalLinks = pages.reduce((sum, p) => sum + p.externalLinksCount, 0);
    const uniqueInternalLinks = this.seenUrls.size;
    
    // Image stats
    const totalImages = pages.reduce((sum, p) => sum + p.imagesCount, 0);
    const imagesWithoutAlt = pages.reduce((sum, p) => sum + p.imagesWithoutAlt, 0);
    const altTextCoverage = totalImages > 0 
      ? Math.round(((totalImages - imagesWithoutAlt) / totalImages) * 100) 
      : 100;
    
    // Issue stats
    let totalIssues = 0;
    let criticalIssues = 0;
    let warningIssues = 0;
    let infoIssues = 0;
    const issuesByType = new Map<SEOIssueType, number>();
    
    for (const page of pages) {
      for (const issue of page.issues) {
        totalIssues++;
        issuesByType.set(issue.type, (issuesByType.get(issue.type) || 0) + 1);
        
        switch (issue.severity) {
          case 'critical': criticalIssues++; break;
          case 'warning': warningIssues++; break;
          case 'info': infoIssues++; break;
        }
      }
    }
    
    // Content issues
    const pagesWithoutTitle = pages.filter(p => !p.title).length;
    const pagesWithoutMetaDescription = pages.filter(p => !p.metaDescription).length;
    const pagesWithoutH1 = pages.filter(p => p.h1Count === 0).length;
    const pagesWithMultipleH1 = pages.filter(p => p.h1Count > 1).length;
    const pagesWithThinContent = pages.filter(p => p.wordCount < 300).length;
    const pagesWithNoindex = pages.filter(p => p.hasNoindex).length;
    
    // Duplicates
    const titleCounts = new Map<string, number>();
    const descCounts = new Map<string, number>();
    
    for (const page of pages) {
      if (page.title) {
        titleCounts.set(page.title, (titleCounts.get(page.title) || 0) + 1);
      }
      if (page.metaDescription) {
        descCounts.set(page.metaDescription, (descCounts.get(page.metaDescription) || 0) + 1);
      }
    }
    
    const duplicateTitles = [...titleCounts.values()].filter(c => c > 1).length;
    const duplicateDescriptions = [...descCounts.values()].filter(c => c > 1).length;
    
    // Status code distribution
    const statusCodeDistribution = new Map<number, number>();
    for (const page of pages) {
      statusCodeDistribution.set(
        page.statusCode, 
        (statusCodeDistribution.get(page.statusCode) || 0) + 1
      );
    }
    
    return {
      totalPages,
      successfulPages: pages.filter(p => p.statusCode >= 200 && p.statusCode < 300).length,
      failedPages: this.job.failedPages,
      skippedPages: this.job.skippedPages,
      totalCrawlTime: Date.now() - this.startTime,
      avgResponseTime: Math.round(avgResponseTime),
      maxResponseTime,
      minResponseTime,
      avgWordCount: Math.round(avgWordCount),
      avgContentLength: Math.round(avgContentLength),
      totalInternalLinks,
      totalExternalLinks,
      uniqueInternalLinks,
      totalImages,
      imagesWithoutAlt,
      altTextCoverage,
      totalIssues,
      criticalIssues,
      warningIssues,
      infoIssues,
      issuesByType,
      pagesWithoutTitle,
      pagesWithoutMetaDescription,
      pagesWithoutH1,
      pagesWithMultipleH1,
      pagesWithThinContent,
      pagesWithNoindex,
      duplicateTitles,
      duplicateDescriptions,
      statusCodeDistribution,
    };
  }
  
  /**
   * Create empty summary
   */
  private createEmptySummary(): CrawlSummary {
    return {
      totalPages: 0,
      successfulPages: 0,
      failedPages: 0,
      skippedPages: 0,
      totalCrawlTime: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      avgWordCount: 0,
      avgContentLength: 0,
      totalInternalLinks: 0,
      totalExternalLinks: 0,
      uniqueInternalLinks: 0,
      totalImages: 0,
      imagesWithoutAlt: 0,
      altTextCoverage: 100,
      totalIssues: 0,
      criticalIssues: 0,
      warningIssues: 0,
      infoIssues: 0,
      issuesByType: new Map(),
      pagesWithoutTitle: 0,
      pagesWithoutMetaDescription: 0,
      pagesWithoutH1: 0,
      pagesWithMultipleH1: 0,
      pagesWithThinContent: 0,
      pagesWithNoindex: 0,
      duplicateTitles: 0,
      duplicateDescriptions: 0,
      statusCodeDistribution: new Map(),
    };
  }
  
  /**
   * Emit crawl event
   */
  private emit(type: CrawlEvent['type'], data: CrawlEvent['data']): void {
    const event: CrawlEvent = {
      type,
      timestamp: new Date(),
      data,
    };
    
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[Crawler] Error in event callback:', error);
      }
    }
  }
}

// Export for convenience
export { CrawlConfig, CrawlResult, CrawlSummary, PageSEOData } from './models';
