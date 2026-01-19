/**
 * Page Crawler
 * Crawls websites respecting robots.txt and rate limits
 */

import * as cheerio from 'cheerio';
import { chromium, Browser } from 'playwright';
import { RateLimiter } from './rate_limiter';
import { RobotsChecker } from './robots_parser';
import { RenderMode, CrawledPage, CrawlResult, CrawlError } from '../models';
import { Logger } from '../logger';

// =============================================================================
// TYPES
// =============================================================================

export interface CrawlerOptions {
  userAgent: string;
  timeout: number;
  maxPages: number;
  crawlDepth: number;
  renderMode: RenderMode;
  respectRobotsTxt: boolean;
  rateLimit: RateLimiter;
  robotsChecker: RobotsChecker | null;
}

export interface PageContent {
  url: string;
  statusCode: number;
  html: string;
  headers: Record<string, string>;
  loadTimeMs: number;
  redirectChain: string[];
}

// =============================================================================
// PAGE CRAWLER
// =============================================================================

export class PageCrawler {
  private visited = new Set<string>();
  private discovered = new Set<string>();
  private queue: Array<{ url: string; depth: number }> = [];
  private browser: Browser | null = null;

  constructor(
    private readonly options: CrawlerOptions,
    private readonly logger: Logger
  ) {}

  /**
   * Crawl a website starting from the given URL
   */
  async crawl(startUrl: string): Promise<CrawlResult> {
    const startTime = Date.now();
    const pages: CrawledPage[] = [];
    const errors: CrawlError[] = [];

    // Initialize browser if JS rendering is needed
    if (this.options.renderMode === RenderMode.JS) {
      this.browser = await chromium.launch({ headless: true });
    }

    try {
      // Start with the initial URL
      const normalizedStart = this.normalizeUrl(startUrl);
      this.queue.push({ url: normalizedStart, depth: 0 });
      this.discovered.add(normalizedStart);

      while (this.queue.length > 0 && pages.length < this.options.maxPages) {
        const { url, depth } = this.queue.shift()!;

        // Skip if already visited
        if (this.visited.has(url)) {
          continue;
        }

        // Check robots.txt
        if (this.options.respectRobotsTxt && this.options.robotsChecker) {
          if (!this.options.robotsChecker.isAllowed(url)) {
            this.logger.debug({ url }, 'URL blocked by robots.txt');
            continue;
          }
        }

        this.visited.add(url);

        try {
          // Apply rate limiting and fetch page
          const rawContent = await this.options.rateLimit.execute(
            () => this.fetchPage(url)
          );

          // Parse HTML into CrawledPage
          const crawledPage = this.parsePageContent(rawContent, depth);
          pages.push(crawledPage);
          
          this.logger.debug({ 
            url, 
            statusCode: crawledPage.statusCode,
            responseTimeMs: crawledPage.responseTimeMs 
          }, 'Page crawled');

          // Extract and queue links if within depth
          if (depth < this.options.crawlDepth) {
            const allLinks = [...crawledPage.internalLinks];
            for (const link of allLinks) {
              const normalized = this.normalizeUrl(link);
              if (!this.visited.has(normalized) && 
                  !this.discovered.has(normalized) &&
                  this.isSameDomain(normalized, startUrl)) {
                this.queue.push({ url: normalized, depth: depth + 1 });
                this.discovered.add(normalized);
              }
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ url, error: errorMsg });
          this.logger.warn({ url, error: errorMsg }, 'Failed to crawl page');
        }
      }
    } finally {
      // Cleanup browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }

    return {
      startUrl,
      pages,
      robotsTxt: null, // Will be filled by audit_runner
      crawlDurationMs: Date.now() - startTime,
      pagesFound: this.discovered.size,
      pagesCrawled: pages.length,
      errors,
    };
  }

  /**
   * Parse raw page content into CrawledPage
   */
  private parsePageContent(raw: PageContent, depth: number): CrawledPage {
    const $ = cheerio.load(raw.html);
    const baseUrl = raw.url;

    // Extract title
    const title = $('title').first().text().trim() || null;

    // Extract meta description
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;

    // Extract meta robots
    const metaRobots = $('meta[name="robots"]').attr('content')?.trim() || null;

    // Extract canonical URL
    const canonicalHref = $('link[rel="canonical"]').attr('href');
    const canonicalUrl = canonicalHref 
      ? this.resolveUrl(canonicalHref, baseUrl) 
      : null;

    // Extract headings
    const h1: string[] = [];
    const h2: string[] = [];
    const h3: string[] = [];
    
    $('h1').each((_, el) => {
      const text = $(el).text().trim();
      if (text) h1.push(text);
    });
    $('h2').each((_, el) => {
      const text = $(el).text().trim();
      if (text) h2.push(text);
    });
    $('h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text) h3.push(text);
    });

    // Extract links
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const baseHost = new URL(baseUrl).hostname;

    $('a[href]').each((_, el) => {
      try {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
          return;
        }

        const absoluteUrl = this.resolveUrl(href, baseUrl);
        if (!absoluteUrl) return;

        const linkHost = new URL(absoluteUrl).hostname;
        if (linkHost === baseHost) {
          if (!internalLinks.includes(absoluteUrl)) {
            internalLinks.push(absoluteUrl);
          }
        } else {
          if (!externalLinks.includes(absoluteUrl)) {
            externalLinks.push(absoluteUrl);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    });

    // Get content type
    const contentType = raw.headers['content-type'] || 'text/html';

    return {
      url: raw.url,
      statusCode: raw.statusCode,
      contentType,
      html: raw.html,
      title,
      metaDescription,
      metaRobots,
      canonicalUrl,
      h1,
      h2,
      h3,
      internalLinks,
      externalLinks,
      responseTimeMs: raw.loadTimeMs,
      contentLength: raw.html.length,
      depth,
      crawledAt: new Date().toISOString(),
    };
  }

  /**
   * Resolve a URL against a base URL
   */
  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return null;
    }
  }

