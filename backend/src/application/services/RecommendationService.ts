/**
 * Recommendation Service v1.0
 * 
 * Central service for AI agents to generate and store SEO recommendations.
 * 
 * Supported Sources:
 * - technical_seo_agent: Technical audit findings
 * - keyword_intelligence: Keyword opportunities
 * - monitoring_agent: Anomaly-based alerts
 * - portfolio_optimization: Investment recommendations
 * - content_engine: Content improvement suggestions
 * 
 * Design Principles:
 * - Deduplication: Avoid creating duplicate recommendations
 * - Prioritization: Auto-calculate priority based on impact/effort
 * - Expiration: Old pending recommendations can be cleaned up
 * - Audit trail: Track which agent created each recommendation
 */

import { Pool } from 'pg';
import { Logger } from '../../shared/Logger';
import { 
  PostgresSEOMetricsRepository, 
  SEORecommendation 
} from '../../infrastructure/repositories/PostgresSEOMetricsRepository';

// =============================================================================
// TYPES
// =============================================================================

export type RecommendationSource = 
  | 'technical_seo_agent'
  | 'keyword_intelligence'
  | 'monitoring_agent'
  | 'portfolio_optimization'
  | 'content_engine'
  | 'cwv_worker'
  | 'crawler_worker'
  | 'manual';

export type RecommendationCategory = 'technical' | 'content' | 'keywords' | 'backlinks' | 'ux';
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'high' | 'medium' | 'low';

export interface CreateRecommendationInput {
  projectId: string;
  source: RecommendationSource;
  category: RecommendationCategory;
  title: string;
  description: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  priority?: RecommendationPriority; // Auto-calculated if not provided
  autoExecutable?: boolean;
  actionData?: Record<string, any>;
  // Optional: estimated metrics
  estimatedTrafficGain?: number;
  estimatedRankingImprovement?: number;
  affectedUrls?: string[];
  relatedKeywords?: string[];
}

export interface BulkCreateResult {
  created: SEORecommendation[];
  skipped: number; // Duplicates skipped
  errors: string[];
}

// =============================================================================
// PRIORITY CALCULATION
// =============================================================================

/**
 * Calculate priority based on impact and effort (impact/effort matrix)
 * High impact + Low effort = Critical
 * High impact + High effort = High
 * Low impact + Low effort = Medium
 * Low impact + High effort = Low
 */
function calculatePriority(impact: ImpactLevel, effort: EffortLevel): RecommendationPriority {
  const matrix: Record<ImpactLevel, Record<EffortLevel, RecommendationPriority>> = {
    high: {
      low: 'critical',
      medium: 'high',
      high: 'high',
    },
    medium: {
      low: 'high',
      medium: 'medium',
      high: 'medium',
    },
    low: {
      low: 'medium',
      medium: 'low',
      high: 'low',
    },
  };
  
  return matrix[impact][effort];
}

// =============================================================================
// RECOMMENDATION SERVICE
// =============================================================================

export class RecommendationService {
  private logger: Logger;
  private repository: PostgresSEOMetricsRepository;

  constructor(pool: Pool) {
    this.logger = new Logger('RecommendationService');
    this.repository = new PostgresSEOMetricsRepository(pool);
  }

  // ===========================================================================
  // CREATE RECOMMENDATIONS
  // ===========================================================================

  /**
   * Create a single recommendation
   */
  async createRecommendation(input: CreateRecommendationInput): Promise<SEORecommendation> {
    // Calculate priority if not provided
    const priority = input.priority || calculatePriority(input.impact, input.effort);

    // Build action data with source tracking
    const actionData = {
      ...input.actionData,
      source: input.source,
      estimatedTrafficGain: input.estimatedTrafficGain,
      estimatedRankingImprovement: input.estimatedRankingImprovement,
      affectedUrls: input.affectedUrls,
      relatedKeywords: input.relatedKeywords,
      generatedAt: new Date().toISOString(),
    };

    const recommendation = await this.repository.createRecommendation({
      projectId: input.projectId,
      category: input.category,
      priority,
      title: input.title,
      description: input.description,
      impact: input.impact,
      effort: input.effort,
      status: 'pending',
      autoExecutable: input.autoExecutable || false,
      actionData,
    });

    this.logger.info('Recommendation created', {
      id: recommendation.id,
      source: input.source,
      category: input.category,
      title: input.title,
    });

    return recommendation;
  }

