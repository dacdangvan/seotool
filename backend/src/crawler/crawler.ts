/**
 * Web Crawler
 * 
 * Main crawler engine for crawling websites and extracting SEO data
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CrawlConfig,
  CrawlJob,
  CrawlProgress,
  CrawlResult,
  CrawlSummary,
  PageData,
} from './types';
import { HTMLParser } from './html-parser';
import { RobotsTxtParser } from './robots-parser';
import { UrlQueue } from './url-queue';

// Default crawl configuration
const DEFAULT_CONFIG: Partial<CrawlConfig> = {
  maxPages: 100,
  maxDepth: 3,
  requestDelay: 1000, // 1 second between requests
  timeout: 30000, // 30 seconds
  userAgent: 'VIB-SEO-Crawler/1.0 (+https://www.vib.com.vn)',
  respectRobotsTxt: true,
  sameDomainOnly: true,
};

export type CrawlEventType = 'start' | 'progress' | 'page' | 'error' | 'complete';

export interface CrawlEvent {
  type: CrawlEventType;
  data: CrawlProgress | PageData | Error | CrawlResult;
}

export type CrawlEventCallback = (event: CrawlEvent) => void;

export class WebCrawler {
  private config: CrawlConfig;
  private job: CrawlJob;
  private queue: UrlQueue;
  private robotsParser: RobotsTxtParser;
  private htmlParser: HTMLParser;
  private pages: PageData[] = [];
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private eventCallbacks: CrawlEventCallback[] = [];
  private startTime: number = 0;
  
  constructor(config: CrawlConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate base URL
    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new Error(`Invalid base URL: ${this.config.baseUrl}`);
    }
    
    // Initialize job
    this.job = {
      id: uuidv4(),
      projectId: this.config.projectId,
      config: this.config,
      status: 'pending',
      totalPages: 0,
      crawledPages: 0,
      failedPages: 0,
      createdAt: new Date(),
    };
    
    // Initialize components
    this.queue = new UrlQueue(this.config.baseUrl, {
      includePatterns: this.config.includePatterns,
      excludePatterns: this.config.excludePatterns,
      sameDomainOnly: this.config.sameDomainOnly,
    });
    
    this.robotsParser = new RobotsTxtParser();
    this.htmlParser = new HTMLParser(this.config.baseUrl);
  }
  
  /**
   * Subscribe to crawl events
   */
  on(callback: CrawlEventCallback): void {
    this.eventCallbacks.push(callback);
  }
  
  /**
   * Emit event to all subscribers
   */
  private emit(type: CrawlEventType, data: CrawlEvent['data']): void {
    const event: CrawlEvent = { type, data };
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in crawl event callback:', error);
      }
    }
  }
  
  /**
   * Start crawling
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
    
    this.emit('start', this.getProgress());
    
    try {
      // Fetch robots.txt if needed
      if (this.config.respectRobotsTxt) {
        console.log(`Fetching robots.txt from ${this.config.baseUrl}...`);
        await this.robotsParser.fetch(this.config.baseUrl);
        
        // Use crawl delay from robots.txt if larger
        const robotsDelay = this.robotsParser.getCrawlDelay();
        if (robotsDelay && robotsDelay > (this.config.requestDelay || 0)) {
          this.config.requestDelay = robotsDelay;
          console.log(`Using crawl delay from robots.txt: ${robotsDelay}ms`);
        }
      }
      
      // Add starting URL
      this.queue.add(this.config.baseUrl, 0, 10); // High priority for start URL
      
      // Main crawl loop
      while (!this.queue.isEmpty() && !this.shouldStop) {
        // Check page limit
        if (this.config.maxPages && this.job.crawledPages >= this.config.maxPages) {
          console.log(`Reached max pages limit: ${this.config.maxPages}`);
          break;
        }
        
        const queuedUrl = this.queue.next();
        if (!queuedUrl) break;
        
        // Check depth limit
        if (this.config.maxDepth !== undefined && queuedUrl.depth > this.config.maxDepth) {
          continue;
        }
        
        // Check robots.txt
        if (this.config.respectRobotsTxt && !this.robotsParser.isAllowed(queuedUrl.url)) {
          console.log(`Blocked by robots.txt: ${queuedUrl.url}`);
          continue;
        }
        
        // Crawl the page
        try {
          const pageData = await this.crawlPage(queuedUrl.url, queuedUrl.depth);
          this.pages.push(pageData);
          this.job.crawledPages++;
          this.job.totalPages = this.queue.totalSeen();
          
          this.emit('page', pageData);
          this.emit('progress', this.getProgress());
          
          // Add discovered links to queue
          for (const link of pageData.internalLinks) {
            this.queue.add(link, queuedUrl.depth + 1);
          }
          
        } catch (error) {
          this.job.failedPages++;
          console.error(`Failed to crawl ${queuedUrl.url}:`, error);
          this.emit('error', error as Error);
        }
        
        // Delay between requests
        if (this.config.requestDelay && !this.shouldStop) {
          await this.delay(this.config.requestDelay);
        }
      }
      
      // Complete
      this.job.status = this.shouldStop ? 'cancelled' : 'completed';
      this.job.completedAt = new Date();
      
      const result = this.getResult();
      this.emit('complete', result);
      
      return result;
      
    } catch (error) {
      this.job.status = 'failed';
      this.job.errorMessage = (error as Error).message;
      this.job.completedAt = new Date();
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Stop crawling
   */
  stop(): void {
    this.shouldStop = true;
  }
  
  /**
   * Get current progress
   */
  getProgress(): CrawlProgress {
    const elapsed = Date.now() - this.startTime;
    const pagesPerMinute = elapsed > 0 
      ? (this.job.crawledPages / elapsed) * 60000 
      : 0;
    
    const remaining = this.queue.size();
    const estimatedTimeRemaining = pagesPerMinute > 0 
      ? (remaining / pagesPerMinute) * 60000 
      : undefined;
    
    return {
      jobId: this.job.id,
      status: this.job.status,
      totalPages: this.job.totalPages,
      crawledPages: this.job.crawledPages,
      failedPages: this.job.failedPages,
      currentUrl: undefined,
      estimatedTimeRemaining,
      pagesPerMinute: Math.round(pagesPerMinute * 10) / 10,
    };
  }
  
  /**
   * Get crawl result
   */
  getResult(): CrawlResult {
    return {
      job: this.job,
      pages: this.pages,
      summary: this.calculateSummary(),
    };
  }
  
  /**
   * Crawl a single page
   */
  private async crawlPage(url: string, depth: number): Promise<PageData> {
    console.log(`Crawling [depth=${depth}]: ${url}`);
    
    const startTime = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent || DEFAULT_CONFIG.userAgent!,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      const html = await response.text();
      const pageSize = new TextEncoder().encode(html).length;
      
      // Handle non-HTML responses
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return {
          projectId: this.config.projectId,
          url,
          statusCode: response.status,
          responseTime,
          h1Tags: [],
          h2Tags: [],
          h3Tags: [],
          wordCount: 0,
          internalLinks: [],
          externalLinks: [],
          images: [],
          pageSize,
          crawlDepth: depth,
          crawledAt: new Date(),
          issues: [],
          contentType,
        };
      }
      
      // Parse HTML
      const pageData = this.htmlParser.parse(
        html,
        url,
        response.status,
        responseTime,
        pageSize,
        depth,
        this.config.projectId
      );
      
      // Add raw HTML content
      pageData.rawHtml = html;
      
      // Add content type and last modified
      pageData.contentType = contentType;
      pageData.lastModified = response.headers.get('last-modified') || undefined;
      
      return pageData;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout for ${url}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Calculate crawl summary
   */
  private calculateSummary(): CrawlSummary {
    const pages = this.pages;
    const totalPages = pages.length;
    
    if (totalPages === 0) {
      return {
        totalPages: 0,
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0,
        avgResponseTime: 0,
        avgWordCount: 0,
        totalInternalLinks: 0,
        totalExternalLinks: 0,
        totalImages: 0,
        imagesWithoutAlt: 0,
        pagesWithoutTitle: 0,
        pagesWithoutMetaDescription: 0,
        pagesWithoutH1: 0,
        duplicateTitles: 0,
        duplicateDescriptions: 0,
      };
    }
    
    // Count issues
    let totalIssues = 0;
    let criticalIssues = 0;
    let warnings = 0;
    
    for (const page of pages) {
      totalIssues += page.issues.length;
      criticalIssues += page.issues.filter(i => i.severity === 'critical').length;
      warnings += page.issues.filter(i => i.severity === 'warning').length;
    }
    
    // Calculate averages
    const avgResponseTime = pages.reduce((sum, p) => sum + p.responseTime, 0) / totalPages;
    const avgWordCount = pages.reduce((sum, p) => sum + p.wordCount, 0) / totalPages;
    
    // Count links and images
    const totalInternalLinks = pages.reduce((sum, p) => sum + p.internalLinks.length, 0);
    const totalExternalLinks = pages.reduce((sum, p) => sum + p.externalLinks.length, 0);
    const totalImages = pages.reduce((sum, p) => sum + p.images.length, 0);
    const imagesWithoutAlt = pages.reduce(
      (sum, p) => sum + p.images.filter(i => !i.hasAlt).length, 
      0
    );
    
    // Count missing elements
    const pagesWithoutTitle = pages.filter(p => !p.title).length;
    const pagesWithoutMetaDescription = pages.filter(p => !p.metaDescription).length;
    const pagesWithoutH1 = pages.filter(p => p.h1Tags.length === 0).length;
    
    // Find duplicates
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
    
    return {
      totalPages,
      totalIssues,
      criticalIssues,
      warnings,
      avgResponseTime: Math.round(avgResponseTime),
      avgWordCount: Math.round(avgWordCount),
      totalInternalLinks,
      totalExternalLinks,
      totalImages,
      imagesWithoutAlt,
      pagesWithoutTitle,
      pagesWithoutMetaDescription,
      pagesWithoutH1,
      duplicateTitles,
      duplicateDescriptions,
    };
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
