/**
 * URL Discovery Engine
 * 
 * Core implementation of Section 11 – Auto URL Discovery & Full SEO Crawl Pipeline
 * 
 * § 11.1 Core Principle:
 * SEO crawling MUST follow this order:
 * 1. Discover all valid public URLs
 * 2. Build a canonical URL graph
 * 3. Crawl each URL with SEO-ready validation
 * 4. Store and analyze SEO signals
 * 
 * § 11.2 URL Discovery Sources (MANDATORY):
 * 1. Homepage Crawl
 * 2. Recursive Internal Link Discovery
 * 3. Sitemap Discovery (If Available)
 * 4. Rendered DOM Link Extraction
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6
 */

import { Page } from 'playwright';
import {
  UrlDiscoveryConfig,
  UrlInventoryEntry,
  UrlDiscoverySource,
  UrlDiscoveryResult,
  UrlDiscoveryPhase,
  UrlDiscoveryStats,
  DiscoveryError,
  DEFAULT_DISCOVERY_CONFIG,
  DEFAULT_NORMALIZATION_CONFIG,
  DEFAULT_SCOPE_CONFIG,
} from './types';
import { UrlNormalizer } from './url_normalizer';
import { IUrlInventoryStore, InMemoryUrlInventoryStore } from './url_inventory_store';

// Import existing crawler utilities
import { SitemapParser, SitemapUrl } from '../sitemap_parser';
import { RateLimiter } from '../rate_limiter';
import { getJsRenderEngine } from '../js-render';

export interface UrlDiscoveryEngineConfig {
  config: UrlDiscoveryConfig;
  store?: IUrlInventoryStore;
  onProgress?: (stats: UrlDiscoveryStats) => void;
  onUrlDiscovered?: (entry: UrlInventoryEntry) => void;
  onError?: (error: DiscoveryError) => void;
}

export class UrlDiscoveryEngine {
  private config: UrlDiscoveryConfig;
  private store: IUrlInventoryStore;
  private normalizer: UrlNormalizer;
  private rateLimiter: RateLimiter;
  private sitemapParser: SitemapParser;
  private phase: UrlDiscoveryPhase = 'INITIALIZING';
  private startedAt: Date;
  private errors: DiscoveryError[] = [];
  private robotsTxt: string | null = null;
  private sitemapUrls: string[] = [];
  private aborted = false;

  // Callbacks
  private onProgress?: (stats: UrlDiscoveryStats) => void;
  private onUrlDiscovered?: (entry: UrlInventoryEntry) => void;
  private onError?: (error: DiscoveryError) => void;

