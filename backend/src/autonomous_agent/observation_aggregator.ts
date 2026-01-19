/**
 * Observation Aggregator
 * 
 * v1.0 - Collects and synthesizes outputs from all SEO agents
 * 
 * Responsibilities:
 * - Fetch latest data from each agent
 * - Normalize data formats
 * - Identify cross-agent patterns
 * - Generate unified health score
 */

import {
  AgentSource,
  AgentObservation,
  AggregatedObservation,
  ObservationAlert,
} from './models';

// Simulated agent data fetchers (in production, these would call real APIs)
interface AgentDataFetcher {
  source: AgentSource;
  fetch: (projectId: string) => Promise<AgentObservation>;
}

export class ObservationAggregator {
  private logger: Console;
  private fetchers: AgentDataFetcher[];

  constructor() {
    this.logger = console;
    this.fetchers = this.initializeFetchers();
  }

  /**
   * Aggregate observations from all agents
   */
  async aggregate(projectId: string): Promise<AggregatedObservation> {
    this.logger.log(`[ObservationAggregator] Starting aggregation for project: ${projectId}`);
    
    const observations: AgentObservation[] = [];
    const errors: string[] = [];

    // Fetch from all agents in parallel
    const fetchPromises = this.fetchers.map(async (fetcher) => {
      try {
        this.logger.log(`[ObservationAggregator] Fetching from ${fetcher.source}...`);
        const observation = await fetcher.fetch(projectId);
        observations.push(observation);
        this.logger.log(`[ObservationAggregator] ✓ ${fetcher.source}: ${observation.insights.length} insights`);
      } catch (error) {
        const errorMsg = `Failed to fetch from ${fetcher.source}: ${error}`;
        this.logger.error(`[ObservationAggregator] ✗ ${errorMsg}`);
        errors.push(errorMsg);
      }
    });

    await Promise.all(fetchPromises);

    // Calculate overall health score
    const healthScore = this.calculateHealthScore(observations);

    // Extract top issues and opportunities
    const { topIssues, topOpportunities } = this.extractTopInsights(observations);

    const aggregated: AggregatedObservation = {
      projectId,
      timestamp: new Date().toISOString(),
      observations,
      healthScore,
      topIssues,
      topOpportunities,
    };

    this.logger.log(
      `[ObservationAggregator] Aggregation complete. Health: ${healthScore}/100, Issues: ${topIssues.length}, Opportunities: ${topOpportunities.length}`
    );

    return aggregated;
  }

  /**
   * Calculate overall SEO health score (0-100)
   */
  private calculateHealthScore(observations: AgentObservation[]): number {
    if (observations.length === 0) return 0;

    // Weight each agent's contribution
    const weights: Record<AgentSource, number> = {
      [AgentSource.TECHNICAL_SEO]: 0.25,
      [AgentSource.CONTENT_ENGINE]: 0.25,
      [AgentSource.KEYWORD_INTELLIGENCE]: 0.20,
      [AgentSource.ENTITY_LINKING]: 0.15,
      [AgentSource.MONITORING_ANALYTICS]: 0.15,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const obs of observations) {
      const weight = weights[obs.source] || 0.1;
      
      // Calculate score based on alerts (fewer critical alerts = higher score)
      let agentScore = 100;
      for (const alert of obs.alerts) {
        if (alert.severity === 'critical') agentScore -= 20;
        else if (alert.severity === 'warning') agentScore -= 10;
        else if (alert.severity === 'info') agentScore -= 2;
      }
      agentScore = Math.max(0, agentScore);

      // Also factor in metrics if available
      if (obs.metrics['health_score'] !== undefined) {
        agentScore = (agentScore + obs.metrics['health_score']) / 2;
      }

      totalScore += agentScore * weight;
      totalWeight += weight;
    }

    return Math.round(totalWeight > 0 ? totalScore / totalWeight : 0);
  }

