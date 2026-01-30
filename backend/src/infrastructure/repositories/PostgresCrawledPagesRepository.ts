/**
 * Postgres Crawled Pages Repository
 *
 * Repository for accessing crawled pages data from database
 * Following crawl-centric data architecture from AI_SEO_TOOL_PROMPT_BOOK.md
 */

import { Pool } from 'pg';
import { Logger } from '../../shared/Logger';

export interface CrawledPage {
  id: string;
  project_id: string;
  url: string;
  canonical_url?: string;
  status_code: number;
  response_time: number;
  load_time?: number;  // Total page load time in ms
  title?: string;
  meta_description?: string;
  meta_keywords?: string;
  meta_robots?: string;
  open_graph?: any;
  h1_tags: string[];
  h2_tags: string[];
  h3_tags: string[];
  word_count: number;
  internal_links: any[];
  external_links: any[];
  images: any[];
  structured_data?: any;
  content_hash?: string;
  last_modified?: string;
  content_type?: string;
  page_size: number;
  crawl_depth: number;
  crawled_at: string;
  issues: any[];
}

export interface CrawlJob {
  id: string;
  project_id: string;
  config: any;
  status: string;
  started_at?: string;
  completed_at?: string;
  total_pages: number;
  crawled_pages: number;
  failed_pages: number;
  error_message?: string;
  created_at: string;
}

export interface CrawlResult {
  job: CrawlJob;
  pages: CrawledPage[];
  summary: {
    totalPages: number;
    crawledPages: number;
    failedPages: number;
    issuesCount: number;
    avgResponseTime: number;
    lastCrawled: string;
  };
}