  constructor(options: UrlDiscoveryEngineConfig) {
    this.config = this.mergeConfig(options.config);
    this.store = options.store || new InMemoryUrlInventoryStore();
    this.normalizer = new UrlNormalizer(this.config.seedUrl, this.config.normalization);
    this.startedAt = new Date();

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      minDelay: Math.floor(60000 / this.config.scope.maxUrlsPerMinute), // Convert to delay
    });

    // Initialize sitemap parser
    this.sitemapParser = new SitemapParser({
      rateLimiter: this.rateLimiter,
      timeout: this.config.timeout,
      userAgent: this.config.userAgent,
    });

    // Callbacks
    this.onProgress = options.onProgress;
    this.onUrlDiscovered = options.onUrlDiscovered;
    this.onError = options.onError;
  }

  /**
   * Merge config with defaults
   */
  private mergeConfig(config: UrlDiscoveryConfig): UrlDiscoveryConfig {
    return {
      ...DEFAULT_DISCOVERY_CONFIG,
      ...config,
      normalization: {
        ...DEFAULT_NORMALIZATION_CONFIG,
        ...config.normalization,
      },
      scope: {
        ...DEFAULT_SCOPE_CONFIG,
        ...config.scope,
      },
    } as UrlDiscoveryConfig;
  }

  /**
   * § 11.1 Start URL Discovery Pipeline
   */
  async discover(): Promise<UrlDiscoveryResult> {
    console.log(`[UrlDiscoveryEngine] Starting discovery for ${this.config.seedUrl}`);
    this.phase = 'INITIALIZING';
    this.startedAt = new Date();

    try {
      // Step 1: Add seed URL
      this.addSeedUrl();

      // Step 2: Sitemap Discovery (§ 11.2.3)
      if (this.config.useSitemap) {
        await this.discoverFromSitemap();
      }

      // Step 3: Homepage Crawl (§ 11.2.1)
      await this.crawlHomepage();

      // Step 4: Recursive Internal Link Discovery (§ 11.2.2)
      await this.discoverInternalLinks();

      this.phase = 'COMPLETED';
      console.log(`[UrlDiscoveryEngine] Discovery completed. Total URLs: ${this.store.count()}`);

    } catch (error) {
      this.phase = 'FAILED';
      this.recordError(this.config.seedUrl, `Discovery failed: ${error}`, this.phase);
      console.error(`[UrlDiscoveryEngine] Discovery failed:`, error);
    }

    return this.buildResult();
  }

  /**
   * Add seed URL to inventory
   */
  private addSeedUrl(): void {
    const normalizedUrl = this.normalizer.normalize(this.config.seedUrl);
    if (!normalizedUrl) {
      throw new Error(`Invalid seed URL: ${this.config.seedUrl}`);
    }

    const entry = this.store.add({
      originalUrl: this.config.seedUrl,
      normalizedUrl,
      state: 'QUEUED_FOR_CRAWL',
      source: 'SEED',
      depth: 0,
      parentUrl: null,
      canonicalUrl: null,
    });

    if (entry) {
      this.onUrlDiscovered?.(entry);
      this.emitProgress();
    }
  }

  /**
   * § 11.2.3 Sitemap Discovery
   */
  private async discoverFromSitemap(): Promise<void> {
    this.phase = 'SITEMAP_DISCOVERY';
    console.log(`[UrlDiscoveryEngine] Starting sitemap discovery...`);

    try {
      // Discover sitemaps from robots.txt
      this.sitemapUrls = await this.sitemapParser.discoverSitemapsFromRobots(this.config.domain);
      console.log(`[UrlDiscoveryEngine] Found ${this.sitemapUrls.length} sitemaps`);

      // If no sitemaps in robots.txt, try default locations
      if (this.sitemapUrls.length === 0) {
        const defaultSitemaps = [
          `https://${this.config.domain}/sitemap.xml`,
          `https://${this.config.domain}/sitemap_index.xml`,
        ];
        
        for (const url of defaultSitemaps) {
          try {
            const result = await this.sitemapParser.parseSitemap(url);
            if (result.urls.length > 0) {
              this.sitemapUrls.push(url);
            }
          } catch {
            // Sitemap doesn't exist, continue
          }
        }
      }

      // Parse all sitemaps and add URLs
      for (const sitemapUrl of this.sitemapUrls) {
        if (this.aborted) break;
        
        try {
          const result = await this.sitemapParser.parseSitemap(sitemapUrl);
          console.log(`[UrlDiscoveryEngine] Parsed ${result.urls.length} URLs from ${sitemapUrl}`);

          for (const sitemapEntry of result.urls) {
            this.addDiscoveredUrl(sitemapEntry.loc, 'SITEMAP', null, 1);
          }
        } catch (error) {
          this.recordError(sitemapUrl, `Sitemap parse error: ${error}`, this.phase);
        }
      }

      this.emitProgress();
    } catch (error) {
      this.recordError(this.config.domain, `Sitemap discovery error: ${error}`, this.phase);
    }
  }

  /**
   * § 11.2.1 Homepage Crawl
   */
  private async crawlHomepage(): Promise<void> {
    this.phase = 'HOMEPAGE_CRAWL';
    console.log(`[UrlDiscoveryEngine] Crawling homepage...`);

    try {
      const links = await this.extractLinksFromPage(this.config.seedUrl, 0);
      
      for (const link of links) {
        this.addDiscoveredUrl(link.url, 'HOMEPAGE', this.config.seedUrl, 1);
      }

      // Mark seed as crawled
      this.store.updateState(
        this.normalizer.normalize(this.config.seedUrl)!,
        'CRAWLED',
        { lastCrawledAt: new Date() }
      );

      this.emitProgress();
    } catch (error) {
      this.recordError(this.config.seedUrl, `Homepage crawl error: ${error}`, this.phase);
    }
  }

  /**
   * § 11.2.2 Recursive Internal Link Discovery (BFS)
   */
  private async discoverInternalLinks(): Promise<void> {
    this.phase = 'LINK_DISCOVERY';
    console.log(`[UrlDiscoveryEngine] Starting recursive link discovery...`);

    let processed = 0;
    const maxUrls = this.config.scope.maxUrls;
    const maxDepth = this.config.scope.maxDepth;

    while (!this.aborted) {
      // Get next URL from queue
      const entry = this.store.getNextToCrawl();
      if (!entry) {
        console.log(`[UrlDiscoveryEngine] No more URLs in queue`);
        break;
      }

      // Check limits
      if (processed >= maxUrls) {
        console.log(`[UrlDiscoveryEngine] Reached max URL limit: ${maxUrls}`);
        break;
      }

      if (entry.depth >= maxDepth) {
        this.store.updateState(entry.normalizedUrl, 'BLOCKED_BY_POLICY', {
          blockReason: `Exceeded max depth: ${maxDepth}`,
        });
        continue;
      }

      // Apply rate limiting
      await this.rateLimiter.wait();

      try {
        // Extract links from page
        const links = await this.extractLinksFromPage(entry.normalizedUrl, entry.depth);
        
        // Add discovered links
        for (const link of links) {
          this.addDiscoveredUrl(
            link.url,
            link.fromRenderedDom ? 'RENDERED_DOM' : 'INTERNAL_LINK',
            entry.normalizedUrl,
            entry.depth + 1
          );
        }

        // Mark as crawled
        this.store.updateState(entry.normalizedUrl, 'CRAWLED', {
          lastCrawledAt: new Date(),
          crawlAttempts: entry.crawlAttempts + 1,
        });

        processed++;

        // Progress update every 10 URLs
        if (processed % 10 === 0) {
          this.emitProgress();
          console.log(`[UrlDiscoveryEngine] Processed ${processed} URLs, discovered ${this.store.count()} total`);
        }

      } catch (error) {
        this.store.updateState(entry.normalizedUrl, 'FAILED', {
          errorMessage: `${error}`,
          crawlAttempts: entry.crawlAttempts + 1,
        });
        this.recordError(entry.normalizedUrl, `Link extraction error: ${error}`, this.phase);
      }
    }

    this.emitProgress();
  }

  /**
   * Extract links from a page (HTML or JS-rendered)
   */
  private async extractLinksFromPage(
    url: string,
    depth: number
  ): Promise<{ url: string; text: string; fromRenderedDom: boolean }[]> {
    const links: { url: string; text: string; fromRenderedDom: boolean }[] = [];
    const seenUrls = new Set<string>();

    try {
      // First, try HTML-only extraction
      const htmlLinks = await this.extractLinksFromHtml(url);
      for (const link of htmlLinks) {
        const normalized = this.normalizer.normalize(link.url, url);
        if (normalized && !seenUrls.has(normalized)) {
          seenUrls.add(normalized);
          links.push({ url: normalized, text: link.text, fromRenderedDom: false });
        }
      }

      // § 11.2.4: If JS rendering is enabled, also extract from rendered DOM
      if (this.config.useJsRendering && depth === 0) { // Only render homepage for link discovery
        const renderedLinks = await this.extractLinksFromRenderedDom(url);
        for (const link of renderedLinks) {
          const normalized = this.normalizer.normalize(link.url, url);
          if (normalized && !seenUrls.has(normalized)) {
            seenUrls.add(normalized);
            links.push({ url: normalized, text: link.text, fromRenderedDom: true });
          }
        }
      }
    } catch (error) {
      console.warn(`[UrlDiscoveryEngine] Link extraction failed for ${url}: ${error}`);
    }

    // Filter links
    return links.filter(link => this.shouldIncludeUrl(link.url));
  }

  /**
   * Extract links from raw HTML
   */
  private async extractLinksFromHtml(url: string): Promise<{ url: string; text: string }[]> {
    const links: { url: string; text: string }[] = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        headers: { 'User-Agent': this.config.userAgent },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // Extract anchor tags
      const anchorRegex = /<a\s+[^>]*href=["']([^"'#][^"']*)["'][^>]*>([^<]*)<\/a>/gi;
      let match;

      while ((match = anchorRegex.exec(html)) !== null) {
        const href = match[1];
        const text = match[2]?.trim() || '';
        
        if (href && !this.normalizer.matchesExcludePattern(href, this.config.scope.excludePatterns)) {
          links.push({ url: href, text });
        }
      }
    } catch (error) {
      console.warn(`[UrlDiscoveryEngine] HTML fetch failed for ${url}: ${error}`);
    }

    return links;
  }

  /**
   * § 11.2.4: Extract links from browser-rendered DOM
   */
  private async extractLinksFromRenderedDom(url: string): Promise<{ url: string; text: string }[]> {
    const links: { url: string; text: string }[] = [];

    try {
      const engine = await getJsRenderEngine();
      
      // Use the render method which handles page lifecycle
      const rendered = await engine.render(url, {
        timeout: this.config.timeout,
        waitUntil: 'networkidle',
      });

      // Parse rendered HTML to extract links
      const anchorRegex = /<a\s+[^>]*href=["']([^"'#][^"']*)["'][^>]*>([^<]*)<\/a>/gi;
      let match;

      while ((match = anchorRegex.exec(rendered.html)) !== null) {
        const href = match[1];
        const text = match[2]?.trim() || '';
        
        if (href && !this.normalizer.matchesExcludePattern(href, this.config.scope.excludePatterns)) {
          links.push({ url: href, text });
        }
      }
    } catch (error) {
      console.warn(`[UrlDiscoveryEngine] Rendered DOM extraction failed for ${url}: ${error}`);
    }

    return links;
  }

  /**
   * Add discovered URL to inventory
   */
  private addDiscoveredUrl(
    url: string,
    source: UrlDiscoverySource,
    parentUrl: string | null,
    depth: number
  ): UrlInventoryEntry | null {
    // Normalize URL
    const normalizedUrl = this.normalizer.normalize(url, parentUrl || undefined);
    if (!normalizedUrl) return null;

    // Check if valid and should be included
    if (!this.shouldIncludeUrl(normalizedUrl)) return null;

    // Check if already in inventory
    if (this.store.has(normalizedUrl)) return null;

    // Check max URLs limit
    if (this.store.count() >= this.config.scope.maxUrls) return null;

    // Determine initial state
    const state = this.shouldBlockUrl(normalizedUrl) ? 'BLOCKED_BY_POLICY' : 'DISCOVERED';
    const blockReason = state === 'BLOCKED_BY_POLICY' 
      ? this.getBlockReason(normalizedUrl) 
      : null;

    const entry = this.store.add({
      originalUrl: url,
      normalizedUrl,
      state,
      source,
      depth,
      parentUrl,
      canonicalUrl: null,
    });

    if (entry) {
      if (blockReason) {
        this.store.updateState(normalizedUrl, 'BLOCKED_BY_POLICY', { blockReason });
      } else {
        // Queue for crawl
        this.store.updateState(normalizedUrl, 'QUEUED_FOR_CRAWL');
      }
      
      this.onUrlDiscovered?.(entry);
    }

    return entry;
  }

  /**
   * § 11.5 Check if URL should be included
   */
  private shouldIncludeUrl(url: string): boolean {
    // Must be valid crawlable URL
    if (!this.normalizer.isValidCrawlableUrl(url)) return false;

    // Must be same domain
    if (!this.normalizer.isSameDomain(url, this.config.scope.includeSubdomains)) return false;

    // Check exclude patterns
    if (this.normalizer.matchesExcludePattern(url, this.config.scope.excludePatterns)) return false;

    // Check include patterns (if specified, whitelist mode)
    if (this.config.scope.includePatterns.length > 0) {
      const pathname = new URL(url).pathname;
      const matches = this.config.scope.includePatterns.some(pattern => 
        pathname.toLowerCase().includes(pattern.toLowerCase())
      );
      if (!matches) return false;
    }

    return true;
  }

  /**
   * Check if URL should be blocked by policy
   */
  private shouldBlockUrl(url: string): boolean {
    // § 11.5: Exclude login, forms, API endpoints, etc.
    const blockedPatterns = [
      '/login', '/logout', '/signin', '/signout',
      '/auth', '/oauth', '/api/',
      '/cart', '/checkout', '/order',
      '/my-account', '/profile', '/settings', '/dashboard',
      '/admin', '/wp-admin',
    ];

    const pathname = new URL(url).pathname.toLowerCase();
    return blockedPatterns.some(pattern => pathname.includes(pattern));
  }

  /**
   * Get block reason for URL
   */
  private getBlockReason(url: string): string {
    const pathname = new URL(url).pathname.toLowerCase();
    
    if (pathname.includes('/login') || pathname.includes('/signin') || pathname.includes('/auth')) {
      return 'Authentication page';
    }
    if (pathname.includes('/cart') || pathname.includes('/checkout')) {
      return 'E-commerce transaction page';
    }
    if (pathname.includes('/api/')) {
      return 'API endpoint';
    }
    if (pathname.includes('/admin') || pathname.includes('/dashboard')) {
      return 'Admin/dashboard page';
    }
    if (pathname.includes('/my-account') || pathname.includes('/profile') || pathname.includes('/settings')) {
      return 'User profile page';
    }
    
    return 'Blocked by crawl policy';
  }

  /**
   * Record error
   */
  private recordError(url: string, error: string, phase: UrlDiscoveryPhase): void {
    const errorEntry: DiscoveryError = {
      url,
      error,
      phase,
      timestamp: new Date(),
    };
    this.errors.push(errorEntry);
    this.onError?.(errorEntry);
  }

  /**
   * Emit progress update
   */
  private emitProgress(): void {
    const stats = this.store.getStats(this.phase, this.startedAt);
    this.onProgress?.(stats);
  }

  /**
   * Build final result
   */
  private buildResult(): UrlDiscoveryResult {
    return {
      jobId: `discovery-${Date.now()}`,
      projectId: this.config.projectId,
      stats: this.store.getStats(this.phase, this.startedAt),
      urls: this.store.getAll(),
      sitemapUrls: this.sitemapUrls,
      robotsTxt: this.robotsTxt,
      errors: this.errors,
    };
  }

  /**
   * Abort discovery
   */
  abort(): void {
    this.aborted = true;
    this.phase = 'PAUSED';
  }

  /**
   * Get current stats
   */
  getStats(): UrlDiscoveryStats {
    return this.store.getStats(this.phase, this.startedAt);
  }

  /**
   * Get URL inventory store
   */
  getStore(): IUrlInventoryStore {
    return this.store;
  }
}

/**
 * Factory function
 */
export const createUrlDiscoveryEngine = (
  config: UrlDiscoveryConfig,
  options?: Partial<UrlDiscoveryEngineConfig>
): UrlDiscoveryEngine => {
  return new UrlDiscoveryEngine({
    config,
    ...options,
  });
};
