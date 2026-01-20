/**
 * Full SEO Crawl Pipeline
 * 
 * Orchestrates the complete SEO crawl process per § 11.6:
 * 
 * For each URL in the inventory, the crawler MUST:
 * 1. Determine render mode (html_only | js_rendered)
 * 2. Wait for SEO-ready state (Section 10)
 * 3. Extract standardized SEO signals
 * 4. Collect Core Web Vitals (Lab data, if eligible)
 * 5. Generate raw HTML vs rendered DOM diff report
 * 6. Store crawl results with timestamp and render metadata
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6 Section 11
 */

import {
  UrlDiscoveryConfig,
  UrlDiscoveryResult,
  UrlInventoryEntry,
  UrlDiscoveryStats,
  DEFAULT_DISCOVERY_CONFIG,
  DEFAULT_NORMALIZATION_CONFIG,
  DEFAULT_SCOPE_CONFIG,
} from './types';
import { UrlDiscoveryEngine, createUrlDiscoveryEngine } from './url_discovery_engine';
import { IUrlInventoryStore } from './url_inventory_store';

// Import existing crawler components
import { RenderedCrawler, CrawlOptions, createRenderedCrawler } from '../js-render';
import { RateLimiter } from '../rate_limiter';

/**
 * Full SEO Crawl Pipeline Configuration
 */
export interface FullSeoCrawlConfig {
  /** Project ID */
  projectId: string;
  /** Seed URL (homepage) */
  seedUrl: string;
  /** Domain to crawl */
  domain: string;
  /** URL Discovery configuration */
  discovery?: Partial<UrlDiscoveryConfig>;
  /** SEO Crawl configuration */
  crawl?: Partial<CrawlOptions>;
  /** Maximum concurrent crawls */
  concurrency?: number;
  /** Enable Core Web Vitals collection */
  collectCwv?: boolean;
  /** Enable diff report generation */
  generateDiffReport?: boolean;
}

/**
 * Crawl Result per URL
 */
export interface UrlCrawlResult {
  url: string;
  normalizedUrl: string;
  success: boolean;
  renderMode: 'html_only' | 'js_rendered';
  statusCode: number | null;
  seoData?: {
    title: string | null;
    metaDescription: string | null;
    h1: string[];
    canonical: string | null;
    isIndexable: boolean;
  };
  cwvData?: {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
  };
  diffReport?: {
    jsRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    titleDiff: string;
    metaDescDiff: string;
  };
  timing: {
    renderTime: number;
    seoReadyTime: number;
  };
  error?: string;
  crawledAt: Date;
}

/**
 * Full Pipeline Result
 */
export interface FullSeoCrawlResult {
  /** Pipeline ID */
  pipelineId: string;
  /** Project ID */
  projectId: string;
  /** Discovery result */
  discovery: UrlDiscoveryResult;
  /** Crawl results per URL */
  crawlResults: UrlCrawlResult[];
  /** Pipeline statistics */
  stats: {
    totalDiscovered: number;
    totalCrawled: number;
    totalFailed: number;
    crawlCoverage: number;
    averageRenderTime: number;
    jsRenderedCount: number;
    htmlOnlyCount: number;
    jsRiskDistribution: {
      low: number;
      medium: number;
      high: number;
    };
  };
  /** Pipeline timing */
  timing: {
    startedAt: Date;
    discoveryCompletedAt: Date | null;
    crawlCompletedAt: Date | null;
    totalDuration: number;
  };
  /** Errors */
  errors: string[];
}

/**
 * Pipeline Phase
 */
export type PipelinePhase = 
  | 'INITIALIZING'
  | 'DISCOVERY'
  | 'CRAWLING'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Progress Callback
 */
export interface PipelineProgress {
  phase: PipelinePhase;
  discoveryStats?: UrlDiscoveryStats;
  crawlProgress?: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
}

/**
 * Full SEO Crawl Pipeline
 * 
 * § 11.1: SEO crawling MUST follow this order:
 * 1. Discover all valid public URLs
 * 2. Build a canonical URL graph
 * 3. Crawl each URL with SEO-ready validation
 * 4. Store and analyze SEO signals
 */
export class FullSeoCrawlPipeline {
  private config: FullSeoCrawlConfig;
  private discoveryEngine: UrlDiscoveryEngine | null = null;
  private crawler: RenderedCrawler | null = null;
  private phase: PipelinePhase = 'INITIALIZING';
  private startedAt: Date;
  private discoveryCompletedAt: Date | null = null;
  private crawlResults: UrlCrawlResult[] = [];
  private errors: string[] = [];
  private aborted = false;

  // Callbacks
  private onProgress?: (progress: PipelineProgress) => void;

  constructor(
    config: FullSeoCrawlConfig,
    onProgress?: (progress: PipelineProgress) => void
  ) {
    this.config = config;
    this.onProgress = onProgress;
    this.startedAt = new Date();
  }

