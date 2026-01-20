/**
 * Crawl Repository
 * 
 * Store and retrieve crawl data from PostgreSQL
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { CrawlJob, PageData, CrawlSummary } from './types';

export class CrawlRepository {
  constructor(private pool: Pool) {}
  
  /**
   * Save a crawl job
   */
  async saveJob(job: CrawlJob): Promise<CrawlJob> {
    const query = `
      INSERT INTO crawl_jobs (
        id, project_id, config, status, started_at, completed_at,
        total_pages, crawled_pages, failed_pages, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        total_pages = EXCLUDED.total_pages,
        crawled_pages = EXCLUDED.crawled_pages,
        failed_pages = EXCLUDED.failed_pages,
        error_message = EXCLUDED.error_message
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [
      job.id,
      job.projectId,
      JSON.stringify(job.config),
      job.status,
      job.startedAt,
      job.completedAt,
      job.totalPages,
      job.crawledPages,
      job.failedPages,
      job.errorMessage,
      job.createdAt,
    ]);
    
    return this.mapJobRow(result.rows[0]);
  }
  
  /**
   * Get a crawl job by ID
   */
  async getJob(jobId: string): Promise<CrawlJob | null> {
    const query = 'SELECT * FROM crawl_jobs WHERE id = $1';
    const result = await this.pool.query(query, [jobId]);
    
    if (result.rows.length === 0) return null;
    return this.mapJobRow(result.rows[0]);
  }
  
  /**
   * Get jobs for a project
   */
  async getJobsByProject(projectId: string, limit: number = 10): Promise<CrawlJob[]> {
    const query = `
      SELECT * FROM crawl_jobs 
      WHERE project_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [projectId, limit]);
    return result.rows.map(row => this.mapJobRow(row));
  }
  
  /**
   * Save crawled pages
   */
  async savePages(pages: PageData[]): Promise<void> {
    if (pages.length === 0) return;
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const page of pages) {
        const pageId = page.id || uuidv4();
        
        await client.query(`
          INSERT INTO crawled_pages (
            id, project_id, url, canonical_url, status_code, response_time,
            title, meta_description, meta_keywords, meta_robots,
            open_graph, h1_tags, h2_tags, h3_tags, word_count,
            internal_links, external_links, images, structured_data,
            content_hash, last_modified, content_type, page_size,
            crawl_depth, crawled_at, issues
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          ON CONFLICT (project_id, url) DO UPDATE SET
            canonical_url = EXCLUDED.canonical_url,
            status_code = EXCLUDED.status_code,
            response_time = EXCLUDED.response_time,
            title = EXCLUDED.title,
            meta_description = EXCLUDED.meta_description,
            meta_keywords = EXCLUDED.meta_keywords,
            meta_robots = EXCLUDED.meta_robots,
            open_graph = EXCLUDED.open_graph,
            h1_tags = EXCLUDED.h1_tags,
            h2_tags = EXCLUDED.h2_tags,
            h3_tags = EXCLUDED.h3_tags,
            word_count = EXCLUDED.word_count,
            internal_links = EXCLUDED.internal_links,
            external_links = EXCLUDED.external_links,
            images = EXCLUDED.images,
            structured_data = EXCLUDED.structured_data,
            content_hash = EXCLUDED.content_hash,
            last_modified = EXCLUDED.last_modified,
            content_type = EXCLUDED.content_type,
            page_size = EXCLUDED.page_size,
            crawl_depth = EXCLUDED.crawl_depth,
            crawled_at = EXCLUDED.crawled_at,
            issues = EXCLUDED.issues
        `, [
          pageId,
          page.projectId,
          page.url,
          page.canonicalUrl,
          page.statusCode,
          page.responseTime,
          page.title,
          page.metaDescription,
          page.metaKeywords,
          page.metaRobots,
          page.openGraph ? JSON.stringify(page.openGraph) : null,
          JSON.stringify(page.h1Tags),
          JSON.stringify(page.h2Tags),
          JSON.stringify(page.h3Tags),
          page.wordCount,
          JSON.stringify(page.internalLinks),
          JSON.stringify(page.externalLinks),
          JSON.stringify(page.images),
          page.structuredData ? JSON.stringify(page.structuredData) : null,
          page.contentHash,
          page.lastModified,
          page.contentType,
          page.pageSize,
          page.crawlDepth,
          page.crawledAt,
          JSON.stringify(page.issues),
        ]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get pages for a project
   */
  async getPages(projectId: string, options: {
    limit?: number;
    offset?: number;
    hasIssues?: boolean;
    issueType?: string;
  } = {}): Promise<PageData[]> {
    let query = 'SELECT * FROM crawled_pages WHERE project_id = $1';
    const params: (string | number | boolean)[] = [projectId];
    let paramIndex = 2;
    
    if (options.hasIssues) {
      query += ` AND jsonb_array_length(issues) > 0`;
    }
    
    if (options.issueType) {
      query += ` AND issues @> $${paramIndex}::jsonb`;
      params.push(JSON.stringify([{ type: options.issueType }]));
      paramIndex++;
    }
    
    query += ' ORDER BY crawled_at DESC';
    
    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }
    
    if (options.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }
    
    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapPageRow(row));
  }
  
  /**
   * Get page by URL
   */
  async getPageByUrl(projectId: string, url: string): Promise<PageData | null> {
    const query = 'SELECT * FROM crawled_pages WHERE project_id = $1 AND url = $2';
    const result = await this.pool.query(query, [projectId, url]);
    
    if (result.rows.length === 0) return null;
    return this.mapPageRow(result.rows[0]);
  }
  
  /**
   * Get crawl summary for a project
   */
  async getSummary(projectId: string): Promise<CrawlSummary | null> {
    const query = `
      SELECT 
        COUNT(*) as total_pages,
        COALESCE(SUM(jsonb_array_length(issues)), 0) as total_issues,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM jsonb_array_elements(issues) i WHERE i->>'severity' = 'critical')
        ), 0) as critical_issues,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM jsonb_array_elements(issues) i WHERE i->>'severity' = 'warning')
        ), 0) as warnings,
        COALESCE(AVG(response_time), 0) as avg_response_time,
        COALESCE(AVG(word_count), 0) as avg_word_count,
        COALESCE(SUM(jsonb_array_length(internal_links)), 0) as total_internal_links,
        COALESCE(SUM(jsonb_array_length(external_links)), 0) as total_external_links,
        COALESCE(SUM(jsonb_array_length(images)), 0) as total_images,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM jsonb_array_elements(images) i WHERE (i->>'hasAlt')::boolean = false)
        ), 0) as images_without_alt,
        COUNT(*) FILTER (WHERE title IS NULL) as pages_without_title,
        COUNT(*) FILTER (WHERE meta_description IS NULL) as pages_without_meta_description,
        COUNT(*) FILTER (WHERE jsonb_array_length(h1_tags) = 0) as pages_without_h1
      FROM crawled_pages
      WHERE project_id = $1
    `;
    
    const result = await this.pool.query(query, [projectId]);
    
    if (result.rows.length === 0 || result.rows[0].total_pages === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    // Get duplicate counts separately (complex query)
    const duplicatesQuery = `
      SELECT 
        (SELECT COUNT(DISTINCT title) FROM crawled_pages WHERE project_id = $1 AND title IN (
          SELECT title FROM crawled_pages WHERE project_id = $1 AND title IS NOT NULL GROUP BY title HAVING COUNT(*) > 1
        )) as duplicate_titles,
        (SELECT COUNT(DISTINCT meta_description) FROM crawled_pages WHERE project_id = $1 AND meta_description IN (
          SELECT meta_description FROM crawled_pages WHERE project_id = $1 AND meta_description IS NOT NULL GROUP BY meta_description HAVING COUNT(*) > 1
        )) as duplicate_descriptions
    `;
    
    const dupResult = await this.pool.query(duplicatesQuery, [projectId]);
    const dupRow = dupResult.rows[0];
    
    return {
      totalPages: parseInt(row.total_pages),
      totalIssues: parseInt(row.total_issues),
      criticalIssues: parseInt(row.critical_issues),
      warnings: parseInt(row.warnings),
      avgResponseTime: Math.round(parseFloat(row.avg_response_time)),
      avgWordCount: Math.round(parseFloat(row.avg_word_count)),
      totalInternalLinks: parseInt(row.total_internal_links),
      totalExternalLinks: parseInt(row.total_external_links),
      totalImages: parseInt(row.total_images),
      imagesWithoutAlt: parseInt(row.images_without_alt),
      pagesWithoutTitle: parseInt(row.pages_without_title),
      pagesWithoutMetaDescription: parseInt(row.pages_without_meta_description),
      pagesWithoutH1: parseInt(row.pages_without_h1),
      duplicateTitles: parseInt(dupRow.duplicate_titles) || 0,
      duplicateDescriptions: parseInt(dupRow.duplicate_descriptions) || 0,
    };
  }
  
  /**
   * Delete old crawl data
   */
  async deleteOldCrawls(projectId: string, keepCount: number = 5): Promise<void> {
    // Get job IDs to keep
    const jobsQuery = `
      SELECT id FROM crawl_jobs 
      WHERE project_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const jobsResult = await this.pool.query(jobsQuery, [projectId, keepCount]);
    const keepJobIds = jobsResult.rows.map(r => r.id);
    
    if (keepJobIds.length === 0) return;
    
    // Delete old jobs
    await this.pool.query(`
      DELETE FROM crawl_jobs 
      WHERE project_id = $1 AND id NOT IN (${keepJobIds.map((_, i) => `$${i + 2}`).join(', ')})
    `, [projectId, ...keepJobIds]);
  }
  
  private mapJobRow(row: Record<string, unknown>): CrawlJob {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      config: row.config as CrawlJob['config'],
      status: row.status as CrawlJob['status'],
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      totalPages: row.total_pages as number,
      crawledPages: row.crawled_pages as number,
      failedPages: row.failed_pages as number,
      errorMessage: row.error_message as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
  
  private mapPageRow(row: Record<string, unknown>): PageData {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      url: row.url as string,
      canonicalUrl: row.canonical_url as string | undefined,
      statusCode: row.status_code as number,
      responseTime: row.response_time as number,
      title: row.title as string | undefined,
      metaDescription: row.meta_description as string | undefined,
      metaKeywords: row.meta_keywords as string | undefined,
      metaRobots: row.meta_robots as string | undefined,
      openGraph: row.open_graph as PageData['openGraph'],
      h1Tags: row.h1_tags as string[],
      h2Tags: row.h2_tags as string[],
      h3Tags: row.h3_tags as string[],
      wordCount: row.word_count as number,
      internalLinks: row.internal_links as string[],
      externalLinks: row.external_links as string[],
      images: row.images as PageData['images'],
      structuredData: row.structured_data as object[] | undefined,
      contentHash: row.content_hash as string | undefined,
      lastModified: row.last_modified as string | undefined,
      contentType: row.content_type as string | undefined,
      pageSize: row.page_size as number,
      crawlDepth: row.crawl_depth as number,
      crawledAt: new Date(row.crawled_at as string),
      issues: row.issues as PageData['issues'],
    };
  }
}