export class PostgresCrawledPagesRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresCrawledPagesRepository');
  }

  /**
   * Get latest crawl result for a project
   */
  async getLatestCrawlResult(projectId: string): Promise<CrawlResult | null> {
    try {
      this.logger.info('Getting latest crawl result', { projectId });

      // Get latest completed crawl job
      const jobQuery = `
        SELECT * FROM crawl_jobs
        WHERE project_id = $1 AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1
      `;
      const jobResult = await this.pool.query(jobQuery, [projectId]);

      if (jobResult.rows.length === 0) {
        this.logger.info('No completed crawl jobs found', { projectId });
        return null;
      }

      const job = jobResult.rows[0];

      // Get pages from page_content_normalized (new crawler worker data) 
      // joined with url_inventory for http_status and cwv_results for response time (TTFB) and load_time
      const pagesQuery = `
        SELECT 
          pcn.id,
          pcn.project_id,
          pcn.url,
          COALESCE(pcn.http_status, ui.http_status, 200) as status_code,
          pcn.title,
          pcn.meta_description,
          pcn.headings,
          pcn.internal_links,
          pcn.external_links,
          pcn.images,
          pcn.content_text,
          pcn.crawled_at,
          COALESCE(pcn.response_time_ms, cwv.ttfb_value, 0) as response_time,
          COALESCE(pcn.load_time_ms, cwv.load_time, 0) as load_time
        FROM page_content_normalized pcn
        LEFT JOIN url_inventory ui ON pcn.project_id = ui.project_id AND pcn.url = ui.url
        LEFT JOIN cwv_results cwv ON pcn.project_id = cwv.project_id AND pcn.url = cwv.url AND cwv.device = 'desktop'
        WHERE pcn.project_id = $1
        ORDER BY pcn.crawled_at DESC
      `;
      const pagesResult = await this.pool.query(pagesQuery, [projectId]);

      const pages = pagesResult.rows.map(row => this.transformNormalizedPage(row));

      // Calculate summary
      const summary = {
        totalPages: pages.length,
        crawledPages: pages.filter(p => p.status_code < 400).length,
        failedPages: pages.filter(p => p.status_code >= 400).length,
        issuesCount: pages.reduce((sum, p) => sum + (p.issues?.length || 0), 0),
        avgResponseTime: pages.length > 0
          ? Math.round(pages.reduce((sum, p) => sum + p.response_time, 0) / pages.length)
          : 0,
        lastCrawled: job.completed_at || job.created_at,
      };

      return {
        job,
        pages,
        summary,
      };
    } catch (error) {
      this.logger.error('Error getting latest crawl result', { error, projectId });
      throw error;
    }
  }
  
  /**
   * Transform page_content_normalized row to CrawledPage format
   */
  private transformNormalizedPage(row: any): CrawledPage {
    // Calculate issues from page data
    const issues: any[] = [];
    
    if (!row.title || row.title.trim() === '') {
      issues.push({ type: 'missing_title', severity: 'critical', message: 'Missing title tag' });
    }
    
    if (!row.meta_description || row.meta_description.trim() === '') {
      issues.push({ type: 'missing_meta_description', severity: 'warning', message: 'Missing meta description' });
    }
    
    // Check H1 from headings
    const headings = row.headings || [];
    const h1Tags = headings.filter((h: any) => h.level === 1);
    if (h1Tags.length === 0) {
      issues.push({ type: 'missing_h1', severity: 'critical', message: 'Missing H1 tag' });
    } else if (h1Tags.length > 1) {
      issues.push({ type: 'multiple_h1', severity: 'warning', message: 'Multiple H1 tags' });
    }
    
    return {
      id: row.id,
      project_id: row.project_id,
      url: row.url,
      status_code: row.status_code || 200,
      response_time: parseFloat(row.response_time) || 0,
      load_time: parseFloat(row.load_time) || 0,
      title: row.title || '',
      meta_description: row.meta_description || '',
      h1_tags: h1Tags.map((h: any) => h.text),
      h2_tags: headings.filter((h: any) => h.level === 2).map((h: any) => h.text),
      h3_tags: headings.filter((h: any) => h.level === 3).map((h: any) => h.text),
      internal_links: row.internal_links || [],
      external_links: row.external_links || [],
      images: row.images || [],
      word_count: row.content_text?.split(/\s+/).length || 0,
      page_size: row.content_text?.length || 0,
      crawl_depth: 0,
      content_hash: undefined,
      crawled_at: row.crawled_at,
      issues,
    };
  }

  /**
   * Get all crawled pages for a project
   */
  async getCrawledPages(projectId: string): Promise<CrawledPage[]> {
    try {
      const query = `
        SELECT * FROM crawled_pages
        WHERE project_id = $1
        ORDER BY crawled_at DESC
      `;
      const result = await this.pool.query(query, [projectId]);
      return result.rows.map(row => this.transformCrawledPage(row));
    } catch (error) {
      this.logger.error('Error getting crawled pages', { error, projectId });
      throw error;
    }
  }

  /**
   * Get crawl jobs for a project
   */
  async getCrawlJobs(projectId: string, limit = 10): Promise<CrawlJob[]> {
    try {
      const query = `
        SELECT * FROM crawl_jobs
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      const result = await this.pool.query(query, [projectId, limit]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting crawl jobs', { error, projectId });
      throw error;
    }
  }

  /**
   * Transform database row to CrawledPage interface (snake_case to camelCase)
   */
  private transformCrawledPage(row: any): CrawledPage {
    return {
      id: row.id,
      project_id: row.project_id,
      url: row.url,
      canonical_url: row.canonical_url,
      status_code: row.status_code,
      response_time: row.response_time,
      title: row.title,
      meta_description: row.meta_description,
      meta_keywords: row.meta_keywords,
      meta_robots: row.meta_robots,
      open_graph: row.open_graph,
      h1_tags: row.h1_tags || [],
      h2_tags: row.h2_tags || [],
      h3_tags: row.h3_tags || [],
      word_count: row.word_count,
      internal_links: row.internal_links || [],
      external_links: row.external_links || [],
      images: row.images || [],
      structured_data: row.structured_data,
      content_hash: row.content_hash,
      last_modified: row.last_modified,
      content_type: row.content_type,
      page_size: row.page_size,
      crawl_depth: row.crawl_depth,
      crawled_at: row.crawled_at,
      issues: row.issues || [],
    };
  }
}
