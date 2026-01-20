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
    const query = `
      SELECT * FROM seo_traffic_metrics 
      WHERE project_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId, range.startDate, range.endDate]);
      return result.rows.map(row => this.mapTrafficRow(row));
    } catch (error) {
      this.logger.error('Failed to get traffic metrics', { error, projectId });
      throw new DatabaseError('Failed to get traffic metrics');
    }
  }

  async getLatestTrafficMetrics(projectId: string): Promise<SEOTrafficMetrics | null> {
    const query = `
      SELECT * FROM seo_traffic_metrics 
      WHERE project_id = $1 
      ORDER BY date DESC 
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      if (result.rows.length === 0) return null;
      return this.mapTrafficRow(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get latest traffic metrics', { error, projectId });
      throw new DatabaseError('Failed to get traffic metrics');
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
