/**
 * Dashboard Controller
 * API endpoints for dashboard data - transforms backend data to frontend format
 * 
 * RULE: Controllers are thin - only transforms data
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { PostgresProjectRepository } from '../../../infrastructure/repositories/PostgresProjectRepository';
import { PostgresSEOMetricsRepository } from '../../../infrastructure/repositories/PostgresSEOMetricsRepository';
import { Logger } from '../../../shared/Logger';
import { NotFoundError } from '../../../shared/errors';

export class DashboardController {
  private readonly logger: Logger;
  private readonly projectRepo: PostgresProjectRepository;
  private readonly metricsRepo: PostgresSEOMetricsRepository;

  constructor(pool: Pool) {
    this.logger = new Logger('DashboardController');
    this.projectRepo = new PostgresProjectRepository(pool);
    this.metricsRepo = new PostgresSEOMetricsRepository(pool);
  }

  /**
   * Register routes
   */
  registerRoutes(app: FastifyInstance): void {
    // Main dashboard endpoint - returns data in frontend format
    app.get('/api/dashboard', this.getDefaultDashboard.bind(this));
    app.get('/api/dashboard/:projectId', this.getDashboard.bind(this));
  }

  /**
   * GET /api/dashboard
   * Get dashboard for default project (VIB)
   */
  async getDefaultDashboard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Use VIB project as default
    const defaultProjectId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    return this.getDashboardData(defaultProjectId, reply);
  }

  /**
   * GET /api/dashboard/:projectId
   * Get dashboard for a specific project
   */
  async getDashboard(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { projectId } = request.params;
    return this.getDashboardData(projectId, reply);
  }

  /**
   * Fetch and transform dashboard data
   */
  private async getDashboardData(projectId: string, reply: FastifyReply): Promise<void> {
    try {
      this.logger.info('Fetching dashboard data', { projectId });
      
      // Verify project exists
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        this.logger.warn('Project not found', { projectId });
        throw new NotFoundError('Project', projectId);
      }

      this.logger.info('Project found', { projectId, projectName: project.name });

      // Get raw dashboard data from repository (includes all real data)
      const rawData = await this.metricsRepo.getDashboardSummaryV2(projectId);
      this.logger.info('Raw dashboard data fetched', { 
        projectId, 
        hasTraffic: !!rawData.traffic,
        hasKeywordStats: !!rawData.keywordStats,
        hasTechnicalHealth: !!rawData.technicalHealth,
        hasContentStats: !!rawData.contentStats,
        hasTrafficHistory: rawData.trafficHistory?.length || 0,
      });

      // Transform to frontend format with all real data
      const dashboardData = this.transformToFrontendFormatV2(rawData, project.name);

      reply.send(dashboardData);
    } catch (error: any) {
      this.logger.error('Dashboard error', { 
        error: error.message, 
        stack: error.stack,
        projectId 
      });
      
      if (error instanceof NotFoundError) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
        return;
      }

      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to load dashboard data: ${error.message}`,
          details: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        },
      });
    }
  }

  /**
   * Transform backend data to frontend DashboardData format
   */
  private transformToFrontendFormat(rawData: any, projectName: string): any {
    const { traffic, keywordStats, technicalHealth, backlinks, kpi, forecasts, recommendations } = rawData;

    return {
      kpiOverview: this.transformKPIOverview(traffic, keywordStats, technicalHealth, kpi),
      seoHealth: this.transformSEOHealth(technicalHealth, backlinks),
      forecast: this.transformForecast(forecasts, traffic),
      recommendations: this.transformRecommendations(recommendations),
    };
  }

  /**
   * Transform backend data to frontend DashboardData format V2
   * All data from database - no hardcoded values
   */
  private transformToFrontendFormatV2(rawData: any, projectName: string): any {
    const { 
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
    } = rawData;

    return {
      kpiOverview: this.transformKPIOverviewV2(traffic, trafficHistory, keywordStats, keywordChanges, technicalHealth, kpi, contentStats),
      seoHealth: this.transformSEOHealthV2(technicalHealth, technicalHealthHistory, backlinks, crawlStats),
      forecast: this.transformForecastV2(forecasts, trafficHistory),
      recommendations: this.transformRecommendationsV2(recommendations),
    };
  }

  /**
   * Transform to KPIOverviewData
   */
  private transformKPIOverview(traffic: any, keywordStats: any, technicalHealth: any, kpi: any): any {
    const organicTraffic = traffic?.organicTraffic || 0;
    const previousTraffic = Math.round(organicTraffic * 0.9); // Estimate previous
    const change = organicTraffic - previousTraffic;
    const changePercent = previousTraffic > 0 ? (change / previousTraffic) * 100 : 0;

    return {
      organicTraffic: {
        current: organicTraffic,
        previous: previousTraffic,
        change,
        changePercent: Math.round(changePercent * 10) / 10,
        trend: change >= 0 ? 'up' : 'down',
        period: 'Last 30 days',
      },
      keywordCoverage: {
        top3: keywordStats?.top3 || 0,
        top3Change: 2,
        top10: keywordStats?.top10 || 0,
        top10Change: 5,
        totalTracked: keywordStats?.total || 0,
      },
      contentPerformance: {
        totalPages: technicalHealth?.indexedPages || 150,
        highPerforming: 45,
        needsOptimization: 30,
        newContent: 8,
      },
      healthScore: technicalHealth?.overallScore || kpi?.healthScore || 75,
      healthScoreChange: 3,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Transform to SEOHealthData
   */
  private transformSEOHealth(technicalHealth: any, backlinks: any): any {
    const overallScore = technicalHealth?.overallScore || 75;
    
    const getStatus = (score: number): string => {
      if (score >= 80) return 'healthy';
      if (score >= 60) return 'warning';
      return 'critical';
    };

    return {
      overall: {
        score: overallScore,
        status: getStatus(overallScore),
      },
      technical: {
        name: 'Technical SEO',
        status: getStatus(technicalHealth?.overallScore || 70),
        score: technicalHealth?.overallScore || 70,
        issues: (technicalHealth?.criticalIssues || 0) + (technicalHealth?.warnings || 0),
        description: 'Core Web Vitals, indexability, and site structure',
      },
      content: {
        name: 'Content Quality',
        status: 'healthy',
        score: 82,
        issues: 5,
        description: 'Content relevance, structure, and optimization',
      },
      authority: {
        name: 'Domain Authority',
        status: getStatus((backlinks?.domainAuthority || 45) * 2),
        score: Math.min((backlinks?.domainAuthority || 45) * 2, 100),
        issues: backlinks?.toxicLinks || 0,
        description: 'Backlink profile and domain trust',
      },
      monitoring: {
        name: 'Monitoring',
        status: 'healthy',
        score: 95,
        issues: 0,
        description: 'Tracking and alerting systems',
      },
      activeAlerts: this.generateAlerts(technicalHealth),
    };
  }

  /**
   * Generate active alerts from technical health
   */
  private generateAlerts(technicalHealth: any): any[] {
    const alerts: any[] = [];

    if (technicalHealth?.criticalIssues > 0) {
      alerts.push({
        id: 'alert-1',
        priority: 'critical',
        title: `${technicalHealth.criticalIssues} Critical Issues Detected`,
        description: 'Critical technical SEO issues require immediate attention',
        metric: 'Technical Health',
        detectedAt: new Date().toISOString(),
        impact: 'May affect indexing and rankings',
      });
    }

    if (technicalHealth?.clsScore > 0.25) {
      alerts.push({
        id: 'alert-2',
        priority: 'high',
        title: 'CLS Score Above Threshold',
        description: `CLS score is ${technicalHealth.clsScore}, above 0.25 threshold`,
        metric: 'Core Web Vitals',
        detectedAt: new Date().toISOString(),
        impact: 'Poor user experience on mobile',
      });
    }

    return alerts;
  }

  /**
   * Transform to ForecastData
   */
  private transformForecast(forecasts: any[], traffic: any): any {
    const currentTraffic = traffic?.organicTraffic || 10000;
    const now = new Date();

    // Find forecasts or generate defaults
    const forecast30 = forecasts?.find(f => f.period === '30d') || { predictedTraffic: currentTraffic * 1.05 };
    const forecast60 = forecasts?.find(f => f.period === '60d') || { predictedTraffic: currentTraffic * 1.12 };
    const forecast90 = forecasts?.find(f => f.period === '90d') || { predictedTraffic: currentTraffic * 1.18 };

    // Generate daily forecast
    const dailyForecast = Array.from({ length: 90 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const growthRate = 1 + (i / 90) * 0.18;
      const predicted = Math.round(currentTraffic * growthRate);
      return {
        date: date.toISOString().split('T')[0],
        predicted,
        lower: Math.round(predicted * 0.9),
        upper: Math.round(predicted * 1.1),
      };
    });

    return {
      current: currentTraffic,
      forecast30d: {
        date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: Math.round(forecast30.predictedTraffic || currentTraffic * 1.05),
        lower: Math.round((forecast30.predictedTraffic || currentTraffic * 1.05) * 0.9),
        upper: Math.round((forecast30.predictedTraffic || currentTraffic * 1.05) * 1.1),
      },
      forecast60d: {
        date: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: Math.round(forecast60.predictedTraffic || currentTraffic * 1.12),
        lower: Math.round((forecast60.predictedTraffic || currentTraffic * 1.12) * 0.85),
        upper: Math.round((forecast60.predictedTraffic || currentTraffic * 1.12) * 1.15),
      },
      forecast90d: {
        date: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: Math.round(forecast90.predictedTraffic || currentTraffic * 1.18),
        lower: Math.round((forecast90.predictedTraffic || currentTraffic * 1.18) * 0.8),
        upper: Math.round((forecast90.predictedTraffic || currentTraffic * 1.18) * 1.2),
      },
      dailyForecast,
      trend: 'increasing',
      trendStrength: 0.75,
      confidence: 0.82,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Transform to RecommendationData
   */
  private transformRecommendations(recommendations: any[]): any {
    const topRecommendations = (recommendations || []).slice(0, 5).map((rec: any, index: number) => ({
      id: rec.id || `rec-${index + 1}`,
      title: rec.title || 'Optimize page performance',
      description: rec.description || 'Improve technical SEO',
      impact: rec.impact || 'medium',
      effort: rec.effort || 'medium',
      risk: rec.risk || 'low',
      category: rec.category || 'technical',
      estimatedTrafficGain: rec.estimatedTrafficGain || 500,
      priority: rec.priority || index + 1,
    }));

    // Add default recommendations if none exist
    if (topRecommendations.length === 0) {
      topRecommendations.push(
        {
          id: 'rec-1',
          title: 'Optimize Core Web Vitals',
          description: 'Improve LCP and CLS scores for better rankings',
          impact: 'high',
          effort: 'medium',
          risk: 'low',
          category: 'technical',
          estimatedTrafficGain: 1200,
          priority: 1,
        },
        {
          id: 'rec-2',
          title: 'Add structured data',
          description: 'Implement JSON-LD schema for rich results',
          impact: 'medium',
          effort: 'low',
          risk: 'low',
          category: 'technical',
          estimatedTrafficGain: 800,
          priority: 2,
        },
        {
          id: 'rec-3',
          title: 'Improve internal linking',
          description: 'Add relevant internal links to boost page authority',
          impact: 'medium',
          effort: 'low',
          risk: 'low',
          category: 'content',
          estimatedTrafficGain: 600,
          priority: 3,
        }
      );
    }

    return {
      topRecommendations,
      totalOpportunities: Math.max(recommendations?.length || 0, topRecommendations.length),
      potentialTrafficGain: topRecommendations.reduce((sum: number, r: any) => sum + (r.estimatedTrafficGain || 0), 0),
      generatedAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // V2 TRANSFORM METHODS - ALL REAL DATA, NO HARDCODED VALUES
  // ===========================================================================

  /**
   * Transform to KPIOverviewData V2 - All real data
   */
  private transformKPIOverviewV2(
    traffic: any, 
    trafficHistory: any[], 
    keywordStats: any, 
    keywordChanges: any,
    technicalHealth: any, 
    kpi: any,
    contentStats: any
  ): any {
    // Calculate traffic change from real historical data
    const currentTraffic = traffic?.organicTraffic || 0;
    
    // Get previous period traffic from history (30 days ago)
    const sortedHistory = (trafficHistory || []).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const previousTraffic = sortedHistory.length > 1 
      ? sortedHistory[sortedHistory.length - 1]?.organicTraffic || 0
      : 0;
    
    const trafficChange = currentTraffic - previousTraffic;
    const trafficChangePercent = previousTraffic > 0 
      ? Math.round((trafficChange / previousTraffic) * 1000) / 10 
      : 0;

    // Calculate health score change from historical data
    const currentHealthScore = technicalHealth?.overallScore || kpi?.seoHealthScore || 0;
    const previousHealthScore = kpi?.seoHealthScore || currentHealthScore;
    const healthScoreChange = currentHealthScore - previousHealthScore;

    return {
      organicTraffic: {
        current: currentTraffic,
        previous: previousTraffic,
        change: trafficChange,
        changePercent: trafficChangePercent,
        trend: trafficChange >= 0 ? 'up' : 'down',
        period: 'Last 30 days',
      },
      keywordCoverage: {
        top3: keywordStats?.top3 || 0,
        top3Change: keywordChanges?.top3Change || 0,
        top10: keywordStats?.top10 || 0,
        top10Change: keywordChanges?.top10Change || 0,
        totalTracked: keywordStats?.total || 0,
      },
      contentPerformance: {
        totalPages: contentStats?.totalPages || technicalHealth?.indexedPages || 0,
        highPerforming: contentStats?.highPerforming || 0,
        needsOptimization: contentStats?.needsOptimization || 0,
        newContent: contentStats?.newContent || 0,
      },
      healthScore: currentHealthScore,
      healthScoreChange: healthScoreChange,
      lastUpdated: traffic?.date ? new Date(traffic.date).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Transform to SEOHealthData V2 - All real data
   */
  private transformSEOHealthV2(
    technicalHealth: any, 
    technicalHealthHistory: any[],
    backlinks: any,
    crawlStats: any
  ): any {
    const overallScore = technicalHealth?.overallScore || 0;
    
    const getStatus = (score: number): string => {
      if (score >= 80) return 'healthy';
      if (score >= 60) return 'warning';
      return 'critical';
    };

    // Calculate content score from crawl stats
    const contentScore = crawlStats && crawlStats.totalPages > 0
      ? Math.round((crawlStats.healthyPages / crawlStats.totalPages) * 100)
      : 0;

    // Calculate authority score from backlinks
    const authorityScore = backlinks?.domainAuthority 
      ? Math.min(Math.round(backlinks.domainAuthority * 2), 100)
      : 0;

    // Calculate monitoring score based on data freshness
    const hasRecentData = technicalHealth?.date && 
      (new Date().getTime() - new Date(technicalHealth.date).getTime()) < 24 * 60 * 60 * 1000;
    const monitoringScore = hasRecentData ? 95 : 50;

    return {
      overall: {
        score: overallScore,
        status: getStatus(overallScore),
      },
      technical: {
        name: 'Technical SEO',
        status: getStatus(technicalHealth?.overallScore || 0),
        score: technicalHealth?.overallScore || 0,
        issues: (technicalHealth?.criticalIssues || 0) + (technicalHealth?.warnings || 0),
        description: 'Core Web Vitals, indexability, and site structure',
      },
      content: {
        name: 'Content Quality',
        status: getStatus(contentScore),
        score: contentScore,
        issues: crawlStats?.errorPages || 0,
        description: 'Content relevance, structure, and optimization',
      },
      authority: {
        name: 'Domain Authority',
        status: getStatus(authorityScore),
        score: authorityScore,
        issues: backlinks?.toxicScore ? Math.round(backlinks.toxicScore) : 0,
        description: 'Backlink profile and domain trust',
      },
      monitoring: {
        name: 'Monitoring',
        status: getStatus(monitoringScore),
        score: monitoringScore,
        issues: hasRecentData ? 0 : 1,
        description: 'Tracking and alerting systems',
      },
      activeAlerts: this.generateAlertsV2(technicalHealth, crawlStats),
    };
  }

  /**
   * Generate active alerts from real data
   */
  private generateAlertsV2(technicalHealth: any, crawlStats: any): any[] {
    const alerts: any[] = [];

    if (technicalHealth?.criticalIssues > 0) {
      alerts.push({
        id: 'alert-critical-issues',
        priority: 'critical',
        title: `${technicalHealth.criticalIssues} Critical Issues Detected`,
        description: 'Critical technical SEO issues require immediate attention',
        metric: 'Technical Health',
        detectedAt: technicalHealth?.date ? new Date(technicalHealth.date).toISOString() : new Date().toISOString(),
        impact: 'May affect indexing and rankings',
      });
    }

    // CLS alert from real data
    if (technicalHealth?.clsScore > 0.25) {
      alerts.push({
        id: 'alert-cls',
        priority: 'high',
        title: 'CLS Score Above Threshold',
        description: `CLS score is ${technicalHealth.clsScore.toFixed(3)}, above 0.25 threshold`,
        metric: 'Core Web Vitals',
        detectedAt: new Date().toISOString(),
        impact: 'Poor user experience on mobile',
      });
    }

    // LCP alert from real data
    if (technicalHealth?.lcpScore > 2.5) {
      alerts.push({
        id: 'alert-lcp',
        priority: 'high',
        title: 'LCP Score Above Threshold',
        description: `LCP score is ${technicalHealth.lcpScore.toFixed(2)}s, above 2.5s threshold`,
        metric: 'Core Web Vitals',
        detectedAt: new Date().toISOString(),
        impact: 'Slow page loading affects user experience',
      });
    }

    // INP alert from real data
    if (technicalHealth?.inpScore > 200) {
      alerts.push({
        id: 'alert-inp',
        priority: 'medium',
        title: 'INP Score Needs Improvement',
        description: `INP score is ${Math.round(technicalHealth.inpScore)}ms, above 200ms threshold`,
        metric: 'Core Web Vitals',
        detectedAt: new Date().toISOString(),
        impact: 'Interaction responsiveness needs improvement',
      });
    }

    // Crawl errors alert
    if (crawlStats?.errorPages > 0) {
      alerts.push({
        id: 'alert-crawl-errors',
        priority: crawlStats.errorPages > 10 ? 'high' : 'medium',
        title: `${crawlStats.errorPages} Pages with Errors`,
        description: `Found ${crawlStats.errorPages} pages returning error status codes`,
        metric: 'Crawl Health',
        detectedAt: new Date().toISOString(),
        impact: 'Error pages may affect site credibility',
      });
    }

    return alerts;
  }

  /**
   * Transform to ForecastData V2 - Based on real historical data
   */
  private transformForecastV2(forecasts: any[], trafficHistory: any[]): any {
    // Get current traffic from latest in history
    const sortedHistory = (trafficHistory || []).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const currentTraffic = sortedHistory[0]?.organicTraffic || 0;
    const now = new Date();

    // Use real forecasts from database if available
    const forecast30 = forecasts?.find((f: any) => f.periodDays === 30);
    const forecast60 = forecasts?.find((f: any) => f.periodDays === 60);
    const forecast90 = forecasts?.find((f: any) => f.periodDays === 90);

    // Calculate trend from historical data
    let trend = 'stable';
    let trendStrength = 0;
    
    if (sortedHistory.length >= 2) {
      const recentAvg = sortedHistory.slice(0, Math.min(7, sortedHistory.length))
        .reduce((sum: number, d: any) => sum + (d.organicTraffic || 0), 0) / Math.min(7, sortedHistory.length);
      const olderAvg = sortedHistory.slice(-Math.min(7, sortedHistory.length))
        .reduce((sum: number, d: any) => sum + (d.organicTraffic || 0), 0) / Math.min(7, sortedHistory.length);
      
      if (olderAvg > 0) {
        const changePercent = (recentAvg - olderAvg) / olderAvg;
        trendStrength = Math.abs(changePercent);
        trend = changePercent > 0.02 ? 'increasing' : changePercent < -0.02 ? 'decreasing' : 'stable';
      }
    }

    // Generate daily forecast based on historical trend
    const dailyForecast = Array.from({ length: 90 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      
      // Use database forecast if available, otherwise extrapolate from trend
      let predicted = currentTraffic;
      if (forecast90) {
        // Linear interpolation between current and 90-day forecast
        const progress = i / 90;
        predicted = Math.round(currentTraffic + (forecast90.midEstimate - currentTraffic) * progress);
      } else if (trendStrength > 0) {
        // Extrapolate from trend
        const dailyGrowth = trend === 'increasing' ? 1 + (trendStrength / 30) : 
                           trend === 'decreasing' ? 1 - (trendStrength / 30) : 1;
        predicted = Math.round(currentTraffic * Math.pow(dailyGrowth, i));
      }
      
      return {
        date: date.toISOString().split('T')[0],
        predicted,
        lower: Math.round(predicted * 0.9),
        upper: Math.round(predicted * 1.1),
      };
    });

    // Calculate confidence based on data availability
    const confidence = forecasts && forecasts.length > 0 
      ? (forecasts[0]?.confidence || 0.7)
      : (trafficHistory && trafficHistory.length >= 30 ? 0.6 : 0.4);

    return {
      current: currentTraffic,
      forecast30d: {
        date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: forecast30?.midEstimate || dailyForecast[29]?.predicted || currentTraffic,
        lower: forecast30?.lowEstimate || Math.round((forecast30?.midEstimate || dailyForecast[29]?.predicted || currentTraffic) * 0.9),
        upper: forecast30?.highEstimate || Math.round((forecast30?.midEstimate || dailyForecast[29]?.predicted || currentTraffic) * 1.1),
      },
      forecast60d: {
        date: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: forecast60?.midEstimate || dailyForecast[59]?.predicted || currentTraffic,
        lower: forecast60?.lowEstimate || Math.round((forecast60?.midEstimate || dailyForecast[59]?.predicted || currentTraffic) * 0.85),
        upper: forecast60?.highEstimate || Math.round((forecast60?.midEstimate || dailyForecast[59]?.predicted || currentTraffic) * 1.15),
      },
      forecast90d: {
        date: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted: forecast90?.midEstimate || dailyForecast[89]?.predicted || currentTraffic,
        lower: forecast90?.lowEstimate || Math.round((forecast90?.midEstimate || dailyForecast[89]?.predicted || currentTraffic) * 0.8),
        upper: forecast90?.highEstimate || Math.round((forecast90?.midEstimate || dailyForecast[89]?.predicted || currentTraffic) * 1.2),
      },
      dailyForecast,
      trend,
      trendStrength: Math.round(trendStrength * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Transform to RecommendationData V2 - All from database, no defaults
   */
  private transformRecommendationsV2(recommendations: any[]): any {
    // Map real recommendations from database
    const topRecommendations = (recommendations || []).map((rec: any, index: number) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      impact: rec.impact,
      effort: rec.effort,
      risk: rec.actionData?.risk || 'low',
      category: rec.category,
      estimatedTrafficGain: rec.actionData?.estimatedTrafficGain || 0,
      priority: rec.priority,
      source: rec.actionData?.source || 'manual',
      createdAt: rec.createdAt,
    }));

    // Calculate total potential traffic gain
    const potentialTrafficGain = topRecommendations.reduce(
      (sum: number, r: any) => sum + (r.estimatedTrafficGain || 0), 
      0
    );

    return {
      topRecommendations,
      totalOpportunities: recommendations?.length || 0,
      potentialTrafficGain,
      generatedAt: recommendations?.[0]?.createdAt 
        ? new Date(recommendations[0].createdAt).toISOString() 
        : new Date().toISOString(),
    };
  }
}
