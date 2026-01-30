/**
 * PostgreSQL Repository for SEO Metrics
 * Handles all SEO data: traffic, keywords, technical health, backlinks, KPIs
 */

import { Pool } from 'pg';
import { Logger } from '../../shared/Logger';
import { DatabaseError } from '../../shared/errors';

// =============================================================================
// TYPES
// =============================================================================

export interface SEOTrafficMetrics {
  projectId: string;
  date: Date;
  organicTraffic: number;
  totalTraffic: number;
  impressions: number;
  clicks: number;
  ctr: number;
  averagePosition: number;
  bounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
}

export interface SEOKeywordRanking {
  id: string;
  projectId: string;
  keyword: string;
  searchVolume: number;
  currentPosition: number;
  previousPosition: number;
  bestPosition: number;
  url: string;
  intent: 'informational' | 'navigational' | 'transactional' | 'commercial';
  difficulty: number;
  isTracked: boolean;
  lastUpdated: Date;
}

export interface SEOTechnicalHealth {
  projectId: string;
  date: Date;
  overallScore: number;
  lcpScore: number;
  fidScore: number;
  clsScore: number;
  inpScore: number;
  indexedPages: number;
  crawlErrors: number;
  brokenLinks: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  issues: any[];
}

export interface SEOBacklinkMetrics {
  projectId: string;
  date: Date;
  totalBacklinks: number;
  referringDomains: number;
  domainAuthority: number;
  dofollowLinks: number;
  nofollowLinks: number;
  newBacklinks: number;
  lostBacklinks: number;
  toxicScore: number;
}

export interface SEOKPISnapshot {
  projectId: string;
  date: Date;
  organicTraffic: number;
  trafficChangePercent: number;
  totalKeywords: number;
  keywordsTop3: number;
  keywordsTop10: number;
  keywordsTop100: number;
  averagePosition: number;
  seoHealthScore: number;
  domainAuthority: number;
  totalBacklinks: number;
  organicConversions: number;
  conversionRate: number;
  estimatedValue: number;
}

export interface SEOForecast {
  id: string;
  projectId: string;
  metric: string;
  periodDays: number;
  forecastDate: Date;
  lowEstimate: number;
  midEstimate: number;
  highEstimate: number;
  confidence: number;
  modelVersion: string;
}

