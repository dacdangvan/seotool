/**
 * Postgres CWV Results Repository
 *
 * Repository for accessing Core Web Vitals data from database
 * Following crawl-centric data architecture from AI_SEO_TOOL_PROMPT_BOOK.md
 */

import { Pool } from 'pg';
import { Logger } from '../../shared/Logger';

export interface CWVResult {
  id: string;
  project_id: string;
  url: string;
  device: 'mobile' | 'desktop';
  lcp_value: number;
  lcp_status: 'good' | 'needs_improvement' | 'poor';
  inp_value?: number;
  inp_status?: 'good' | 'needs_improvement' | 'poor';
  cls_value: number;
  cls_status: 'good' | 'needs_improvement' | 'poor';
  fcp_value: number;
  fcp_status: 'good' | 'needs_improvement' | 'poor';
  ttfb_value: number;
  ttfb_status: 'good' | 'needs_improvement' | 'poor';
  si_value?: number;
  si_status?: 'good' | 'needs_improvement' | 'poor';
  tbt_value?: number;
  tbt_status?: 'good' | 'needs_improvement' | 'poor';
  performance_score: number;
  overall_status: 'good' | 'needs_improvement' | 'poor';
  lighthouse_version?: string;
  user_agent?: string;
  raw_report?: any;
  measured_at: string;
  created_at: string;
}

export class PostgresCWVResultsRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresCWVResultsRepository');
  }

  /**
   * Get CWV results for a specific URL and device
   */
  async getCWVForUrl(
    projectId: string,
    url: string,
    device: 'mobile' | 'desktop' = 'mobile'
  ): Promise<CWVResult[]> {
    try {
      const query = `
        SELECT * FROM cwv_results
        WHERE project_id = $1 AND url = $2 AND device = $3
        ORDER BY measured_at DESC
        LIMIT 10
      `;
      const result = await this.pool.query(query, [projectId, url, device]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting CWV for URL', { error, projectId, url, device });
      throw error;
    }
  }

  /**
   * Get CWV results for multiple URLs (batch)
   */
  async getBatchCWV(
    projectId: string,
    urls: string[],
    device: 'mobile' | 'desktop' = 'mobile'
  ): Promise<Map<string, CWVResult[]>> {
    try {
      const result = new Map<string, CWVResult[]>();

      // Get CWV data for all URLs in one query
      const placeholders = urls.map((_, i) => `$${i + 3}`).join(',');
      const query = `
        SELECT * FROM cwv_results
        WHERE project_id = $1 AND device = $2 AND url IN (${placeholders})
        ORDER BY url, measured_at DESC
      `;

      const params = [projectId, device, ...urls];
      const queryResult = await this.pool.query(query, params);

      // Group by URL
      for (const row of queryResult.rows) {
        if (!result.has(row.url)) {
          result.set(row.url, []);
        }
        result.get(row.url)!.push(row);
      }

      // Ensure all requested URLs have entries (even if empty)
      for (const url of urls) {
        if (!result.has(url)) {
          result.set(url, []);
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Error getting batch CWV', { error, projectId, urls, device });
      throw error;
    }
  }

  /**
   * Get latest CWV results for a project
   */
  async getLatestCWVResults(projectId: string, limit = 100): Promise<CWVResult[]> {
    try {
      const query = `
        SELECT DISTINCT ON (url, device) * FROM cwv_results
        WHERE project_id = $1
        ORDER BY url, device, measured_at DESC
        LIMIT $2
      `;
      const result = await this.pool.query(query, [projectId, limit]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting latest CWV results', { error, projectId });
      throw error;
    }
  }
}