  /**
   * Extract and prioritize top issues and opportunities
   */
  private extractTopInsights(
    observations: AgentObservation[]
  ): { topIssues: string[]; topOpportunities: string[] } {
    const issues: { text: string; severity: number }[] = [];
    const opportunities: { text: string; priority: number }[] = [];

    for (const obs of observations) {
      // Collect issues from alerts
      for (const alert of obs.alerts) {
        if (alert.severity === 'critical' || alert.severity === 'warning') {
          issues.push({
            text: `[${obs.source}] ${alert.message}`,
            severity: alert.severity === 'critical' ? 2 : 1,
          });
        }
      }

      // Collect opportunities from insights
      for (const insight of obs.insights) {
        if (insight.toLowerCase().includes('opportunity') || 
            insight.toLowerCase().includes('improve') ||
            insight.toLowerCase().includes('potential')) {
          opportunities.push({
            text: `[${obs.source}] ${insight}`,
            priority: 1,
          });
        }
      }
    }

    // Sort and limit
    const topIssues = issues
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 10)
      .map(i => i.text);

    const topOpportunities = opportunities
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)
      .map(o => o.text);

    return { topIssues, topOpportunities };
  }

  /**
   * Initialize data fetchers for each agent
   */
  private initializeFetchers(): AgentDataFetcher[] {
    return [
      {
        source: AgentSource.KEYWORD_INTELLIGENCE,
        fetch: this.fetchKeywordIntelligence.bind(this),
      },
      {
        source: AgentSource.CONTENT_ENGINE,
        fetch: this.fetchContentEngine.bind(this),
      },
      {
        source: AgentSource.TECHNICAL_SEO,
        fetch: this.fetchTechnicalSEO.bind(this),
      },
      {
        source: AgentSource.ENTITY_LINKING,
        fetch: this.fetchEntityLinking.bind(this),
      },
      {
        source: AgentSource.MONITORING_ANALYTICS,
        fetch: this.fetchMonitoringAnalytics.bind(this),
      },
    ];
  }

  // ============================================================================
  // AGENT DATA FETCHERS (Mock implementations for v1.0)
  // In production, these would call actual agent APIs
  // ============================================================================

  private async fetchKeywordIntelligence(projectId: string): Promise<AgentObservation> {
    // Simulate API delay
    await this.delay(100);

    return {
      source: AgentSource.KEYWORD_INTELLIGENCE,
      timestamp: new Date().toISOString(),
      summary: 'Keyword analysis completed. 45 keywords tracked, 12 in top 10.',
      metrics: {
        keywords_tracked: 45,
        keywords_ranking_top10: 12,
        keywords_ranking_top3: 5,
        keyword_visibility_score: 68,
        avg_position: 14.5,
        position_changes: -2.3,
      },
      insights: [
        'Opportunity: 8 keywords are ranking 11-20, close to page 1',
        'Competitor "example.com" gained 3 positions on main keyword',
        'Long-tail keywords showing steady improvement',
        'Search volume increased for banking-related keywords',
      ],
      alerts: [
        {
          severity: 'warning',
          message: 'Main keyword dropped from position 5 to 8',
          metric: 'main_keyword_position',
          value: 8,
          threshold: 5,
        },
        {
          severity: 'info',
          message: 'New competitor detected in SERP',
        },
      ],
    };
  }

  private async fetchContentEngine(projectId: string): Promise<AgentObservation> {
    await this.delay(100);

    return {
      source: AgentSource.CONTENT_ENGINE,
      timestamp: new Date().toISOString(),
      summary: 'Content analysis completed. 120 pages analyzed, average score 72/100.',
      metrics: {
        total_pages: 120,
        average_content_score: 72,
        thin_content_pages: 15,
        duplicate_content_pages: 3,
        content_freshness_score: 65,
        avg_word_count: 1450,
      },
      insights: [
        '15 pages have thin content (<500 words)',
        'Opportunity: Update 8 outdated articles for quick wins',
        '3 pages have duplicate title tags',
        'Top performing content topics: banking guides, loan calculators',
      ],
      alerts: [
        {
          severity: 'warning',
          message: '15 pages flagged as thin content',
          metric: 'thin_content_pages',
          value: 15,
          threshold: 5,
        },
        {
          severity: 'critical',
          message: '3 pages have duplicate content issues',
          metric: 'duplicate_content_pages',
          value: 3,
          threshold: 0,
        },
      ],
    };
  }

  private async fetchTechnicalSEO(projectId: string): Promise<AgentObservation> {
    await this.delay(100);

    return {
      source: AgentSource.TECHNICAL_SEO,
      timestamp: new Date().toISOString(),
      summary: 'Technical audit completed. 8 critical issues, 23 warnings.',
      metrics: {
        health_score: 74,
        critical_issues_count: 8,
        warning_issues_count: 23,
        pages_with_issues: 45,
        core_web_vitals_pass_rate: 62,
        mobile_friendly_rate: 95,
        indexation_rate: 88,
        avg_page_load_time: 3.2,
      },
      insights: [
        'Core Web Vitals: LCP needs improvement on 38% of pages',
        'Mobile usability is good at 95%',
        'Opportunity: Fix redirect chains for 12% speed improvement',
        'Schema markup missing on product pages',
      ],
      alerts: [
        {
          severity: 'critical',
          message: 'Core Web Vitals failing on 38% of pages',
          metric: 'core_web_vitals_pass_rate',
          value: 62,
          threshold: 75,
        },
        {
          severity: 'critical',
          message: '8 pages returning 5xx errors',
          metric: 'server_errors',
          value: 8,
          threshold: 0,
        },
        {
          severity: 'warning',
          message: 'Average page load time is 3.2s (target: <2.5s)',
          metric: 'avg_page_load_time',
          value: 3.2,
          threshold: 2.5,
        },
      ],
    };
  }

  private async fetchEntityLinking(projectId: string): Promise<AgentObservation> {
    await this.delay(100);

    return {
      source: AgentSource.ENTITY_LINKING,
      timestamp: new Date().toISOString(),
      summary: 'Entity analysis completed. 85 entities identified, linking score 68/100.',
      metrics: {
        entities_identified: 85,
        entity_coverage_score: 68,
        internal_link_score: 72,
        orphan_pages: 12,
        topical_authority_score: 65,
        avg_internal_links_per_page: 4.2,
      },
      insights: [
        '12 orphan pages need internal links',
        'Opportunity: Create hub page for "banking services" topic cluster',
        'Top entities: VIB, credit card, savings account, loan',
        'Entity connections could improve with better anchor text diversity',
      ],
      alerts: [
        {
          severity: 'warning',
          message: '12 orphan pages detected (no internal links pointing to them)',
          metric: 'orphan_pages',
          value: 12,
          threshold: 5,
        },
        {
          severity: 'info',
          message: 'Topic cluster "loans" has potential for expansion',
        },
      ],
    };
  }

  private async fetchMonitoringAnalytics(projectId: string): Promise<AgentObservation> {
    await this.delay(100);

    return {
      source: AgentSource.MONITORING_ANALYTICS,
      timestamp: new Date().toISOString(),
      summary: 'Monitoring report: Traffic stable, 2 anomalies detected this week.',
      metrics: {
        organic_sessions: 45000,
        organic_users: 38000,
        click_through_rate: 3.2,
        avg_session_duration: 185,
        bounce_rate: 42,
        traffic_trend: 0.05, // 5% increase
        anomalies_detected: 2,
      },
      insights: [
        'Traffic up 5% week-over-week',
        'Opportunity: CTR improvement potential on top 10 pages',
        'Bounce rate decreased by 3% after recent content updates',
        'Mobile traffic now 68% of total (up from 62%)',
      ],
      alerts: [
        {
          severity: 'warning',
          message: 'Traffic anomaly detected on Tuesday - investigating',
          metric: 'daily_sessions',
          value: 5200,
          threshold: 6500,
        },
        {
          severity: 'info',
          message: 'Seasonal traffic pattern expected next month',
        },
      ],
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ObservationAggregator;
