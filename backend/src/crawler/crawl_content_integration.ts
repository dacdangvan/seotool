/**
 * Crawl Content Integration Service
 * 
 * Integrates RenderedCrawler with ContentNormalizer and ContentRepository
 * to automatically save normalized content to database.
 * 
 * Per Section 0.1: ALL DATA FROM DATABASE
 * Per Section 17: Full Page Content Capture & Normalization
 */

import { RenderedCrawler, CrawlOptions } from './js-render/rendered_crawler';
import { CrawlPageResult } from './js-render/types';
import { ContentNormalizer } from '../content/content_normalizer';
import { ContentRepository } from '../content/content_repository';
import { NormalizedContent, CrawledContent } from '../content/types';
import { Pool } from 'pg';

export interface CrawlAndSaveOptions extends CrawlOptions {
  projectId: string;
  crawlJobId: string;
  saveToDatabase?: boolean;
}

export interface CrawlAndSaveResult extends CrawlPageResult {
  normalizedContent?: NormalizedContent;
  savedContent?: CrawledContent;
  saveError?: string;
}

export class CrawlContentIntegration {
  private crawler: RenderedCrawler;
  private normalizer: ContentNormalizer;
  private repository: ContentRepository;

  constructor(pool: Pool, crawlerConfig?: any) {
    this.crawler = new RenderedCrawler(crawlerConfig);
    this.normalizer = new ContentNormalizer();
    this.repository = new ContentRepository(pool);
  }

  /**
   * Initialize crawler
   */
  async initialize(): Promise<void> {
    await this.crawler.initialize();
  }

  /**
   * Crawl a URL, normalize content, and save to database
   */
  async crawlAndSave(url: string, options: CrawlAndSaveOptions): Promise<CrawlAndSaveResult> {
    const { projectId, crawlJobId, saveToDatabase = true, ...crawlOptions } = options;

    // Step 1: Crawl the page
    const crawlResult = await this.crawler.crawl(url, crawlOptions);

    if (crawlResult.error) {
      return crawlResult;
    }

    // Step 2: Normalize the content
    // Prefer rendered HTML if available, otherwise use raw HTML from fetch
    const htmlContent = crawlResult.renderedHtml || crawlResult.rawHtml;
    
    if (!htmlContent) {
      return {
        ...crawlResult,
        saveError: 'No HTML content available to normalize',
      };
    }

    let normalizedContent: NormalizedContent;
    
    // Determine render mode for normalization
    const renderModeForNormalization: 'html_only' | 'js_rendered' = 
      crawlResult.renderMode === 'js_rendered' ? 'js_rendered' : 'html_only';
    
    try {
      normalizedContent = this.normalizer.normalize(
        htmlContent, 
        crawlResult.url,
        renderModeForNormalization
      );
    } catch (error) {
      return {
        ...crawlResult,
        saveError: `Normalization failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Step 3: Save to database if enabled
    if (!saveToDatabase) {
      return {
        ...crawlResult,
        normalizedContent,
      };
    }

    try {
      const crawledContentData: Omit<CrawledContent, 'id' | 'created_at' | 'updated_at'> = {
        project_id: projectId,
        crawl_job_id: crawlJobId,
        url: crawlResult.url,
        normalized_content: normalizedContent,
        raw_rendered_html: crawlResult.renderedHtml || undefined,
        render_mode: renderModeForNormalization,
        language: normalizedContent.language,
        crawled_at: new Date(),
      };

      const savedContent = await this.repository.saveCrawledContent(crawledContentData);

      return {
        ...crawlResult,
        normalizedContent,
        savedContent,
      };
    } catch (error) {
      return {
        ...crawlResult,
        normalizedContent,
        saveError: `Database save failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Crawl multiple URLs, normalize content, and save to database
   */
  async crawlBatchAndSave(
    urls: string[],
    options: CrawlAndSaveOptions,
    concurrency = 3,
    onProgress?: (completed: number, total: number, result: CrawlAndSaveResult) => void
  ): Promise<Map<string, CrawlAndSaveResult>> {
    const results = new Map<string, CrawlAndSaveResult>();
    let completed = 0;

    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);

      const chunkPromises = chunk.map(async (url) => {
        const result = await this.crawlAndSave(url, options);
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
   * Normalize already-crawled content and save to database
   * Use this to process content that was crawled before ContentNormalizer was added
   */
  async normalizeExistingContent(
    projectId: string,
    crawlJobId: string,
    html: string,
    url: string,
    renderMode: 'html_only' | 'js_rendered',
    language?: string
  ): Promise<{ savedContent: CrawledContent; normalizedContent: NormalizedContent }> {
    const normalizedContent = this.normalizer.normalize(html, url, renderMode, language);

    const crawledContentData: Omit<CrawledContent, 'id' | 'created_at' | 'updated_at'> = {
      project_id: projectId,
      crawl_job_id: crawlJobId,
      url,
      normalized_content: normalizedContent,
      raw_rendered_html: renderMode === 'js_rendered' ? html : undefined,
      render_mode: renderMode,
      language: normalizedContent.language,
      crawled_at: new Date(),
    };

    const savedContent = await this.repository.saveCrawledContent(crawledContentData);

    return { savedContent, normalizedContent };
  }

  /**
   * Get normalized content for a URL
   */
  async getNormalizedContent(projectId: string, url: string): Promise<CrawledContent | null> {
    const content = await this.repository.getCrawledContentByUrl(projectId, url);
    return content;
  }

  /**
   * Get all crawled content for a project
   */
  async getProjectContent(projectId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<CrawledContent[]> {
    return this.repository.getCrawledContentByProject(
      projectId,
      options?.limit,
      options?.offset
    );
  }

  /**
   * Get crawler statistics
   */
  getStats() {
    return this.crawler.getStats();
  }

  /**
   * Reset crawler statistics
   */
  resetStats() {
    this.crawler.resetStats();
  }

  /**
   * Close the crawler
   */
  async close(): Promise<void> {
    await this.crawler.close();
  }
}

/**
 * Factory function
 */
export function createCrawlContentIntegration(pool: Pool, crawlerConfig?: any): CrawlContentIntegration {
  return new CrawlContentIntegration(pool, crawlerConfig);
}

export default CrawlContentIntegration;