  /**
   * § 11.1 Execute Full SEO Crawl Pipeline
   */
  async execute(): Promise<FullSeoCrawlResult> {
    console.log(`[FullSeoCrawlPipeline] Starting pipeline for ${this.config.seedUrl}`);
    
    try {
      // Phase 1: URL Discovery
      this.phase = 'DISCOVERY';
      this.emitProgress();
      
      const discoveryResult = await this.runDiscovery();
      this.discoveryCompletedAt = new Date();
      
      console.log(`[FullSeoCrawlPipeline] Discovery complete: ${discoveryResult.stats.totalDiscovered} URLs found`);

      // Phase 2: SEO Crawl
      this.phase = 'CRAWLING';
      this.emitProgress();
      
      await this.runCrawl(discoveryResult);
      
      console.log(`[FullSeoCrawlPipeline] Crawl complete: ${this.crawlResults.length} URLs crawled`);

      // Phase 3: Complete
      this.phase = 'COMPLETED';
      
      return this.buildResult(discoveryResult);

    } catch (error) {
      this.phase = 'FAILED';
      this.errors.push(`Pipeline failed: ${error}`);
      console.error(`[FullSeoCrawlPipeline] Pipeline failed:`, error);
      
      // Return partial result
      return this.buildResult({
        jobId: `discovery-${Date.now()}`,
        projectId: this.config.projectId,
        stats: {
          totalDiscovered: 0,
          byState: { DISCOVERED: 0, QUEUED_FOR_CRAWL: 0, CRAWLED: 0, FAILED: 0, BLOCKED_BY_POLICY: 0 },
          bySource: { HOMEPAGE: 0, INTERNAL_LINK: 0, SITEMAP: 0, RENDERED_DOM: 0, SEED: 0 },
          crawlCoverage: 0,
          maxDepthReached: 0,
          startedAt: this.startedAt,
          completedAt: null,
          phase: 'FAILED',
          errorCount: 1,
        },
        urls: [],
        sitemapUrls: [],
        robotsTxt: null,
        errors: [],
      });
    }
  }

  /**
   * Phase 1: URL Discovery
   */
  private async runDiscovery(): Promise<UrlDiscoveryResult> {
    const discoveryConfig: UrlDiscoveryConfig = {
      projectId: this.config.projectId,
      seedUrl: this.config.seedUrl,
      domain: this.config.domain,
      normalization: {
        ...DEFAULT_NORMALIZATION_CONFIG,
        ...this.config.discovery?.normalization,
      },
      scope: {
        ...DEFAULT_SCOPE_CONFIG,
        ...this.config.discovery?.scope,
      },
      useSitemap: this.config.discovery?.useSitemap ?? true,
      useJsRendering: this.config.discovery?.useJsRendering ?? true,
      concurrency: this.config.concurrency ?? 5,
      timeout: this.config.discovery?.timeout ?? 30000,
      userAgent: this.config.discovery?.userAgent ?? 'VIB-SEO-Crawler/2.6',
    };

    this.discoveryEngine = createUrlDiscoveryEngine(discoveryConfig, {
      onProgress: (stats) => {
        this.emitProgress({ discoveryStats: stats });
      },
      onError: (error) => {
        this.errors.push(`Discovery: ${error.url} - ${error.error}`);
      },
    });

    return this.discoveryEngine.discover();
  }

  /**
   * Phase 2: SEO Crawl (§ 11.6)
   */
  private async runCrawl(discoveryResult: UrlDiscoveryResult): Promise<void> {
    // Get URLs to crawl (DISCOVERED or QUEUED_FOR_CRAWL states)
    const urlsToCrawl = discoveryResult.urls.filter(
      u => u.state === 'DISCOVERED' || u.state === 'QUEUED_FOR_CRAWL'
    );

    if (urlsToCrawl.length === 0) {
      console.log(`[FullSeoCrawlPipeline] No URLs to crawl`);
      return;
    }

    console.log(`[FullSeoCrawlPipeline] Crawling ${urlsToCrawl.length} URLs...`);

    // Initialize crawler
    this.crawler = await createRenderedCrawler({
      browserPoolSize: this.config.concurrency ?? 3,
      timeout: 30000,
      userAgent: 'VIB-SEO-Crawler/2.6',
    });

    const rateLimiter = new RateLimiter({ minDelay: 1000 });
    let completed = 0;
    let failed = 0;

    // Process URLs
    for (const urlEntry of urlsToCrawl) {
      if (this.aborted) break;

      await rateLimiter.wait();

      try {
        const result = await this.crawlUrl(urlEntry);
        this.crawlResults.push(result);
        
        if (result.success) {
          completed++;
        } else {
          failed++;
        }

        // Emit progress
        this.emitProgress({
          crawlProgress: {
            total: urlsToCrawl.length,
            completed,
            failed,
            percentage: Math.round(((completed + failed) / urlsToCrawl.length) * 100),
          },
        });

      } catch (error) {
        failed++;
        this.errors.push(`Crawl: ${urlEntry.normalizedUrl} - ${error}`);
        
        this.crawlResults.push({
          url: urlEntry.originalUrl,
          normalizedUrl: urlEntry.normalizedUrl,
          success: false,
          renderMode: 'html_only',
          statusCode: null,
          timing: { renderTime: 0, seoReadyTime: 0 },
          error: `${error}`,
          crawledAt: new Date(),
        });
      }
    }

    // Cleanup
    await this.crawler.close();
  }

