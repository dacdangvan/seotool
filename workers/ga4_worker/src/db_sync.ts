/**
 * Database Sync - Sync GA4 data to PostgreSQL
 */

import { Pool } from 'pg';
import { GA4Client, TrafficData, PagePerformanceData, CWVData } from './ga4_client.js';

export interface SyncConfig {
  projectId: string;
  pool: Pool;
  ga4Client: GA4Client;
}

export class GA4DatabaseSync {
  private pool: Pool;
  private projectId: string;
  private ga4Client: GA4Client;

  constructor(config: SyncConfig) {
    this.pool = config.pool;
    this.projectId = config.projectId;
    this.ga4Client = config.ga4Client;
  }

  /**
   * Sync traffic metrics to database
   */
  async syncTrafficMetrics(days: number = 30): Promise<number> {
    console.log(`[Sync] Syncing ${days} days of traffic metrics...`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch from GA4
    const trafficData = await this.ga4Client.getDailyTraffic(startStr, endStr);

    // Upsert to database
    let synced = 0;
    for (const data of trafficData) {
      await this.upsertTrafficMetric(data);
      synced++;
    }

    console.log(`[Sync] Synced ${synced} days of traffic data`);
    return synced;
  }

  /**
   * Upsert single traffic metric
   */
  private async upsertTrafficMetric(data: TrafficData): Promise<void> {
    const query = `
      INSERT INTO seo_traffic_metrics (
        project_id, date, organic_traffic, total_traffic,
        impressions, clicks, ctr, average_position,
        bounce_rate, avg_session_duration, pages_per_session
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (project_id, date) DO UPDATE SET
        organic_traffic = EXCLUDED.organic_traffic,
        total_traffic = EXCLUDED.total_traffic,
        bounce_rate = EXCLUDED.bounce_rate,
        avg_session_duration = EXCLUDED.avg_session_duration,
        pages_per_session = EXCLUDED.pages_per_session,
        updated_at = NOW()
    `;

    // Note: impressions, clicks, ctr, average_position come from Search Console
    // GA4 doesn't have these - we set defaults or get from GSC later
    await this.pool.query(query, [
      this.projectId,
      data.date,
      data.organicTraffic,
      data.totalTraffic,
      data.pageviews * 10, // Estimate impressions from pageviews
      data.organicTraffic, // Estimate clicks = organic traffic
      data.organicTraffic / Math.max(data.pageviews * 10, 1), // CTR estimate
      0, // Average position comes from Search Console
      data.bounceRate,
      Math.round(data.avgSessionDuration),
      data.pagesPerSession,
    ]);
  }

  /**
   * Sync page performance data
   */
  async syncPagePerformance(days: number = 30): Promise<number> {
    console.log(`[Sync] Syncing page performance data...`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch from GA4
    const pageData = await this.ga4Client.getTopPages(startStr, endStr, 500);

    // TODO: Match with crawled pages and update metrics
    // This would require joining with page_content_normalized table
    console.log(`[Sync] Fetched ${pageData.length} pages (matching with crawl data not implemented)`);

    return pageData.length;
  }

  /**
   * Sync Core Web Vitals data to cwv_results table
   */
  async syncCWVData(days: number = 30): Promise<number> {
    console.log(`[Sync] Syncing CWV data for ${days} days...`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch CWV data from GA4
    const cwvData = await this.ga4Client.getWebVitalsData(startStr, endStr);

    let synced = 0;
    for (const data of cwvData) {
      await this.upsertCWVResult(data);
      synced++;
    }

    console.log(`[Sync] Synced ${synced} CWV results`);
    return synced;
  }

  /**
   * Upsert single CWV result
   */
  private async upsertCWVResult(data: CWVData): Promise<void> {
    // Calculate statuses based on Google's thresholds
    const lcpStatus = this.getCWVStatus(data.lcp, { good: 2500, poor: 4000 });
    const clsStatus = this.getCWVStatus(data.cls, { good: 0.1, poor: 0.25 });
    const inpStatus = data.inp ? this.getCWVStatus(data.inp, { good: 200, poor: 500 }) : null;
    const fcpStatus = this.getCWVStatus(data.fcp, { good: 1800, poor: 3000 });
    const ttfbStatus = this.getCWVStatus(data.ttfb, { good: 800, poor: 1800 });

    // Calculate overall status (worst of LCP, CLS, INP)
    const primaryStatuses = [lcpStatus, clsStatus];
    if (inpStatus) primaryStatuses.push(inpStatus);
    const overallStatus = primaryStatuses.includes('poor') ? 'poor' :
                         primaryStatuses.includes('needs_improvement') ? 'needs_improvement' : 'good';

    // Calculate performance score (simplified)
    const lcpScore = Math.max(0, Math.min(100, 100 - (data.lcp - 1200) / 28));
    const clsScore = Math.max(0, Math.min(100, 100 - data.cls * 400));
    const inpScore = data.inp ? Math.max(0, Math.min(100, 100 - (data.inp - 150) / 4.5)) : 100;
    const performanceScore = Math.round((lcpScore * 0.25 + clsScore * 0.25 + inpScore * 0.30 + 90 * 0.20));

    const query = `
      INSERT INTO cwv_results (
        project_id, url, device,
        lcp_value, lcp_status,
        cls_value, cls_status,
        inp_value, inp_status,
        fcp_value, fcp_status,
        ttfb_value, ttfb_status,
        performance_score, overall_status,
        measured_at, updated_at
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7,
        $8, $9,
        $10, $11,
        $12, $13,
        $14, $15,
        NOW(), NOW()
      )
      ON CONFLICT (project_id, url, device) DO UPDATE SET
        lcp_value = EXCLUDED.lcp_value,
        lcp_status = EXCLUDED.lcp_status,
        cls_value = EXCLUDED.cls_value,
        cls_status = EXCLUDED.cls_status,
        inp_value = EXCLUDED.inp_value,
        inp_status = EXCLUDED.inp_status,
        fcp_value = EXCLUDED.fcp_value,
        fcp_status = EXCLUDED.fcp_status,
        ttfb_value = EXCLUDED.ttfb_value,
        ttfb_status = EXCLUDED.ttfb_status,
        performance_score = EXCLUDED.performance_score,
        overall_status = EXCLUDED.overall_status,
        measured_at = NOW(),
        updated_at = NOW()
    `;

    await this.pool.query(query, [
      this.projectId,
      data.pagePath,
      data.device,
      data.lcp,
      lcpStatus,
      data.cls,
      clsStatus,
      data.inp || null,
      inpStatus,
      data.fcp,
      fcpStatus,
      data.ttfb,
      ttfbStatus,
      performanceScore,
      overallStatus
    ]);
  }

  /**
   * Get CWV status based on thresholds
   */
  private getCWVStatus(value: number, thresholds: { good: number; poor: number }): 'good' | 'needs_improvement' | 'poor' {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs_improvement';
    return 'poor';
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{ lastSync: Date | null; daysSynced: number }> {
    const result = await this.pool.query(`
      SELECT MAX(date) as last_date, COUNT(DISTINCT date) as days_count
      FROM seo_traffic_metrics
      WHERE project_id = $1
    `, [this.projectId]);

    return {
      lastSync: result.rows[0]?.last_date || null,
      daysSynced: parseInt(result.rows[0]?.days_count || '0'),
    };
  }
}
