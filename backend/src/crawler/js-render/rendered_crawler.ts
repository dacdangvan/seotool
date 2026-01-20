/**
 * Rendered Crawler
 * 
 * Main orchestrator for browser-rendered HTML crawling.
 * Combines render decision, JS rendering, DOM extraction, and SEO analysis.
 */

import { JsRenderEngine, getJsRenderEngine, closeJsRenderEngine } from './js_render_engine';
import { RenderDecider } from './render_decider';
import { DomExtractor } from './dom_extractor';
import { SeoAnalyzer } from './seo_analyzer';
import {
  CrawlPageResult,
  RenderMode,
  RenderOptions,
  JsRenderConfig,
  DEFAULT_JS_RENDER_CONFIG,
  ViewportType
} from './types';

export interface RenderedCrawlerConfig extends Partial<JsRenderConfig> {
  userAgent?: string;
  timeout?: number;
  followRedirects?: boolean;
}

export interface CrawlOptions {
  forceRender?: boolean;
  forceHtml?: boolean;
  viewport?: ViewportType;
  timeout?: number;
}

export class RenderedCrawler {
  private config: RenderedCrawlerConfig;
  private renderEngine: JsRenderEngine;
  private renderDecider: RenderDecider;
  private domExtractor: DomExtractor;
  private seoAnalyzer: SeoAnalyzer;
  private isInitialized = false;

  constructor(config: RenderedCrawlerConfig = {}) {
    this.config = {
      ...DEFAULT_JS_RENDER_CONFIG,
      userAgent: 'Mozilla/5.0 (compatible; SEOBot/1.0)',
      timeout: 30000,
      followRedirects: true,
      ...config
    };

    this.renderEngine = getJsRenderEngine(this.config);
    this.renderDecider = new RenderDecider(this.config);
    this.domExtractor = new DomExtractor();
    this.seoAnalyzer = new SeoAnalyzer();
  }

  /**
   * Initialize the crawler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.renderEngine.initialize();
    this.isInitialized = true;
  }

  /**
   * Crawl a single URL
   */
  async crawl(url: string, options: CrawlOptions = {}): Promise<CrawlPageResult> {
    const startTime = Date.now();

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Step 1: Fetch raw HTML
      const rawHtmlResult = await this.fetchRawHtml(url);
      
      if (rawHtmlResult.error) {
        return this.createErrorResult(url, rawHtmlResult.error, startTime);
      }

      const { html: rawHtml, statusCode, finalUrl } = rawHtmlResult;

      // Step 2: Decide whether to render
      let renderMode: RenderMode = 'html';
      let htmlToAnalyze = rawHtml;
      let renderTime = 0;

      if (options.forceHtml) {
        renderMode = 'html';
      } else if (options.forceRender) {
        renderMode = 'js_rendered';
      } else {
        const decision = this.renderDecider.decide(url, rawHtml);
        if (decision.shouldRender && this.config.enabled && !this.renderEngine.isLimitReached()) {
          renderMode = 'js_rendered';
        }
      }

      // Step 3: Render with JS if needed
      if (renderMode === 'js_rendered') {
        try {
          const viewport = options.viewport ?? this.config.defaultViewport ?? 'mobile';
          const renderResult = await this.renderEngine.render(url, {
            viewport,
            timeout: options.timeout ?? this.config.timeout
          });
          
          htmlToAnalyze = renderResult.html;
          renderTime = renderResult.renderTime;
        } catch (renderError) {
          // Fallback to raw HTML if rendering fails
          console.warn(`[RenderedCrawler] JS render failed for ${url}, falling back to HTML:`, renderError);
          renderMode = 'html';
        }
      }

      // Step 4: Extract SEO data
      const seoData = this.domExtractor.extract(
        htmlToAnalyze,
        finalUrl || url,
        renderMode,
        renderTime
      );

      // Step 5: Analyze SEO
      const seoAnalysis = this.seoAnalyzer.analyze(finalUrl || url, seoData);

      const loadTime = Date.now() - startTime;

      return {
        url,
        statusCode,
        renderMode,
        rawHtml: renderMode === 'js_rendered' ? rawHtml : undefined,
        renderedHtml: renderMode === 'js_rendered' ? htmlToAnalyze : undefined,
        seoData,
        seoAnalysis,
        loadTime,
        renderTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return this.createErrorResult(
        url,
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  /**
   * Crawl multiple URLs
   */
  async crawlBatch(
    urls: string[],
    options: CrawlOptions = {},
    concurrency = 3,
    onProgress?: (completed: number, total: number, result: CrawlPageResult) => void
  ): Promise<Map<string, CrawlPageResult>> {
    const results = new Map<string, CrawlPageResult>();
    let completed = 0;

    // Process in chunks to limit concurrency
    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      
      const chunkPromises = chunk.map(async (url) => {
        const result = await this.crawl(url, options);
        results.set(url, result);
        completed++;
        onProgress?.(completed, urls.length, result);
        return result;
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Fetch raw HTML via HTTP
   */
  private async fetchRawHtml(url: string): Promise<{
    html: string;
    statusCode: number;
    finalUrl: string;
    error?: string;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent ?? 'SEOBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: this.config.followRedirects ? 'follow' : 'manual',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const html = await response.text();

      return {
        html,
        statusCode: response.status,
        finalUrl: response.url
      };
    } catch (error) {
      return {
        html: '',
        statusCode: 0,
        finalUrl: url,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(url: string, error: string, startTime: number): CrawlPageResult {
    return {
      url,
      statusCode: 0,
      renderMode: 'html',
      seoData: {
        title: null,
        metaDescription: null,
        metaKeywords: null,
        canonical: null,
        robots: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        h1: [],
        h2: [],
        h3: [],
        headingStructure: [],
        internalLinks: [],
        externalLinks: [],
        visibleTextLength: 0,
        wordCount: 0,
        jsonLd: [],
        hasNoindex: false,
        hasNofollow: false,
        language: null,
        charset: null,
        renderMode: 'html',
        renderTime: 0
      },
      seoAnalysis: {
        url,
        renderMode: 'html',
        extractedData: {} as CrawlPageResult['seoData'],
        issues: [],
        score: 0,
        timestamp: new Date().toISOString()
      },
      loadTime: Date.now() - startTime,
      renderTime: 0,
      timestamp: new Date().toISOString(),
      error
    };
  }

  /**
   * Get render statistics
   */
  getStats(): {
    renderCount: number;
    limitReached: boolean;
    maxRenderPages: number;
  } {
    return {
      renderCount: this.renderEngine.getRenderCount(),
      limitReached: this.renderEngine.isLimitReached(),
      maxRenderPages: this.config.maxJsRenderPages ?? DEFAULT_JS_RENDER_CONFIG.maxJsRenderPages
    };
  }

  /**
   * Reset render count for new crawl job
   */
  resetStats(): void {
    this.renderEngine.resetRenderCount();
  }

  /**
   * Close the crawler and cleanup resources
   */
  async close(): Promise<void> {
    await closeJsRenderEngine();
    this.isInitialized = false;
  }
}

// Factory function
export function createRenderedCrawler(config?: RenderedCrawlerConfig): RenderedCrawler {
  return new RenderedCrawler(config);
}

export default RenderedCrawler;
