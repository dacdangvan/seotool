/**
 * Page Content Repository - Stores normalized page content
 * Schema: id (int auto), project_id, url, render_mode, language, title, meta_description,
 * headings, sections, paragraphs, lists, tables, internal_links, external_links, images,
 * structured_data, content_text, content_hash, crawled_at, raw_html
 */
import { Pool } from 'pg';
import * as crypto from 'crypto';

export interface NormalizedContent {
  project_id: string;
  url: string;
  render_mode: 'html_only' | 'js_render';
  title?: string;
  meta_description?: string;
  headings?: any[];
  internal_links?: string[];
  external_links?: string[];
  images?: { src: string; alt?: string }[];
  structured_data?: any[];
  content_text?: string;
  content_hash: string;
  raw_html?: string;
  http_status?: number;
  response_time_ms?: number;
  load_time_ms?: number;
}

export interface PageContentRecord {
  id: number;
  projectId: string;
  url: string;
  renderMode: string;
  title?: string;
  metaDescription?: string;
  headings?: any[];
  internalLinks?: string[];
  externalLinks?: string[];
  images?: any[];
  structuredData?: any[];
  contentText?: string;
  contentHash: string;
  rawHtml?: string;
  crawledAt: Date;
}

export class PageContentRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Store normalized page content
   */
  async storeContent(content: NormalizedContent): Promise<PageContentRecord> {
    const result = await this.pool.query(
      `INSERT INTO page_content_normalized (
        project_id, url, render_mode, title, meta_description,
        headings, internal_links, external_links, images, structured_data,
        content_text, content_hash, raw_html, http_status, response_time_ms, load_time_ms, crawled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (project_id, url) DO UPDATE SET
        render_mode = EXCLUDED.render_mode,
        title = EXCLUDED.title,
        meta_description = EXCLUDED.meta_description,
        headings = EXCLUDED.headings,
        internal_links = EXCLUDED.internal_links,
        external_links = EXCLUDED.external_links,
        images = EXCLUDED.images,
        structured_data = EXCLUDED.structured_data,
        content_text = EXCLUDED.content_text,
        content_hash = EXCLUDED.content_hash,
        raw_html = EXCLUDED.raw_html,
        http_status = EXCLUDED.http_status,
        response_time_ms = EXCLUDED.response_time_ms,
        load_time_ms = EXCLUDED.load_time_ms,
        crawled_at = NOW()
      RETURNING *`,
      [
        content.project_id,
        content.url,
        content.render_mode,
        content.title,
        content.meta_description,
        JSON.stringify(content.headings || []),
        JSON.stringify(content.internal_links || []),
        JSON.stringify(content.external_links || []),
        JSON.stringify(content.images || []),
        JSON.stringify(content.structured_data || []),
        content.content_text,
        content.content_hash,
        content.raw_html,
        content.http_status,
        content.response_time_ms,
        content.load_time_ms,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Compute content hash for deduplication
   */
  computeContentHash(content: Partial<NormalizedContent>): string {
    const data = JSON.stringify({
      title: content.title,
      meta_description: content.meta_description,
      h1: content.headings?.find((h: any) => h.level === 1)?.text,
      word_count: content.content_text?.split(/\s+/).length || 0,
    });
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  private mapRow(row: any): PageContentRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      url: row.url,
      renderMode: row.render_mode,
      title: row.title,
      metaDescription: row.meta_description,
      headings: row.headings,
      internalLinks: row.internal_links,
      externalLinks: row.external_links,
      images: row.images,
      structuredData: row.structured_data,
      contentText: row.content_text,
      contentHash: row.content_hash,
      rawHtml: row.raw_html,
      crawledAt: row.crawled_at,
    };
  }
}