  /**
   * Fetch a single page
   */
  private async fetchPage(url: string): Promise<PageContent> {
    const startTime = Date.now();
    const redirectChain: string[] = [];

    if (this.options.renderMode === RenderMode.JS && this.browser) {
      return this.fetchPageWithBrowser(url, startTime);
    }

    return this.fetchPageWithFetch(url, startTime, redirectChain);
  }

  /**
   * Fetch page using native fetch (HTML mode)
   */
  private async fetchPageWithFetch(
    url: string,
    startTime: number,
    redirectChain: string[]
  ): Promise<PageContent> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      // Manual redirect handling to track redirect chain
      let currentUrl = url;
      let response: Response;
      let redirectCount = 0;
      const MAX_REDIRECTS = 10;

      while (redirectCount < MAX_REDIRECTS) {
        response = await fetch(currentUrl, {
          headers: {
            'User-Agent': this.options.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          redirect: 'manual',
          signal: controller.signal,
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            redirectChain.push(currentUrl);
            currentUrl = new URL(location, currentUrl).href;
            redirectCount++;
            continue;
          }
        }
        break;
      }

      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error('Too many redirects');
      }

      const html = await response!.text();
      const headers: Record<string, string> = {};
      response!.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        url: currentUrl,
        statusCode: response!.status,
        html,
        headers,
        loadTimeMs: Date.now() - startTime,
        redirectChain,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch page using Playwright (JS mode)
   */
  private async fetchPageWithBrowser(
    url: string,
    startTime: number
  ): Promise<PageContent> {
    const page = await this.browser!.newPage();
    const redirectChain: string[] = [];

    try {
      // Track redirects
      page.on('response', (response) => {
        if (response.status() >= 300 && response.status() < 400) {
          redirectChain.push(response.url());
        }
      });

      await page.setExtraHTTPHeaders({
        'User-Agent': this.options.userAgent,
        'Accept-Language': 'en-US,en;q=0.5',
      });

      const response = await page.goto(url, {
        timeout: this.options.timeout,
        waitUntil: 'networkidle',
      });

      const html = await page.content();
      const headers: Record<string, string> = {};
      const responseHeaders = response?.headers() || {};
      Object.entries(responseHeaders).forEach(([key, value]) => {
        headers[key] = value;
      });

      return {
        url: page.url(),
        statusCode: response?.status() || 0,
        html,
        headers,
        loadTimeMs: Date.now() - startTime,
        redirectChain,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Normalize URL for consistent comparison
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash, fragment, and normalize
      parsed.hash = '';
      let path = parsed.pathname;
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      parsed.pathname = path;
      return parsed.href;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is on the same domain as the start URL
   */
  private isSameDomain(url: string, startUrl: string): boolean {
    try {
      const urlHost = new URL(url).hostname;
      const startHost = new URL(startUrl).hostname;
      return urlHost === startHost;
    } catch {
      return false;
    }
  }
}
