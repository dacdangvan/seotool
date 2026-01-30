/**
 * URL Inventory Repository - Tracks URLs discovered and crawled
 * Schema matches database: id (int), project_id, url, state, depth, discovered_from,
 * first_seen_at, last_crawled_at, last_crawl_job_id, http_status, content_hash
 */
import { Pool } from 'pg';

export type UrlState = 'DISCOVERED' | 'CRAWLED' | 'FAILED' | 'SKIPPED';

export interface UrlInventoryRecord {
  id?: number;
  projectId: string;
  url: string;
  state: UrlState;
  depth?: number;
  discoveredFrom?: string;
  firstSeenAt?: Date;
  lastCrawledAt?: Date;
  lastCrawlJobId?: string;
  httpStatus?: number;
  contentHash?: string;
}

export class UrlInventoryRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Upsert a URL into inventory
   */
  async upsertUrl(projectId: string, url: string, crawlJobId?: string, depth: number = 0): Promise<UrlInventoryRecord> {
    const normalizedUrl = this.normalizeUrl(url);

    const result = await this.pool.query(
      `INSERT INTO url_inventory (project_id, url, state, depth, last_crawl_job_id, first_seen_at)
       VALUES ($1, $2, 'DISCOVERED', $3, $4, NOW())
       ON CONFLICT (project_id, url) DO UPDATE SET 
         last_crawl_job_id = COALESCE($4, url_inventory.last_crawl_job_id)
       RETURNING *`,
      [projectId, normalizedUrl, depth, crawlJobId]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get URL by URL string
   */
  async getUrlByUrl(projectId: string, url: string): Promise<UrlInventoryRecord | null> {
    const normalizedUrl = this.normalizeUrl(url);
    const result = await this.pool.query(
      `SELECT * FROM url_inventory WHERE project_id = $1 AND url = $2`,
      [projectId, normalizedUrl]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Mark URL as crawled with http status
   */
  async markCrawled(urlId: number, httpStatus?: number, contentHash?: string): Promise<void> {
    await this.pool.query(
      `UPDATE url_inventory SET state = 'CRAWLED', last_crawled_at = NOW(), http_status = $2, content_hash = $3 WHERE id = $1`,
      [urlId, httpStatus, contentHash]
    );
  }

  /**
   * Mark URL as failed
   */
  async markFailed(urlId: number, httpStatus?: number): Promise<void> {
    await this.pool.query(
      `UPDATE url_inventory SET state = 'FAILED', last_crawled_at = NOW(), http_status = $2 WHERE id = $1`,
      [urlId, httpStatus]
    );
  }

  /**
   * Get crawl job stats
   */
  async getCrawlJobStats(jobId: string): Promise<{ urls_crawled: number; content_stored: number }> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE state = 'CRAWLED') as urls_crawled,
        COUNT(*) FILTER (WHERE state = 'CRAWLED') as content_stored
       FROM url_inventory WHERE last_crawl_job_id = $1`,
      [jobId]
    );
    return {
      urls_crawled: parseInt(result.rows[0].urls_crawled || '0'),
      content_stored: parseInt(result.rows[0].content_stored || '0'),
    };
  }

  /**
   * Get all QUEUED URLs for a project (manually added URLs pending crawl)
   */
  async getQueuedUrls(projectId: string): Promise<UrlInventoryRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM url_inventory WHERE project_id = $1 AND state = 'QUEUED' ORDER BY first_seen_at ASC`,
      [projectId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Mark URL as queued (for manual URL additions)
   */
  async markQueued(urlId: number): Promise<void> {
    await this.pool.query(
      `UPDATE url_inventory SET state = 'QUEUED' WHERE id = $1`,
      [urlId]
    );
  }

  /**
   * Normalize URL for comparison
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash, lowercase hostname
      let normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}`;
      if (parsed.port) normalized += `:${parsed.port}`;
      normalized += parsed.pathname.replace(/\/+$/, '') || '/';
      if (parsed.search) normalized += parsed.search;
      return normalized;
    } catch {
      return url.toLowerCase();
    }
  }

  private mapRow(row: any): UrlInventoryRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      url: row.url,
      state: row.state,
      depth: row.depth,
      discoveredFrom: row.discovered_from,
      firstSeenAt: row.first_seen_at,
      lastCrawledAt: row.last_crawled_at,
      lastCrawlJobId: row.last_crawl_job_id,
      httpStatus: row.http_status,
      contentHash: row.content_hash,
    };
  }
}