export interface SEORecommendation {
  id: string;
  projectId: string;
  category: 'technical' | 'content' | 'keywords' | 'backlinks' | 'ux';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  autoExecutable: boolean;
  actionData: any;
  createdAt: Date;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// =============================================================================
// REPOSITORY
// =============================================================================

export class PostgresSEOMetricsRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresSEOMetricsRepository');
  }

  // ===========================================================================
  // TRAFFIC METRICS
  // ===========================================================================

  async getTrafficMetrics(projectId: string, range: DateRange): Promise<SEOTrafficMetrics[]> {
    // Get GA4 traffic data
    const ga4Query = `
      SELECT * FROM seo_traffic_metrics 
      WHERE project_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date DESC
    `;

    // Get aggregated GSC search analytics data
    const gscQuery = `
      SELECT 
        date,
        SUM(clicks) as total_clicks,
        SUM(impressions) as total_impressions,
        AVG(ctr) as avg_ctr,
        AVG(position) as avg_position
      FROM gsc_search_analytics 
      WHERE project_id = $1 AND date >= $2 AND date <= $3
      GROUP BY date
      ORDER BY date DESC
    `;

    try {
      // Execute both queries in parallel
      const [ga4Result, gscResult] = await Promise.all([
        this.pool.query(ga4Query, [projectId, range.startDate, range.endDate]),
        this.pool.query(gscQuery, [projectId, range.startDate, range.endDate])
      ]);

      // Create maps for easy lookup
      const gscDataMap = new Map();
      gscResult.rows.forEach(row => {
        gscDataMap.set(row.date.toISOString().split('T')[0], {
          clicks: parseInt(row.total_clicks) || 0,
          impressions: parseInt(row.total_impressions) || 0,
          ctr: parseFloat(row.avg_ctr) || 0,
          position: parseFloat(row.avg_position) || 0,
        });
      });

      // Merge GA4 and GSC data
      const mergedMetrics = ga4Result.rows.map(ga4Row => {
        const dateKey = ga4Row.date.toISOString().split('T')[0];
        const gscData = gscDataMap.get(dateKey);

        return {
          projectId: ga4Row.project_id,
          date: ga4Row.date,
          // GA4 traffic data
          organicTraffic: parseInt(ga4Row.organic_traffic) || 0,
          totalTraffic: parseInt(ga4Row.total_traffic) || 0,
          bounceRate: parseFloat(ga4Row.bounce_rate) || 0,
          avgSessionDuration: parseInt(ga4Row.avg_session_duration) || 0,
          pagesPerSession: parseFloat(ga4Row.pages_per_session) || 0,
          // GSC search data (prefer over GA4 estimates)
          impressions: gscData?.impressions || parseInt(ga4Row.impressions) || 0,
          clicks: gscData?.clicks || parseInt(ga4Row.clicks) || 0,
          ctr: gscData?.ctr || parseFloat(ga4Row.ctr) || 0,
          averagePosition: gscData?.position || parseFloat(ga4Row.average_position) || 0,
        };
      });

      return mergedMetrics;
    } catch (error) {
      this.logger.error('Failed to get traffic metrics', { error, projectId });
      throw new DatabaseError('Failed to get traffic metrics');
    }
  }

  async getLatestTrafficMetrics(projectId: string): Promise<SEOTrafficMetrics | null> {
    // Get latest GA4 traffic data
    const ga4Query = `
      SELECT * FROM seo_traffic_metrics 
      WHERE project_id = $1 
      ORDER BY date DESC 
      LIMIT 1
    `;

    // Get latest GSC search analytics data
    const gscQuery = `
      SELECT 
        date,
        SUM(clicks) as total_clicks,
        SUM(impressions) as total_impressions,
        AVG(ctr) as avg_ctr,
        AVG(position) as avg_position
      FROM gsc_search_analytics 
      WHERE project_id = $1 
      ORDER BY date DESC 
      LIMIT 1
    `;

    try {
      // Execute both queries in parallel
      const [ga4Result, gscResult] = await Promise.all([
        this.pool.query(ga4Query, [projectId]),
        this.pool.query(gscQuery, [projectId])
      ]);

      if (ga4Result.rows.length === 0) return null;

      const ga4Row = ga4Result.rows[0];
      const gscRow = gscResult.rows.length > 0 ? gscResult.rows[0] : null;

      // Merge GA4 and GSC data for the latest date
      const mergedMetric = {
        projectId: ga4Row.project_id,
        date: ga4Row.date,
        // GA4 traffic data
        organicTraffic: parseInt(ga4Row.organic_traffic) || 0,
        totalTraffic: parseInt(ga4Row.total_traffic) || 0,
        bounceRate: parseFloat(ga4Row.bounce_rate) || 0,
        avgSessionDuration: parseInt(ga4Row.avg_session_duration) || 0,
        pagesPerSession: parseFloat(ga4Row.pages_per_session) || 0,
        // GSC search data (prefer over GA4 estimates, fallback to GA4 if no GSC data)
        impressions: gscRow ? parseInt(gscRow.total_impressions) || 0 : parseInt(ga4Row.impressions) || 0,
        clicks: gscRow ? parseInt(gscRow.total_clicks) || 0 : parseInt(ga4Row.clicks) || 0,
        ctr: gscRow ? parseFloat(gscRow.avg_ctr) || 0 : parseFloat(ga4Row.ctr) || 0,
        averagePosition: gscRow ? parseFloat(gscRow.avg_position) || 0 : parseFloat(ga4Row.average_position) || 0,
      };

      return mergedMetric;
    } catch (error) {
      this.logger.error('Failed to get latest traffic metrics', { error, projectId });
      // If combined query fails, fallback to GA4 only
      try {
        const ga4Result = await this.pool.query(ga4Query, [projectId]);
        if (ga4Result.rows.length === 0) return null;
        return this.mapTrafficRow(ga4Result.rows[0]);
      } catch (fallbackError) {
        this.logger.error('Fallback to GA4 only also failed', { fallbackError, projectId });
        throw new DatabaseError('Failed to get traffic metrics');
      }
    }
  }

  // ===========================================================================
  // KEYWORD RANKINGS
  // ===========================================================================

  async getKeywordRankings(projectId: string, options?: { tracked?: boolean; limit?: number }): Promise<SEOKeywordRanking[]> {
    let query = `SELECT * FROM seo_keyword_rankings WHERE project_id = $1`;
    const values: any[] = [projectId];

    if (options?.tracked !== undefined) {
      query += ` AND is_tracked = $2`;
      values.push(options.tracked);
    }

    query += ` ORDER BY search_volume DESC`;

    if (options?.limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(options.limit);
    }

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapKeywordRow(row));
    } catch (error) {
      this.logger.error('Failed to get keyword rankings', { error, projectId });
      throw new DatabaseError('Failed to get keyword rankings');
    }
  }

  async getTopKeywords(projectId: string, limit: number = 10): Promise<SEOKeywordRanking[]> {
    const query = `
      SELECT * FROM seo_keyword_rankings 
      WHERE project_id = $1 AND current_position <= 10
      ORDER BY search_volume DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query(query, [projectId, limit]);
      return result.rows.map(row => this.mapKeywordRow(row));
    } catch (error) {
      this.logger.error('Failed to get top keywords', { error, projectId });
      throw new DatabaseError('Failed to get top keywords');
    }
  }

  async getKeywordStats(projectId: string): Promise<{
    total: number;
    top3: number;
    top10: number;
    top100: number;
    avgPosition: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE current_position <= 3) as top3,
        COUNT(*) FILTER (WHERE current_position <= 10) as top10,
        COUNT(*) FILTER (WHERE current_position <= 100) as top100,
        AVG(current_position) as avg_position
      FROM seo_keyword_rankings 
      WHERE project_id = $1 AND is_tracked = true
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      const row = result.rows[0];
      return {
        total: parseInt(row.total) || 0,
        top3: parseInt(row.top3) || 0,
        top10: parseInt(row.top10) || 0,
        top100: parseInt(row.top100) || 0,
        avgPosition: parseFloat(row.avg_position) || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get keyword stats', { error, projectId });
      throw new DatabaseError('Failed to get keyword stats');
    }
  }

  // ===========================================================================
  // TECHNICAL HEALTH
  // ===========================================================================

  async getTechnicalHealth(projectId: string, range: DateRange): Promise<SEOTechnicalHealth[]> {
    const query = `
      SELECT * FROM seo_technical_health 
      WHERE project_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId, range.startDate, range.endDate]);
      return result.rows.map(row => this.mapTechnicalHealthRow(row));
    } catch (error) {
      this.logger.error('Failed to get technical health', { error, projectId });
      throw new DatabaseError('Failed to get technical health');
    }
  }

  async getLatestTechnicalHealth(projectId: string): Promise<SEOTechnicalHealth | null> {
    const query = `
      SELECT * FROM seo_technical_health 
      WHERE project_id = $1 
      ORDER BY date DESC 
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      if (result.rows.length === 0) return null;
      return this.mapTechnicalHealthRow(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get latest technical health', { error, projectId });
      throw new DatabaseError('Failed to get technical health');
    }
  }

  // ===========================================================================
  // BACKLINK METRICS
  // ===========================================================================

  async getBacklinkMetrics(projectId: string, range: DateRange): Promise<SEOBacklinkMetrics[]> {
    const query = `
      SELECT * FROM seo_backlink_metrics 
      WHERE project_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId, range.startDate, range.endDate]);
      return result.rows.map(row => this.mapBacklinkRow(row));
    } catch (error) {
      this.logger.error('Failed to get backlink metrics', { error, projectId });
      throw new DatabaseError('Failed to get backlink metrics');
    }
  }

  async getLatestBacklinkMetrics(projectId: string): Promise<SEOBacklinkMetrics | null> {
    const query = `
      SELECT * FROM seo_backlink_metrics 
      WHERE project_id = $1 
      ORDER BY date DESC 
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      if (result.rows.length === 0) return null;
      return this.mapBacklinkRow(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get latest backlink metrics', { error, projectId });
      throw new DatabaseError('Failed to get backlink metrics');
    }
  }

  // ===========================================================================
  // KPI SNAPSHOTS
  // ===========================================================================

  async getKPISnapshots(projectId: string, range: DateRange): Promise<SEOKPISnapshot[]> {
    const query = `
      SELECT * FROM seo_kpi_snapshots 
      WHERE project_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId, range.startDate, range.endDate]);
      return result.rows.map(row => this.mapKPIRow(row));
    } catch (error) {
      this.logger.error('Failed to get KPI snapshots', { error, projectId });
      throw new DatabaseError('Failed to get KPI snapshots');
    }
  }

  async getLatestKPISnapshot(projectId: string): Promise<SEOKPISnapshot | null> {
    const query = `
      SELECT * FROM seo_kpi_snapshots 
      WHERE project_id = $1 
      ORDER BY date DESC 
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      if (result.rows.length === 0) return null;
      return this.mapKPIRow(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get latest KPI snapshot', { error, projectId });
      throw new DatabaseError('Failed to get KPI snapshot');
    }
  }

  // ===========================================================================
  // FORECASTS
  // ===========================================================================

  async getForecasts(projectId: string, metric?: string): Promise<SEOForecast[]> {
    let query = `SELECT * FROM seo_forecasts WHERE project_id = $1`;
    const values: any[] = [projectId];

    if (metric) {
      query += ` AND metric = $2`;
      values.push(metric);
    }

    query += ` ORDER BY period_days ASC`;

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapForecastRow(row));
    } catch (error) {
      this.logger.error('Failed to get forecasts', { error, projectId });
      throw new DatabaseError('Failed to get forecasts');
    }
  }

  // ===========================================================================
  // RECOMMENDATIONS
  // ===========================================================================

  async getRecommendations(projectId: string, options?: { 
    status?: string; 
    priority?: string; 
    limit?: number 
  }): Promise<SEORecommendation[]> {
    let query = `SELECT * FROM seo_recommendations WHERE project_id = $1`;
    const values: any[] = [projectId];
    let paramIndex = 2;

    if (options?.status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(options.status);
    }
    if (options?.priority) {
      query += ` AND priority = $${paramIndex++}`;
      values.push(options.priority);
    }

    query += ` ORDER BY 
      CASE priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(options.limit);
    }

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapRecommendationRow(row));
    } catch (error) {
      this.logger.error('Failed to get recommendations', { error, projectId });
      throw new DatabaseError('Failed to get recommendations');
    }
  }

  async updateRecommendationStatus(id: string, status: string): Promise<boolean> {
    const query = `
      UPDATE seo_recommendations 
      SET status = $1, updated_at = $2 
      WHERE id = $3
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, [status, new Date(), id]);
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Failed to update recommendation status', { error, id });
      throw new DatabaseError('Failed to update recommendation');
    }
  }

  /**
   * Create a single recommendation
   * Used by AI agents to store generated recommendations
   */
  async createRecommendation(recommendation: Omit<SEORecommendation, 'id' | 'createdAt'>): Promise<SEORecommendation> {
    const query = `
      INSERT INTO seo_recommendations (
        project_id, category, priority, title, description, 
        impact, effort, status, auto_executable, action_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      recommendation.projectId,
      recommendation.category,
      recommendation.priority,
      recommendation.title,
      recommendation.description,
      recommendation.impact,
      recommendation.effort,
      recommendation.status || 'pending',
      recommendation.autoExecutable || false,
      JSON.stringify(recommendation.actionData || {}),
    ];

    try {
      const result = await this.pool.query(query, values);
      this.logger.info('Recommendation created', { 
        id: result.rows[0].id, 
        projectId: recommendation.projectId,
        category: recommendation.category,
        title: recommendation.title 
      });
      return this.mapRecommendationRow(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to create recommendation', { error, recommendation });
      throw new DatabaseError('Failed to create recommendation');
    }
  }

  /**
   * Create multiple recommendations in a batch
   * Used by AI agents to store multiple recommendations at once
   */
  async createRecommendations(recommendations: Omit<SEORecommendation, 'id' | 'createdAt'>[]): Promise<SEORecommendation[]> {
    if (recommendations.length === 0) return [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const createdRecommendations: SEORecommendation[] = [];

      for (const rec of recommendations) {
        const query = `
          INSERT INTO seo_recommendations (
            project_id, category, priority, title, description, 
            impact, effort, status, auto_executable, action_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;

        const values = [
          rec.projectId,
          rec.category,
          rec.priority,
          rec.title,
          rec.description,
          rec.impact,
          rec.effort,
          rec.status || 'pending',
          rec.autoExecutable || false,
          JSON.stringify(rec.actionData || {}),
        ];

        const result = await client.query(query, values);
        createdRecommendations.push(this.mapRecommendationRow(result.rows[0]));
      }

      await client.query('COMMIT');
      
      this.logger.info('Batch recommendations created', { 
        count: createdRecommendations.length,
        projectId: recommendations[0]?.projectId 
      });

      return createdRecommendations;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create batch recommendations', { error });
      throw new DatabaseError('Failed to create batch recommendations');
    } finally {
      client.release();
    }
  }

  /**
   * Delete recommendations by project and optionally by source
   * Used to clean up before regenerating recommendations
   */
  async deleteRecommendations(projectId: string, options?: { 
    source?: string;
    category?: string;
    olderThan?: Date;
  }): Promise<number> {
    let query = `DELETE FROM seo_recommendations WHERE project_id = $1`;
    const values: any[] = [projectId];
    let paramIndex = 2;

    if (options?.category) {
      query += ` AND category = $${paramIndex++}`;
      values.push(options.category);
    }

    if (options?.source) {
      query += ` AND action_data->>'source' = $${paramIndex++}`;
      values.push(options.source);
    }

    if (options?.olderThan) {
      query += ` AND created_at < $${paramIndex++}`;
      values.push(options.olderThan);
    }

    // Only delete pending recommendations (don't delete in_progress or completed)
    query += ` AND status = 'pending'`;

    try {
      this.logger.debug('Deleting recommendations', { query, values });
      const result = await this.pool.query(query, values);
      const deletedCount = result.rowCount ?? 0;
      this.logger.info('Recommendations deleted', { 
        projectId, 
        count: deletedCount,
        options 
      });
      return deletedCount;
    } catch (error: any) {
      this.logger.error('Failed to delete recommendations', { 
        error: error.message, 
        stack: error.stack,
        projectId,
        query,
        values 
      });
      throw new DatabaseError('Failed to delete recommendations');
    }
  }

  // ===========================================================================
  // DASHBOARD SUMMARY
  // ===========================================================================

  async getDashboardSummary(projectId: string): Promise<{
    traffic: SEOTrafficMetrics | null;
    keywordStats: { total: number; top3: number; top10: number; top100: number; avgPosition: number };
    technicalHealth: SEOTechnicalHealth | null;
    backlinks: SEOBacklinkMetrics | null;
    kpi: SEOKPISnapshot | null;
    forecasts: SEOForecast[];
    recommendations: SEORecommendation[];
  }> {
    const [traffic, keywordStats, technicalHealth, backlinks, kpi, forecasts, recommendations] = await Promise.all([
      this.getLatestTrafficMetrics(projectId),
      this.getKeywordStats(projectId),
      this.getLatestTechnicalHealth(projectId),
      this.getLatestBacklinkMetrics(projectId),
      this.getLatestKPISnapshot(projectId),
      this.getForecasts(projectId),
      this.getRecommendations(projectId, { status: 'pending', limit: 5 }),
    ]);

    return {
      traffic,
      keywordStats,
      technicalHealth,
      backlinks,
      kpi,
      forecasts,
      recommendations,
    };
  }

  /**
   * Get comprehensive dashboard summary V2 with all real data
   * No hardcoded values - everything from database
   */
  async getDashboardSummaryV2(projectId: string): Promise<{
    traffic: SEOTrafficMetrics | null;
    trafficHistory: SEOTrafficMetrics[];
    keywordStats: { total: number; top3: number; top10: number; top100: number; avgPosition: number };
    keywordChanges: { top3Change: number; top10Change: number };
    technicalHealth: SEOTechnicalHealth | null;
    technicalHealthHistory: SEOTechnicalHealth[];
    backlinks: SEOBacklinkMetrics | null;
    kpi: SEOKPISnapshot | null;
    forecasts: SEOForecast[];
    recommendations: SEORecommendation[];
    contentStats: { totalPages: number; highPerforming: number; needsOptimization: number; newContent: number };
    crawlStats: { totalPages: number; healthyPages: number; errorPages: number };
  }> {
    // Get date range for history (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Get date for previous period (for comparison)
    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - 60);
    const previousEndDate = new Date();
    previousEndDate.setDate(previousEndDate.getDate() - 30);

    const [
      traffic,
      trafficHistory,
      previousTraffic,
      keywordStats,
      previousKeywordStats,
      technicalHealth,
      technicalHealthHistory,
      backlinks,
      kpi,
      forecasts,
      recommendations,
      contentStats,
      crawlStats,
    ] = await Promise.all([
      this.getLatestTrafficMetrics(projectId),
      this.getTrafficMetrics(projectId, { startDate, endDate }),
      this.getTrafficMetrics(projectId, { startDate: previousStartDate, endDate: previousEndDate }),
      this.getKeywordStats(projectId),
      this.getKeywordStatsAtDate(projectId, previousEndDate),
      this.getLatestTechnicalHealth(projectId),
      this.getTechnicalHealth(projectId, { startDate, endDate }),
      this.getLatestBacklinkMetrics(projectId),
      this.getLatestKPISnapshot(projectId),
      this.getForecasts(projectId),
      this.getRecommendations(projectId, { status: 'pending', limit: 10 }),
      this.getContentStats(projectId),
      this.getCrawlStats(projectId),
    ]);

    // Calculate keyword changes
    const keywordChanges = {
      top3Change: keywordStats.top3 - (previousKeywordStats?.top3 || 0),
      top10Change: keywordStats.top10 - (previousKeywordStats?.top10 || 0),
    };

    return {
      traffic,
      trafficHistory,
      keywordStats,
      keywordChanges,
      technicalHealth,
      technicalHealthHistory,
      backlinks,
      kpi,
      forecasts,
      recommendations,
      contentStats,
      crawlStats,
    };
  }

  /**
   * Get keyword stats at a specific date (for comparison)
   */
  async getKeywordStatsAtDate(projectId: string, date: Date): Promise<{
    total: number;
    top3: number;
    top10: number;
    top100: number;
    avgPosition: number;
  } | null> {
    // For now, return current stats - in production, this should query historical data
    // or use seo_kpi_snapshots table which stores historical keyword stats
    const query = `
      SELECT 
        total_keywords as total,
        keywords_top_3 as top3,
        keywords_top_10 as top10,
        keywords_top_100 as top100,
        average_position as avg_position
      FROM seo_kpi_snapshots 
      WHERE project_id = $1 AND date <= $2
      ORDER BY date DESC
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [projectId, date]);
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        total: parseInt(row.total) || 0,
        top3: parseInt(row.top3) || 0,
        top10: parseInt(row.top10) || 0,
        top100: parseInt(row.top100) || 0,
        avgPosition: parseFloat(row.avg_position) || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get keyword stats at date', { error, projectId, date });
      return null;
    }
  }

  /**
   * Get content statistics from seo_content_metrics and crawled_pages
   */
  async getContentStats(projectId: string): Promise<{
    totalPages: number;
    highPerforming: number;
    needsOptimization: number;
    newContent: number;
  }> {
    // Get content metrics stats
    const contentQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN seo_score >= 80 THEN 1 END) as high_performing,
        COUNT(CASE WHEN seo_score BETWEEN 50 AND 79 THEN 1 END) as needs_optimization,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_content
      FROM seo_content_metrics 
      WHERE project_id = $1
    `;

    // Fallback to crawled_pages if seo_content_metrics is empty
    const crawledQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status_code = 200 AND title IS NOT NULL AND meta_description IS NOT NULL THEN 1 END) as high_performing,
        COUNT(CASE WHEN status_code = 200 AND (title IS NULL OR meta_description IS NULL OR jsonb_array_length(COALESCE(h1_tags, '[]'::jsonb)) = 0) THEN 1 END) as needs_optimization,
        COUNT(CASE WHEN crawled_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_content
      FROM crawled_pages 
      WHERE project_id = $1
    `;

    try {
      const contentResult = await this.pool.query(contentQuery, [projectId]);
      const contentRow = contentResult.rows[0];
      
      if (parseInt(contentRow.total) > 0) {
        return {
          totalPages: parseInt(contentRow.total) || 0,
          highPerforming: parseInt(contentRow.high_performing) || 0,
          needsOptimization: parseInt(contentRow.needs_optimization) || 0,
          newContent: parseInt(contentRow.new_content) || 0,
        };
      }

      // Fallback to crawled_pages
      const crawledResult = await this.pool.query(crawledQuery, [projectId]);
      const crawledRow = crawledResult.rows[0];
      return {
        totalPages: parseInt(crawledRow.total) || 0,
        highPerforming: parseInt(crawledRow.high_performing) || 0,
        needsOptimization: parseInt(crawledRow.needs_optimization) || 0,
        newContent: parseInt(crawledRow.new_content) || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get content stats', { error, projectId });
      return { totalPages: 0, highPerforming: 0, needsOptimization: 0, newContent: 0 };
    }
  }

  /**
   * Get crawl statistics
   */
  async getCrawlStats(projectId: string): Promise<{
    totalPages: number;
    healthyPages: number;
    errorPages: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_pages,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 END) as healthy_pages,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_pages
      FROM crawled_pages 
      WHERE project_id = $1
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      const row = result.rows[0];
      return {
        totalPages: parseInt(row.total_pages) || 0,
        healthyPages: parseInt(row.healthy_pages) || 0,
        errorPages: parseInt(row.error_pages) || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get crawl stats', { error, projectId });
      return { totalPages: 0, healthyPages: 0, errorPages: 0 };
    }
  }

  // ===========================================================================
  // MAPPERS
  // ===========================================================================

  private mapTrafficRow(row: any): SEOTrafficMetrics {
    return {
      projectId: row.project_id,
      date: row.date,
      organicTraffic: parseInt(row.organic_traffic) || 0,
      totalTraffic: parseInt(row.total_traffic) || 0,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      ctr: parseFloat(row.ctr) || 0,
      averagePosition: parseFloat(row.average_position) || 0,
      bounceRate: parseFloat(row.bounce_rate) || 0,
      avgSessionDuration: parseInt(row.avg_session_duration) || 0,
      pagesPerSession: parseFloat(row.pages_per_session) || 0,
    };
  }

  private mapKeywordRow(row: any): SEOKeywordRanking {
    return {
      id: row.id,
      projectId: row.project_id,
      keyword: row.keyword,
      searchVolume: parseInt(row.search_volume) || 0,
      currentPosition: parseInt(row.current_position) || 0,
      previousPosition: parseInt(row.previous_position) || 0,
      bestPosition: parseInt(row.best_position) || 0,
      url: row.url,
      intent: row.intent,
      difficulty: parseFloat(row.difficulty) || 0,
      isTracked: row.is_tracked,
      lastUpdated: row.last_updated,
    };
  }

  private mapTechnicalHealthRow(row: any): SEOTechnicalHealth {
    return {
      projectId: row.project_id,
      date: row.date,
      overallScore: parseInt(row.overall_score) || 0,
      lcpScore: parseFloat(row.lcp_score) || 0,
      fidScore: parseFloat(row.fid_score) || 0,
      clsScore: parseFloat(row.cls_score) || 0,
      inpScore: parseFloat(row.inp_score) || 0,
      indexedPages: parseInt(row.indexed_pages) || 0,
      crawlErrors: parseInt(row.crawl_errors) || 0,
      brokenLinks: parseInt(row.broken_links) || 0,
      criticalIssues: parseInt(row.critical_issues) || 0,
      warnings: parseInt(row.warnings) || 0,
      notices: parseInt(row.notices) || 0,
      issues: row.issues || [],
    };
  }

  private mapBacklinkRow(row: any): SEOBacklinkMetrics {
    return {
      projectId: row.project_id,
      date: row.date,
      totalBacklinks: parseInt(row.total_backlinks) || 0,
      referringDomains: parseInt(row.referring_domains) || 0,
      domainAuthority: parseFloat(row.domain_authority) || 0,
      dofollowLinks: parseInt(row.dofollow_links) || 0,
      nofollowLinks: parseInt(row.nofollow_links) || 0,
      newBacklinks: parseInt(row.new_backlinks) || 0,
      lostBacklinks: parseInt(row.lost_backlinks) || 0,
      toxicScore: parseFloat(row.toxic_score) || 0,
    };
  }

  private mapKPIRow(row: any): SEOKPISnapshot {
    return {
      projectId: row.project_id,
      date: row.date,
      organicTraffic: parseInt(row.organic_traffic) || 0,
      trafficChangePercent: parseFloat(row.traffic_change_percent) || 0,
      totalKeywords: parseInt(row.total_keywords) || 0,
      keywordsTop3: parseInt(row.keywords_top_3) || 0,
      keywordsTop10: parseInt(row.keywords_top_10) || 0,
      keywordsTop100: parseInt(row.keywords_top_100) || 0,
      averagePosition: parseFloat(row.average_position) || 0,
      seoHealthScore: parseInt(row.seo_health_score) || 0,
      domainAuthority: parseFloat(row.domain_authority) || 0,
      totalBacklinks: parseInt(row.total_backlinks) || 0,
      organicConversions: parseInt(row.organic_conversions) || 0,
      conversionRate: parseFloat(row.conversion_rate) || 0,
      estimatedValue: parseFloat(row.estimated_value) || 0,
    };
  }

  private mapForecastRow(row: any): SEOForecast {
    return {
      id: row.id,
      projectId: row.project_id,
      metric: row.metric,
      periodDays: parseInt(row.period_days) || 0,
      forecastDate: row.forecast_date,
      lowEstimate: parseFloat(row.low_estimate) || 0,
      midEstimate: parseFloat(row.mid_estimate) || 0,
      highEstimate: parseFloat(row.high_estimate) || 0,
      confidence: parseFloat(row.confidence) || 0,
      modelVersion: row.model_version,
    };
  }

  private mapRecommendationRow(row: any): SEORecommendation {
    return {
      id: row.id,
      projectId: row.project_id,
      category: row.category,
      priority: row.priority,
      title: row.title,
      description: row.description,
      impact: row.impact,
      effort: row.effort,
      status: row.status,
      autoExecutable: row.auto_executable,
      actionData: row.action_data || {},
      createdAt: row.created_at,
    };
  }
}
