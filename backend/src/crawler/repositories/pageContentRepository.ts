/**
 * Page Content Repository
 *
 * Manages normalized page content persistence
 * Following AI_SEO_TOOL_PROMPT_BOOK.md Section 17
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';

export interface NormalizedContent {
  url: string;
  title?: string;
  meta_description?: string;
  h1?: string;
  h2?: string[];
  h3?: string[];
  visible_text: string;
  word_count: number;
  links: {
    internal: Array<{url: string; anchor_text: string; context?: string}>;
    external: Array<{url: string; anchor_text: string; rel?: string}>;
  };
  structured_data?: any[];
  media: {
    images: Array<{src: string; alt?: string; context?: string}>;
    videos: Array<{src: string; type?: string}>;
  };
  content_structure: {
    sections: Array<{heading?: string; content: string; level: number}>;
    lists: string[];
    tables: string[];
  };
}

export interface PageContentRecord {
  id?: number;
  project_id: string;
  url: string;
  render_mode?: string;
  language?: string;
  title?: string;
  meta_description?: string;
  headings?: any[];
  sections?: any[];
  paragraphs?: any[];
  lists?: any[];
  tables?: any[];
  internal_links?: any[];
  external_links?: any[];
  images?: any[];
  structured_data?: any[];
  content_text?: string;
  content_hash?: string;
  raw_html?: string;  // Full HTML content for SEO analysis
  crawled_at?: Date;
}

export class PageContentRepository {
  constructor(private pool: Pool) {}

  /**
   * Store normalized page content
   * MUST be called AFTER URL is marked as CRAWLED
   */
  async storeContent(content: Omit<PageContentRecord, 'id' | 'crawled_at'>): Promise<PageContentRecord> {
    const query = `
      INSERT INTO page_content_normalized (
        project_id, url, render_mode, language, title, meta_description,
        headings, sections, paragraphs, lists, tables, internal_links,
        external_links, images, structured_data, content_text, content_hash, raw_html, crawled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (project_id, url) DO UPDATE SET
        render_mode = EXCLUDED.render_mode,
        title = EXCLUDED.title,
        meta_description = EXCLUDED.meta_description,
        headings = EXCLUDED.headings,
        sections = EXCLUDED.sections,
        paragraphs = EXCLUDED.paragraphs,
        lists = EXCLUDED.lists,
        tables = EXCLUDED.tables,
        internal_links = EXCLUDED.internal_links,
        external_links = EXCLUDED.external_links,
        images = EXCLUDED.images,
        structured_data = EXCLUDED.structured_data,
        content_text = EXCLUDED.content_text,
        content_hash = EXCLUDED.content_hash,
        raw_html = EXCLUDED.raw_html,
        crawled_at = NOW()
      RETURNING *;
    `;

    const result = await this.pool.query(query, [
      content.project_id,
      content.url,
      content.render_mode || 'html_only',
      content.language,
      content.title,
      content.meta_description,
      content.headings ? JSON.stringify(content.headings) : null,
      content.sections ? JSON.stringify(content.sections) : null,
      content.paragraphs ? JSON.stringify(content.paragraphs) : null,
      content.lists ? JSON.stringify(content.lists) : null,
      content.tables ? JSON.stringify(content.tables) : null,
      content.internal_links ? JSON.stringify(content.internal_links) : null,
      content.external_links ? JSON.stringify(content.external_links) : null,
      content.images ? JSON.stringify(content.images) : null,
      content.structured_data ? JSON.stringify(content.structured_data) : null,
      content.content_text,
      content.content_hash,
      content.raw_html
    ]);

    return result.rows[0];
  }

  /**
   * Compute content hash for deduplication and change detection
   */
  computeContentHash(content: NormalizedContent): string {
    const contentString = JSON.stringify({
      title: content.title,
      meta_description: content.meta_description,
      h1: content.h1,
      h2: content.h2,
      h3: content.h3,
      visible_text: content.visible_text,
      links: content.links,
      structured_data: content.structured_data,
      content_structure: content.content_structure
    });

    return createHash('sha256').update(contentString).digest('hex');
  }

  /**
   * Get content by URL inventory ID
   */
  async getContentByUrlInventoryId(urlInventoryId: string): Promise<PageContentRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM page_content_normalized WHERE url_inventory_id = $1',
      [urlInventoryId]
    );

    if (result.rows.length === 0) return null;

    const record = result.rows[0];
    return {
      ...record,
      normalized_content: JSON.parse(record.normalized_content),
      render_timing: record.render_timing ? JSON.parse(record.render_timing) : undefined,
      seo_ready_signals: JSON.parse(record.seo_ready_signals)
    };
  }

  /**
   * Get content by URL and project
   */
  async getContentByUrl(projectId: string, url: string): Promise<PageContentRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM page_content_normalized WHERE project_id = $1 AND url = $2 ORDER BY crawled_at DESC LIMIT 1',
      [projectId, url]
    );

    if (result.rows.length === 0) return null;

    const record = result.rows[0];
    return {
      ...record,
      headings: record.headings ? JSON.parse(record.headings) : undefined,
      sections: record.sections ? JSON.parse(record.sections) : undefined,
      paragraphs: record.paragraphs ? JSON.parse(record.paragraphs) : undefined,
      lists: record.lists ? JSON.parse(record.lists) : undefined,
      tables: record.tables ? JSON.parse(record.tables) : undefined,
      internal_links: record.internal_links ? JSON.parse(record.internal_links) : undefined,
      external_links: record.external_links ? JSON.parse(record.external_links) : undefined,
      images: record.images ? JSON.parse(record.images) : undefined,
      structured_data: record.structured_data ? JSON.parse(record.structured_data) : undefined
    };
  }

  /**
   * Get all content for a crawl job (by URL lookup)
   */
  async getContentByCrawlJob(crawlJobId: string): Promise<PageContentRecord[]> {
    const result = await this.pool.query(
      `SELECT pcn.* FROM page_content_normalized pcn
       INNER JOIN url_inventory ui ON pcn.url = ui.url AND pcn.project_id = ui.project_id
       WHERE ui.last_crawl_job_id = $1
       ORDER BY pcn.crawled_at`,
      [crawlJobId]
    );

    return result.rows.map(record => ({
      ...record,
      headings: record.headings ? JSON.parse(record.headings) : undefined,
      sections: record.sections ? JSON.parse(record.sections) : undefined,
      paragraphs: record.paragraphs ? JSON.parse(record.paragraphs) : undefined,
      lists: record.lists ? JSON.parse(record.lists) : undefined,
      tables: record.tables ? JSON.parse(record.tables) : undefined,
      internal_links: record.internal_links ? JSON.parse(record.internal_links) : undefined,
      external_links: record.external_links ? JSON.parse(record.external_links) : undefined,
      images: record.images ? JSON.parse(record.images) : undefined,
      structured_data: record.structured_data ? JSON.parse(record.structured_data) : undefined
    }));
  }

  /**
   * Check if content exists for URL
   */
  async contentExists(projectId: string, url: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM page_content_normalized WHERE project_id = $1 AND url = $2 LIMIT 1',
      [projectId, url]
    );

    return result.rows.length > 0;
  }

  /**
   * Delete content by URL (for cleanup)
   */
  async deleteContent(projectId: string, url: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM page_content_normalized WHERE project_id = $1 AND url = $2',
      [projectId, url]
    );
  }
}