  /**
   * Create multiple recommendations with deduplication
   */
  async createRecommendations(
    inputs: CreateRecommendationInput[],
    options?: { skipDuplicates?: boolean }
  ): Promise<BulkCreateResult> {
    const result: BulkCreateResult = {
      created: [],
      skipped: 0,
      errors: [],
    };

    if (inputs.length === 0) return result;

    // Group by project for deduplication check
    const projectId = inputs[0].projectId;

    // Get existing recommendations for deduplication
    let existingTitles: Set<string> = new Set();
    if (options?.skipDuplicates !== false) {
      const existing = await this.repository.getRecommendations(projectId, { 
        status: 'pending' 
      });
      existingTitles = new Set(existing.map(r => r.title.toLowerCase()));
    }

    const toCreate: Omit<SEORecommendation, 'id' | 'createdAt'>[] = [];

    for (const input of inputs) {
      // Skip duplicates
      if (existingTitles.has(input.title.toLowerCase())) {
        result.skipped++;
        continue;
      }

      const priority = input.priority || calculatePriority(input.impact, input.effort);

      toCreate.push({
        projectId: input.projectId,
        category: input.category,
        priority,
        title: input.title,
        description: input.description,
        impact: input.impact,
        effort: input.effort,
        status: 'pending',
        autoExecutable: input.autoExecutable || false,
        actionData: {
          ...input.actionData,
          source: input.source,
          estimatedTrafficGain: input.estimatedTrafficGain,
          estimatedRankingImprovement: input.estimatedRankingImprovement,
          affectedUrls: input.affectedUrls,
          relatedKeywords: input.relatedKeywords,
          generatedAt: new Date().toISOString(),
        },
      });

      existingTitles.add(input.title.toLowerCase());
    }

    if (toCreate.length > 0) {
      try {
        result.created = await this.repository.createRecommendations(toCreate);
      } catch (error: any) {
        result.errors.push(error.message);
        this.logger.error('Failed to create batch recommendations', { error });
      }
    }

    this.logger.info('Bulk recommendations processed', {
      total: inputs.length,
      created: result.created.length,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  }

  // ===========================================================================
  // AGENT-SPECIFIC METHODS
  // ===========================================================================

  /**
   * Create recommendations from Technical SEO Agent audit results
   */
  async createFromTechnicalAudit(
    projectId: string,
    auditResults: TechnicalAuditResult[]
  ): Promise<BulkCreateResult> {
    const inputs: CreateRecommendationInput[] = auditResults.map(result => ({
      projectId,
      source: 'technical_seo_agent' as RecommendationSource,
      category: 'technical' as RecommendationCategory,
      title: result.title,
      description: result.description,
      impact: this.mapSeverityToImpact(result.severity),
      effort: result.effort || 'medium',
      autoExecutable: result.autoFixable || false,
      actionData: {
        issueType: result.type,
        affectedElements: result.affectedElements,
        fixSuggestion: result.fixSuggestion,
      },
      affectedUrls: result.affectedUrls,
    }));

    // Clean up old technical recommendations before creating new ones
    await this.repository.deleteRecommendations(projectId, {
      source: 'technical_seo_agent',
      category: 'technical',
    });

    return this.createRecommendations(inputs);
  }

  /**
   * Create recommendations from Core Web Vitals analysis
   */
  async createFromCWVAnalysis(
    projectId: string,
    cwvResults: CWVAnalysisResult[]
  ): Promise<BulkCreateResult> {
    const inputs: CreateRecommendationInput[] = cwvResults
      .filter(r => r.needsImprovement)
      .map(result => ({
        projectId,
        source: 'cwv_worker' as RecommendationSource,
        category: 'technical' as RecommendationCategory,
        title: `Cải thiện ${result.metric} - ${result.rating}`,
        description: result.description,
        impact: result.rating === 'poor' ? 'high' : 'medium',
        effort: result.effort || 'medium',
        autoExecutable: false,
        actionData: {
          metric: result.metric,
          currentValue: result.value,
          threshold: result.threshold,
          percentile: result.percentile,
        },
        affectedUrls: result.affectedUrls,
      }));

    return this.createRecommendations(inputs);
  }

  /**
   * Create recommendations from Keyword Intelligence analysis
   */
  async createFromKeywordAnalysis(
    projectId: string,
    keywordOpportunities: KeywordOpportunity[]
  ): Promise<BulkCreateResult> {
    const inputs: CreateRecommendationInput[] = keywordOpportunities.map(opp => ({
      projectId,
      source: 'keyword_intelligence' as RecommendationSource,
      category: 'keywords' as RecommendationCategory,
      title: `Cơ hội từ khóa "${opp.keyword}"`,
      description: opp.description || `Từ khóa có volume ${opp.searchVolume}/tháng, hiện rank #${opp.currentPosition}. ${opp.suggestion}`,
      impact: opp.searchVolume > 10000 ? 'high' : opp.searchVolume > 1000 ? 'medium' : 'low',
      effort: opp.difficulty > 70 ? 'high' : opp.difficulty > 40 ? 'medium' : 'low',
      autoExecutable: false,
      actionData: {
        keyword: opp.keyword,
        searchVolume: opp.searchVolume,
        currentPosition: opp.currentPosition,
        targetPosition: opp.targetPosition,
        difficulty: opp.difficulty,
        intent: opp.intent,
      },
      estimatedTrafficGain: opp.estimatedTrafficGain,
      relatedKeywords: opp.relatedKeywords,
    }));

    return this.createRecommendations(inputs);
  }

  /**
   * Create recommendations from Monitoring Agent alerts
   */
  async createFromMonitoringAlerts(
    projectId: string,
    alerts: MonitoringAlert[]
  ): Promise<BulkCreateResult> {
    const inputs: CreateRecommendationInput[] = alerts
      .filter(a => a.severity !== 'info')
      .map(alert => ({
        projectId,
        source: 'monitoring_agent' as RecommendationSource,
        category: this.mapAlertTypeToCategory(alert.type),
        title: alert.title,
        description: `${alert.description}\n\nKhuyến nghị: ${alert.recommendedActions.join(', ')}`,
        impact: alert.severity === 'critical' ? 'high' : alert.severity === 'warning' ? 'medium' : 'low',
        effort: 'medium',
        autoExecutable: false,
        actionData: {
          alertId: alert.id,
          alertType: alert.type,
          metricType: alert.metricType,
          anomalyType: alert.anomalyType,
          currentValue: alert.currentValue,
          expectedValue: alert.expectedValue,
          deviation: alert.deviation,
        },
      }));

    return this.createRecommendations(inputs);
  }

  /**
   * Create recommendations from Content Engine analysis
   */
  async createFromContentAnalysis(
    projectId: string,
    contentIssues: ContentIssue[]
  ): Promise<BulkCreateResult> {
    const inputs: CreateRecommendationInput[] = contentIssues.map(issue => ({
      projectId,
      source: 'content_engine' as RecommendationSource,
      category: 'content' as RecommendationCategory,
      title: issue.title,
      description: issue.description,
      impact: issue.impact,
      effort: issue.effort,
      autoExecutable: issue.autoFixable || false,
      actionData: {
        issueType: issue.type,
        suggestion: issue.suggestion,
        examples: issue.examples,
      },
      affectedUrls: issue.affectedUrls,
      relatedKeywords: issue.targetKeywords,
    }));

    return this.createRecommendations(inputs);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapSeverityToImpact(severity: string): ImpactLevel {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'error':
        return 'high';
      case 'warning':
        return 'medium';
      default:
        return 'low';
    }
  }

  private mapAlertTypeToCategory(alertType: string): RecommendationCategory {
    switch (alertType.toLowerCase()) {
      case 'traffic':
      case 'ranking':
        return 'keywords';
      case 'backlink':
        return 'backlinks';
      case 'cwv':
      case 'technical':
        return 'technical';
      case 'content':
        return 'content';
      default:
        return 'technical';
    }
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Clean up old pending recommendations
   */
  async cleanupOldRecommendations(
    projectId: string,
    olderThanDays: number = 30
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.repository.deleteRecommendations(projectId, {
      olderThan: cutoffDate,
    });
  }

  /**
   * Refresh recommendations from a specific source
   * Deletes old ones and creates new ones
   */
  async refreshRecommendations(
    projectId: string,
    source: RecommendationSource,
    newRecommendations: CreateRecommendationInput[]
  ): Promise<BulkCreateResult> {
    // Delete old recommendations from this source
    await this.repository.deleteRecommendations(projectId, { source });

    // Create new recommendations
    return this.createRecommendations(
      newRecommendations.map(r => ({ ...r, source })),
      { skipDuplicates: false }
    );
  }
}

// =============================================================================
// SUPPORTING TYPES FOR AGENT INTEGRATIONS
// =============================================================================

export interface TechnicalAuditResult {
  type: string;
  title: string;
  description: string;
  severity: 'critical' | 'error' | 'warning' | 'notice';
  effort?: EffortLevel;
  autoFixable?: boolean;
  affectedUrls?: string[];
  affectedElements?: string[];
  fixSuggestion?: string;
}

export interface CWVAnalysisResult {
  metric: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB';
  value: number;
  threshold: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  percentile: number;
  needsImprovement: boolean;
  description: string;
  effort?: EffortLevel;
  affectedUrls?: string[];
}

export interface KeywordOpportunity {
  keyword: string;
  searchVolume: number;
  currentPosition: number;
  targetPosition: number;
  difficulty: number;
  intent: 'informational' | 'navigational' | 'transactional' | 'commercial';
  description?: string;
  suggestion?: string;
  estimatedTrafficGain?: number;
  relatedKeywords?: string[];
}

export interface MonitoringAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  metricType: string;
  anomalyType: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  recommendedActions: string[];
}

export interface ContentIssue {
  type: string;
  title: string;
  description: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  autoFixable?: boolean;
  suggestion?: string;
  examples?: string[];
  affectedUrls?: string[];
  targetKeywords?: string[];
}

// =============================================================================
// FACTORY
// =============================================================================

export function createRecommendationService(pool: Pool): RecommendationService {
  return new RecommendationService(pool);
}
