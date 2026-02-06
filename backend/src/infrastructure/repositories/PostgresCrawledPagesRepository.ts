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
  // Core Web Vitals data
  performance_score?: number | null;
  lcp_status?: string | null;
  cls_status?: string | null;
  cwv_status?: string | null;
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
      // Use COALESCE to fallback to crawled_pages if title/meta_description is missing
      // Prioritize Lab Data (PSI-API) over Field Data (CrUX-API) for consistency with Google PageSpeed
      const pagesQuery = `
        WITH quality_cwv AS (
          SELECT DISTINCT ON (project_id, url) 
            project_id, url, ttfb_value, lcp_value as load_time, 
            performance_score, lcp_status, cls_status, overall_status
          FROM cwv_results
          WHERE project_id = $1
            AND device = 'mobile'
            AND lighthouse_version IN ('PSI-API', 'CrUX-API', '11.0.0', '11.0.0-real')
          ORDER BY project_id, url, 
            CASE lighthouse_version 
              WHEN 'PSI-API' THEN 1 
              WHEN '11.0.0' THEN 2
              WHEN '11.0.0-real' THEN 3
              WHEN 'CrUX-API' THEN 4 
              ELSE 5 
            END
        )
        SELECT 
          pcn.id,
          pcn.project_id,
          pcn.url,
          COALESCE(pcn.http_status, ui.http_status, cp.status_code, 200) as status_code,
          COALESCE(NULLIF(pcn.title, ''), cp.title) as title,
          COALESCE(NULLIF(pcn.meta_description, ''), cp.meta_description) as meta_description,
          COALESCE(pcn.headings, '[]'::jsonb) as headings,
          COALESCE(pcn.internal_links, cp.internal_links, '[]'::jsonb) as internal_links,
          COALESCE(pcn.external_links, cp.external_links, '[]'::jsonb) as external_links,
          COALESCE(pcn.images, cp.images, '[]'::jsonb) as images,
          pcn.content_text,
          COALESCE(pcn.crawled_at, cp.crawled_at) as crawled_at,
          COALESCE(pcn.response_time_ms, qcwv.ttfb_value, cp.response_time, 0) as response_time,
          COALESCE(pcn.load_time_ms, qcwv.load_time, 0) as load_time,
          qcwv.performance_score,
          qcwv.lcp_status,
          qcwv.cls_status,
          qcwv.overall_status as cwv_status,
          cp.h1_tags as cp_h1_tags,
          cp.h2_tags as cp_h2_tags,
          cp.h3_tags as cp_h3_tags,
          cp.word_count as cp_word_count
        FROM page_content_normalized pcn
        LEFT JOIN url_inventory ui ON pcn.project_id = ui.project_id AND pcn.url = ui.url
        LEFT JOIN quality_cwv qcwv ON pcn.project_id = qcwv.project_id AND pcn.url = qcwv.url
        LEFT JOIN crawled_pages cp ON pcn.project_id = cp.project_id AND pcn.url = cp.url
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
    
    // Get H1/H2/H3 tags - prefer from headings JSON, fallback to crawled_pages arrays
    const headings = row.headings || [];
    let h1Tags = headings.filter((h: any) => h.level === 1).map((h: any) => h.text);
    let h2Tags = headings.filter((h: any) => h.level === 2).map((h: any) => h.text);
    let h3Tags = headings.filter((h: any) => h.level === 3).map((h: any) => h.text);
    
    // Fallback to crawled_pages h1/h2/h3_tags if headings is empty
    if (h1Tags.length === 0 && row.cp_h1_tags) {
      h1Tags = Array.isArray(row.cp_h1_tags) ? row.cp_h1_tags : [];
    }
    if (h2Tags.length === 0 && row.cp_h2_tags) {
      h2Tags = Array.isArray(row.cp_h2_tags) ? row.cp_h2_tags : [];
    }
    if (h3Tags.length === 0 && row.cp_h3_tags) {
      h3Tags = Array.isArray(row.cp_h3_tags) ? row.cp_h3_tags : [];
    }
    
    if (h1Tags.length === 0) {
      issues.push({ type: 'missing_h1', severity: 'critical', message: 'Missing H1 tag' });
    } else if (h1Tags.length > 1) {
      issues.push({ type: 'multiple_h1', severity: 'warning', message: 'Multiple H1 tags' });
    }
    
    // Word count - prefer from content_text, fallback to crawled_pages
    const wordCount = row.content_text?.split(/\s+/).length || row.cp_word_count || 0;
    
    return {
      id: row.id,
      project_id: row.project_id,
      url: row.url,
      status_code: row.status_code || 200,
      response_time: parseFloat(row.response_time) || 0,
      load_time: parseFloat(row.load_time) || 0,
      title: row.title || '',
      meta_description: row.meta_description || '',
      h1_tags: h1Tags,
      h2_tags: h2Tags,
      h3_tags: h3Tags,
      internal_links: row.internal_links || [],
      external_links: row.external_links || [],
      images: row.images || [],
      word_count: wordCount,
      page_size: row.content_text?.length || 0,
      crawl_depth: 0,
      content_hash: undefined,
      crawled_at: row.crawled_at,
      issues,
      // CWV data from quality sources (CrUX, PSI, Lighthouse)
      performance_score: row.performance_score || null,
      lcp_status: row.lcp_status || null,
      cls_status: row.cls_status || null,
      cwv_status: row.cwv_status || null,
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
