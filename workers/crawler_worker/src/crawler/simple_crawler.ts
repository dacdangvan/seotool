/**
 * Simple SEO Crawler - Lightweight implementation for standalone worker
 */
import * as cheerio from 'cheerio';
import { CrawlJobConfig } from '../types.js';

export interface PageSEOData {
  url: string;
  statusCode: number;
  responseTime: number;
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  wordCount: number;
  internalLinks: string[];
  externalLinks: string[];
  images: { src: string; alt?: string }[];
  structuredData: any[];
  rawHtml?: string;
  contentText?: string; // Pure text content extracted from visible elements
  hasNoindex: boolean;
  hasNofollow: boolean;
}

export interface CrawlResult {
  pages: PageSEOData[];
  summary: {
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    skippedPages: number;
    totalCrawlTime: number;
    avgResponseTime: number;
    totalIssues: number;
    criticalIssues: number;
  };
}

export class SimpleCrawler {
  private config: CrawlJobConfig;
  private baseUrl: string;
  private projectId: string;
  private seenUrls: Set<string> = new Set();
  private pages: PageSEOData[] = [];
  private queue: { url: string; depth: number }[] = [];
  private isRunning = false;
  private shouldStop = false;
  
  private onPageCallback?: (page: PageSEOData) => Promise<void>;

  constructor(config: CrawlJobConfig & { baseUrl: string; projectId: string }) {
    this.config = config;
    this.baseUrl = config.baseUrl;
    this.projectId = config.projectId;
  }

  onPage(callback: (page: PageSEOData) => Promise<void>): void {
    this.onPageCallback = callback;
  }

  async start(): Promise<CrawlResult> {
    this.isRunning = true;
    this.shouldStop = false;
    const startTime = Date.now();

    // Add starting URL
    this.addToQueue(this.baseUrl, 0);

    // Crawl loop
    while (!this.shouldStop && this.queue.length > 0 && this.pages.length < this.config.maxPages) {
      const item = this.queue.shift();
      if (!item) break;

      if (item.depth > this.config.maxDepth) continue;

      try {
        const page = await this.crawlPage(item.url);
        if (page) {
          this.pages.push(page);
          
          // Notify callback
          if (this.onPageCallback) {
            await this.onPageCallback(page);
          }

          // Extract and queue links
          for (const link of page.internalLinks) {
            this.addToQueue(link, item.depth + 1);
          }
        }
      } catch (error) {
        console.error(`[Crawler] Error crawling ${item.url}:`, error);
      }

      // Rate limiting
      await this.sleep(this.config.requestDelay);
    }

    this.isRunning = false;

    const totalTime = Date.now() - startTime;
    const avgResponseTime = this.pages.length > 0
      ? this.pages.reduce((sum, p) => sum + p.responseTime, 0) / this.pages.length
      : 0;

    return {
      pages: this.pages,
      summary: {
        totalPages: this.pages.length,
        successfulPages: this.pages.filter(p => p.statusCode >= 200 && p.statusCode < 400).length,
        failedPages: this.pages.filter(p => p.statusCode >= 400).length,
        skippedPages: 0,
        totalCrawlTime: totalTime,
        avgResponseTime,
        totalIssues: 0,
        criticalIssues: 0,
      },
    };
  }

  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Add multiple URLs to the crawl queue (for manually queued URLs)
   * These URLs will be crawled with depth 0 (same priority as initial URL)
   */
  addUrlsToQueue(urls: string[]): void {
    for (const url of urls) {
      this.addToQueue(url, 0);
    }
    console.log(`[Crawler] Added ${urls.length} queued URLs to crawl queue`);
  }

  private addToQueue(url: string, depth: number): void {
    const normalized = this.normalizeUrl(url);
    if (!normalized || this.seenUrls.has(normalized)) return;

    // Check if same domain
    try {
      const baseHost = new URL(this.baseUrl).hostname;
      const urlHost = new URL(normalized).hostname;
      if (this.config.sameDomainOnly && baseHost !== urlHost) return;
    } catch {
      return;
    }

    this.seenUrls.add(normalized);
    this.queue.push({ url: normalized, depth });
  }

  private async crawlPage(url: string): Promise<PageSEOData | null> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return null;
      }

      const html = await response.text();
      const responseTime = Date.now() - startTime;

      return this.parsePage(url, response.status, html, responseTime);
    } catch (error) {
      console.error(`[Crawler] Fetch error for ${url}:`, error);
      return null;
    }
  }

  private parsePage(url: string, statusCode: number, html: string, responseTime: number): PageSEOData {
    const $ = cheerio.load(html);

    // Extract meta robots
    const metaRobots = $('meta[name="robots"]').attr('content') || '';
    const hasNoindex = metaRobots.toLowerCase().includes('noindex');
    const hasNofollow = metaRobots.toLowerCase().includes('nofollow');

    // Extract headings
    const h1Tags = $('h1').map((_, el) => $(el).text().trim()).get();
    const h2Tags = $('h2').map((_, el) => $(el).text().trim()).get();
    const h3Tags = $('h3').map((_, el) => $(el).text().trim()).get();

    // Extract links
    const baseHost = new URL(this.baseUrl).hostname;
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const resolved = new URL(href, url).href;
        const linkHost = new URL(resolved).hostname;
        
        if (linkHost === baseHost) {
          internalLinks.push(resolved);
        } else {
          externalLinks.push(resolved);
        }
      } catch {}
    });

    // Extract images
    const images = $('img').map((_, el) => ({
      src: $(el).attr('src') || '',
      alt: $(el).attr('alt'),
    })).get();

    // Extract structured data
    const structuredData: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        structuredData.push(JSON.parse($(el).html() || ''));
      } catch {}
    });

    // Extract visible text content (removing scripts, styles, etc.)
    const contentText = this.extractVisibleText($);
    
    // Word count
    const wordCount = contentText.split(/\s+/).filter(w => w.length > 0).length;

    return {
      url,
      statusCode,
      responseTime,
      title: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content'),
      canonicalUrl: $('link[rel="canonical"]').attr('href'),
      h1Tags,
      h2Tags,
      h3Tags,
      wordCount,
      internalLinks: [...new Set(internalLinks)],
      externalLinks: [...new Set(externalLinks)],
      images,
      structuredData,
      rawHtml: html, // Always store raw HTML for content analysis
      contentText, // Pure text content for SEO analysis
      hasNoindex,
      hasNofollow,
    };
  }

  /**
   * Extract visible text from HTML, removing scripts, styles, and other non-content elements
   */
  private extractVisibleText($: cheerio.CheerioAPI): string {
    // Remove non-visible elements
    $('script, style, noscript, iframe, svg, head, nav, footer, header').remove();
    $('[style*="display: none"], [style*="display:none"], [hidden]').remove();
    
    // Get text from body
    const body = $('body');
    if (!body.length) return '';
    
    // Extract text from main content areas first, fallback to body
    const mainContent = $('main, article, [role="main"], .content, #content').first();
    const textSource = mainContent.length ? mainContent : body;
    
    // Get text and clean it
    let text = textSource.text();
    
    // Normalize whitespace
    text = text
      .replace(/[\t\n\r]+/g, ' ')  // Replace tabs/newlines with space
      .replace(/\s{2,}/g, ' ')      // Collapse multiple spaces
      .trim();
    
    return text;
  }

  private normalizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url, this.baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      
      // Remove fragment and normalize
      parsed.hash = '';
      return parsed.href.replace(/\/+$/, '') || parsed.href;
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
