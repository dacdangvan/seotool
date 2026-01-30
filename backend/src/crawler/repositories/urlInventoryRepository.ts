/**
 * URL Inventory Repository
 *
 * Manages URL inventory persistence and state transitions
 * Following AI_SEO_TOOL_PROMPT_BOOK.md Section 11.4
 */

import { Pool } from 'pg';

export enum UrlState {
  DISCOVERED = 'DISCOVERED',
  PROCESSING = 'PROCESSING',
  CRAWLED = 'CRAWLED',
  FAILED = 'FAILED',
  BLOCKED_BY_POLICY = 'BLOCKED_BY_POLICY'
}

export interface UrlInventoryRecord {
  id?: number;
  project_id: string;
  url: string;
  state: UrlState;
  depth?: number;
  discovered_from?: string;
  first_seen_at?: Date;
  last_crawled_at?: Date;
  last_crawl_job_id?: string;
  http_status?: number;
  content_hash?: string;
}

export class UrlInventoryRepository {
  constructor(private pool: Pool) {}

  /**
   * Insert or update URL in inventory
   * Initial state MUST be DISCOVERED
   */
  async upsertUrl(
    projectId: string,
    url: string,
    crawlJobId: string
  ): Promise<UrlInventoryRecord> {
    const query = `
      INSERT INTO url_inventory (
        project_id, url, state, last_crawl_job_id, first_seen_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (project_id, url)
      DO UPDATE SET
        last_crawl_job_id = EXCLUDED.last_crawl_job_id
      RETURNING *;
    `;

    const result = await this.pool.query(query, [
      projectId,
      url,
      UrlState.DISCOVERED,
      crawlJobId
    ]);

    return result.rows[0];
  }

  /**
   * Update URL state to PROCESSING
   */
  async markProcessing(urlId: string): Promise<void> {
    await this.pool.query(
      'UPDATE url_inventory SET state = $1, updated_at = NOW() WHERE id = $2',
      [UrlState.PROCESSING, urlId]
    );
  }

  /**
   * Update URL state to CRAWLED (ONLY after content storage succeeds)
   */
  async markCrawled(urlId: number): Promise<void> {
    await this.pool.query(
      `UPDATE url_inventory
       SET state = $1, last_crawled_at = NOW()
       WHERE id = $2`,
      [UrlState.CRAWLED, urlId]
    );
  }

  /**
   * Update URL state to FAILED with reason
   */
  async markFailed(urlId: number, reason?: string): Promise<void> {
    await this.pool.query(
      `UPDATE url_inventory
       SET state = $1, http_status = $2
       WHERE id = $3`,
      [UrlState.FAILED, reason ? 500 : null, urlId] // Using http_status to store error code
    );
  }

  /**
   * Get URL by URL and project
   */
  async getUrlByUrl(projectId: string, url: string): Promise<UrlInventoryRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM url_inventory WHERE project_id = $1 AND url = $2',
      [projectId, url]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all URLs for a crawl job
   */
  async getUrlsByCrawlJob(crawlJobId: string): Promise<UrlInventoryRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM url_inventory WHERE last_crawl_job_id = $1 ORDER BY first_seen_at',
      [crawlJobId]
    );

    return result.rows;
  }

  /**
   * Get crawl job statistics
   */
  async getCrawlJobStats(crawlJobId: string): Promise<{
    urls_discovered: number;
    urls_crawled: number;
    urls_failed: number;
    content_stored: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as urls_discovered,
        COUNT(CASE WHEN state = 'CRAWLED' THEN 1 END) as urls_crawled,
        COUNT(CASE WHEN state = 'FAILED' THEN 1 END) as urls_failed,
        (SELECT COUNT(*) FROM page_content_normalized WHERE url IN (
          SELECT url FROM url_inventory WHERE last_crawl_job_id = $1
        )) as content_stored
      FROM url_inventory
      WHERE last_crawl_job_id = $1;
    `;

    const result = await this.pool.query(query, [crawlJobId]);
    return result.rows[0];
  }
}