  /**
   * § 11.6 Crawl single URL
   */
  private async crawlUrl(entry: UrlInventoryEntry): Promise<UrlCrawlResult> {
    if (!this.crawler) {
      throw new Error('Crawler not initialized');
    }

    const startTime = Date.now();

    try {
      // Use the rendered crawler which handles:
      // - Render mode detection
      // - SEO-ready wait (Section 10)
      // - SEO extraction
      const crawlResult = await this.crawler.crawl(entry.normalizedUrl, {
        forceRender: false, // Let RenderDecider decide
      });

      const renderTime = Date.now() - startTime;
      
      // Map RenderMode to pipeline type
      const mappedRenderMode: 'html_only' | 'js_rendered' = 
        crawlResult.renderMode === 'js_rendered' ? 'js_rendered' : 'html_only';

      return {
        url: entry.originalUrl,
        normalizedUrl: entry.normalizedUrl,
        success: true,
        renderMode: mappedRenderMode,
        statusCode: crawlResult.statusCode,
        seoData: {
          title: crawlResult.seoData.title,
          metaDescription: crawlResult.seoData.metaDescription,
          h1: crawlResult.seoData.h1,
          canonical: crawlResult.seoData.canonical,
          isIndexable: !crawlResult.seoData.hasNoindex,
        },
        // Note: diffReport will be added when HtmlDomDiffer is integrated into RenderedCrawler
        timing: {
          renderTime,
          seoReadyTime: crawlResult.seoData.renderTiming?.timeToSeoReady || 0,
        },
        crawledAt: new Date(),
      };

    } catch (error) {
      return {
        url: entry.originalUrl,
        normalizedUrl: entry.normalizedUrl,
        success: false,
        renderMode: 'html_only',
        statusCode: null,
        timing: { renderTime: Date.now() - startTime, seoReadyTime: 0 },
        error: `${error}`,
        crawledAt: new Date(),
      };
    }
  }

  /**
   * Build final result
   */
  private buildResult(discoveryResult: UrlDiscoveryResult): FullSeoCrawlResult {
    const crawledCount = this.crawlResults.filter(r => r.success).length;
    const failedCount = this.crawlResults.filter(r => !r.success).length;
    const jsRenderedCount = this.crawlResults.filter(r => r.renderMode === 'js_rendered').length;
    const htmlOnlyCount = this.crawlResults.filter(r => r.renderMode === 'html_only').length;

    const jsRiskDistribution = {
      low: this.crawlResults.filter(r => r.diffReport?.jsRisk === 'LOW').length,
      medium: this.crawlResults.filter(r => r.diffReport?.jsRisk === 'MEDIUM').length,
      high: this.crawlResults.filter(r => r.diffReport?.jsRisk === 'HIGH').length,
    };

    const totalRenderTime = this.crawlResults.reduce((sum, r) => sum + r.timing.renderTime, 0);
    const averageRenderTime = this.crawlResults.length > 0 
      ? Math.round(totalRenderTime / this.crawlResults.length) 
      : 0;

    const now = new Date();
    const totalDuration = now.getTime() - this.startedAt.getTime();

    return {
      pipelineId: `pipeline-${Date.now()}`,
      projectId: this.config.projectId,
      discovery: discoveryResult,
      crawlResults: this.crawlResults,
      stats: {
        totalDiscovered: discoveryResult.stats.totalDiscovered,
        totalCrawled: crawledCount,
        totalFailed: failedCount,
        crawlCoverage: discoveryResult.stats.totalDiscovered > 0 
          ? Math.round((crawledCount / discoveryResult.stats.totalDiscovered) * 100) 
          : 0,
        averageRenderTime,
        jsRenderedCount,
        htmlOnlyCount,
        jsRiskDistribution,
      },
      timing: {
        startedAt: this.startedAt,
        discoveryCompletedAt: this.discoveryCompletedAt,
        crawlCompletedAt: now,
        totalDuration,
      },
      errors: this.errors,
    };
  }

  /**
   * Emit progress update
   */
  private emitProgress(extra?: Partial<PipelineProgress>): void {
    this.onProgress?.({
      phase: this.phase,
      ...extra,
    });
  }

  /**
   * Abort pipeline
   */
  abort(): void {
    this.aborted = true;
    this.discoveryEngine?.abort();
  }

  /**
   * Get current phase
   */
  getPhase(): PipelinePhase {
    return this.phase;
  }
}

/**
 * Factory function
 */
export const createFullSeoCrawlPipeline = (
  config: FullSeoCrawlConfig,
  onProgress?: (progress: PipelineProgress) => void
): FullSeoCrawlPipeline => {
  return new FullSeoCrawlPipeline(config, onProgress);
};

/**
 * § 11.9 Governance: SEO analysis MUST NOT run on URLs not in the inventory
 * 
 * This helper validates that a URL exists in the inventory before analysis.
 */
export const validateUrlInInventory = (
  url: string,
  store: IUrlInventoryStore
): boolean => {
  return store.has(url);
};
