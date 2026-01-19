/**
 * SEO Evaluator Agent
 * 
 * v1.2 - Evaluates actions from SEO growth perspective
 * 
 * Objective: Maximize organic growth
 * Metrics: traffic, ranking, coverage, CTR
 * Bias: Aggressive optimization
 * 
 * This agent advocates for SEO improvements while providing
 * honest assessment of potential gains.
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import { RiskClassification, RiskLevel } from '../autonomous_agent_v1_1/models';
import {
  AgentRole,
  AgentConfig,
  AgentEvaluation,
  AgentPosition,
  ReasoningPoint,
  Assessment,
  SuggestedModification,
  DebateContext,
  DEFAULT_AGENT_CONFIGS,
} from './models';

// SEO-specific evaluation criteria
interface SEOCriteria {
  trafficPotential: number; // 0-100
  rankingImpact: number; // 0-100
  keywordRelevance: number; // 0-100
  technicalBenefit: number; // 0-100
  competitiveAdvantage: number; // 0-100
}

export class SEOEvaluator {
  private logger: Console;
  private config: AgentConfig;

  constructor(config?: Partial<AgentConfig>) {
    this.config = { ...DEFAULT_AGENT_CONFIGS[AgentRole.SEO], ...config };
    this.logger = console;
    this.logger.log(`[SEOEvaluator] Initialized: ${this.config.name}`);
  }

  /**
   * Evaluate an action from SEO perspective
   */
  async evaluate(
    action: SEOAction,
    riskClassification: RiskClassification,
    context: DebateContext
  ): Promise<AgentEvaluation> {
    this.logger.log(`[SEOEvaluator] Evaluating action: ${action.id}`);

    // Analyze SEO criteria
    const criteria = this.analyzeSEOCriteria(action, context);

    // Generate reasoning points
    const reasoning = this.generateReasoning(action, criteria, riskClassification);

    // Calculate assessment scores
    const assessment = this.calculateAssessment(criteria, reasoning);

    // Determine position
    const position = this.determinePosition(assessment);

    // Generate modifications if needed
    const modifications = position === AgentPosition.MODIFY
      ? this.suggestModifications(action, criteria)
      : undefined;

    // Calculate confidence based on evidence quality
    const confidence = this.calculateConfidence(action, criteria);

    const evaluation: AgentEvaluation = {
      agentRole: AgentRole.SEO,
      agentName: this.config.name,
      position,
      confidence,
      reasoning,
      assessment,
      modifications,
      evaluatedAt: new Date().toISOString(),
    };

    this.logger.log(
      `[SEOEvaluator] Evaluation complete: ${position.toUpperCase()} ` +
      `(confidence: ${confidence}%, score: ${assessment.overallScore})`
    );

    return evaluation;
  }

  // ============================================================================
  // SEO CRITERIA ANALYSIS
  // ============================================================================

  private analyzeSEOCriteria(action: SEOAction, context: DebateContext): SEOCriteria {
    return {
      trafficPotential: this.assessTrafficPotential(action, context),
      rankingImpact: this.assessRankingImpact(action),
      keywordRelevance: this.assessKeywordRelevance(action),
      technicalBenefit: this.assessTechnicalBenefit(action),
      competitiveAdvantage: this.assessCompetitiveAdvantage(action, context),
    };
  }

  private assessTrafficPotential(action: SEOAction, context: DebateContext): number {
    let score = 50; // Base score

    // Action type impact on traffic
    const trafficImpactByType: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: 30,
      [ActionType.TARGET_NEW_KEYWORD]: 25,
      [ActionType.OPTIMIZE_CONTENT]: 15,
      [ActionType.ADD_INTERNAL_LINK]: 10,
      [ActionType.IMPROVE_KEYWORD_RANKING]: 20,
      [ActionType.FIX_SCHEMA_MARKUP]: 10,
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: 8,
      [ActionType.IMPROVE_PAGE_SPEED]: 12,
      [ActionType.FIX_TECHNICAL_ISSUE]: 15,
      [ActionType.INVESTIGATE_ANOMALY]: 0,
      [ActionType.SET_UP_ALERT]: 0,
      [ActionType.UPDATE_CONTENT]: 10,
    };

    score += trafficImpactByType[action.type] || 0;

    // Expected impact confidence
    if (action.expectedImpact.confidence === 'high') {
      score += 10;
    } else if (action.expectedImpact.confidence === 'low') {
      score -= 10;
    }

    // Page metrics consideration
    if (context.pageMetrics) {
      if (context.pageMetrics.currentTraffic < 100) {
        score += 15; // Higher potential for low-traffic pages
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessRankingImpact(action: SEOAction): number {
    let score = 50;

    // Direct ranking impact actions
    const rankingImpactByType: Record<ActionType, number> = {
      [ActionType.OPTIMIZE_CONTENT]: 20,
      [ActionType.TARGET_NEW_KEYWORD]: 25,
      [ActionType.IMPROVE_KEYWORD_RANKING]: 30,
      [ActionType.ADD_INTERNAL_LINK]: 15,
      [ActionType.FIX_SCHEMA_MARKUP]: 10,
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: 12,
      [ActionType.CREATE_CONTENT]: 20,
      [ActionType.UPDATE_CONTENT]: 15,
      [ActionType.IMPROVE_PAGE_SPEED]: 10,
      [ActionType.FIX_TECHNICAL_ISSUE]: 8,
      [ActionType.INVESTIGATE_ANOMALY]: 0,
      [ActionType.SET_UP_ALERT]: 0,
    };

    score += rankingImpactByType[action.type] || 0;

    // Keyword targeting
    if (action.targetKeyword) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessKeywordRelevance(action: SEOAction): number {
    let score = 60; // Base relevance

    if (action.targetKeyword) {
      score += 20;
    }

    // Evidence-based relevance
    const keywordEvidence = action.evidence.filter(
      e => e.type === 'insight' || e.description.toLowerCase().includes('keyword')
    );
    score += Math.min(20, keywordEvidence.length * 5);

    return Math.min(100, Math.max(0, score));
  }

  private assessTechnicalBenefit(action: SEOAction): number {
    let score = 50;

    const technicalActions = [
      ActionType.FIX_SCHEMA_MARKUP,
      ActionType.IMPROVE_PAGE_SPEED,
      ActionType.FIX_TECHNICAL_ISSUE,
    ];

    if (technicalActions.includes(action.type)) {
      score += 30;
    }

    // Internal linking improves crawlability
    if (action.type === ActionType.ADD_INTERNAL_LINK) {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessCompetitiveAdvantage(action: SEOAction, context: DebateContext): number {
    let score = 50;

    // New content/keywords create competitive advantage
    if (action.type === ActionType.CREATE_CONTENT) {
      score += 25;
    }
    if (action.type === ActionType.TARGET_NEW_KEYWORD) {
      score += 20;
    }

    // Optimization improves competitive position
    if (action.type === ActionType.OPTIMIZE_CONTENT) {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  // ============================================================================
  // REASONING GENERATION
  // ============================================================================

  private generateReasoning(
    action: SEOAction,
    criteria: SEOCriteria,
    riskClassification: RiskClassification
  ): ReasoningPoint[] {
    const points: ReasoningPoint[] = [];

    // Traffic potential reasoning
    if (criteria.trafficPotential >= 70) {
      points.push({
        type: 'benefit',
        statement: `High traffic potential (${criteria.trafficPotential}/100) - action likely to increase organic visits`,
        evidence: `Action type ${action.type} historically drives traffic growth`,
        weight: 'high',
      });
    } else if (criteria.trafficPotential >= 50) {
      points.push({
        type: 'benefit',
        statement: `Moderate traffic potential (${criteria.trafficPotential}/100)`,
        weight: 'medium',
      });
    } else {
      points.push({
        type: 'observation',
        statement: `Limited traffic potential (${criteria.trafficPotential}/100) - may not significantly impact visits`,
        weight: 'low',
      });
    }

    // Ranking impact reasoning
    if (criteria.rankingImpact >= 70) {
      points.push({
        type: 'benefit',
        statement: `Strong ranking improvement expected - action directly impacts search position`,
        evidence: action.reasoning,
        weight: 'high',
      });
    }

    // Keyword relevance
    if (criteria.keywordRelevance >= 70 && action.targetKeyword) {
      points.push({
        type: 'benefit',
        statement: `Strong keyword alignment with target: "${action.targetKeyword}"`,
        weight: 'high',
      });
    }

    // Technical SEO benefits
    if (criteria.technicalBenefit >= 70) {
      points.push({
        type: 'benefit',
        statement: `Technical SEO improvement - enhances crawlability and indexation`,
        weight: 'medium',
      });
    }

    // Competitive advantage
    if (criteria.competitiveAdvantage >= 70) {
      points.push({
        type: 'benefit',
        statement: `Creates competitive advantage in search results`,
        weight: 'high',
      });
    }

    // Risk acknowledgment (honest assessment)
    if (riskClassification.level === RiskLevel.HIGH) {
      points.push({
        type: 'risk',
        statement: `High risk classification acknowledged - execution requires careful consideration`,
        weight: 'medium',
      });
    }

    // Time to result
    if (action.expectedImpact.timeToResult) {
      points.push({
        type: 'observation',
        statement: `Expected time to see results: ${action.expectedImpact.timeToResult}`,
        weight: 'low',
      });
    }

    return points;
  }

  // ============================================================================
  // ASSESSMENT CALCULATION
  // ============================================================================

  private calculateAssessment(criteria: SEOCriteria, reasoning: ReasoningPoint[]): Assessment {
    // Calculate benefit score (average of positive criteria)
    const benefitScore = Math.round(
      (criteria.trafficPotential + criteria.rankingImpact + criteria.competitiveAdvantage) / 3
    );

    // Calculate risk score from reasoning
    const riskPoints = reasoning.filter(r => r.type === 'risk');
    const riskScore = riskPoints.length * 20; // Each risk point adds 20

    // Alignment with SEO objective
    const alignmentScore = Math.round(
      (criteria.trafficPotential * 0.3 +
       criteria.rankingImpact * 0.3 +
       criteria.keywordRelevance * 0.2 +
       criteria.technicalBenefit * 0.1 +
       criteria.competitiveAdvantage * 0.1)
    );

    // Overall score: -100 to +100
    // Positive = support, Negative = oppose
    const overallScore = Math.round(
      (benefitScore * 1.5) - (riskScore * 0.5) - 50
    );

    // Generate summary
    const summary = this.generateSummary(benefitScore, riskScore, alignmentScore);

    return {
      overallScore: Math.min(100, Math.max(-100, overallScore)),
      benefitScore,
      riskScore: Math.min(100, riskScore),
      alignmentScore,
      summary,
    };
  }

  private generateSummary(benefitScore: number, riskScore: number, alignmentScore: number): string {
    if (benefitScore >= 70 && riskScore < 30) {
      return 'Strong SEO opportunity with clear growth potential and acceptable risk profile.';
    } else if (benefitScore >= 50 && riskScore < 50) {
      return 'Moderate SEO benefit expected. Action aligns with organic growth objectives.';
    } else if (benefitScore < 40) {
      return 'Limited SEO value. Action may not significantly impact organic performance.';
    } else if (riskScore >= 50) {
      return 'SEO potential exists but risk factors require consideration.';
    }
    return 'Mixed SEO signals. Further analysis recommended.';
  }

  // ============================================================================
  // POSITION DETERMINATION
  // ============================================================================

  private determinePosition(assessment: Assessment): AgentPosition {
    if (assessment.overallScore >= 30) {
      return AgentPosition.SUPPORT;
    } else if (assessment.overallScore >= 0) {
      return AgentPosition.MODIFY;
    } else if (assessment.overallScore >= -30) {
      return AgentPosition.MODIFY;
    }
    return AgentPosition.OPPOSE;
  }

  // ============================================================================
  // MODIFICATION SUGGESTIONS
  // ============================================================================

  private suggestModifications(action: SEOAction, criteria: SEOCriteria): SuggestedModification[] {
    const modifications: SuggestedModification[] = [];

    // Suggest keyword optimization if relevance is low
    if (criteria.keywordRelevance < 50 && !action.targetKeyword) {
      modifications.push({
        aspect: 'targetKeyword',
        currentValue: 'Not specified',
        suggestedValue: 'Add primary target keyword',
        reason: 'Specifying a target keyword improves ranking focus',
        priority: 'recommended',
      });
    }

    // Suggest scope reduction for broad actions
    if (criteria.trafficPotential > 70 && criteria.rankingImpact < 50) {
      modifications.push({
        aspect: 'scope',
        currentValue: 'Current scope',
        suggestedValue: 'Focus on high-impact pages first',
        reason: 'Prioritizing high-traffic pages maximizes ROI',
        priority: 'optional',
      });
    }

    return modifications;
  }

  // ============================================================================
  // CONFIDENCE CALCULATION
  // ============================================================================

  private calculateConfidence(action: SEOAction, criteria: SEOCriteria): number {
    let confidence = 50; // Base confidence

    // Evidence quality
    if (action.evidence.length >= 3) {
      confidence += 20;
    } else if (action.evidence.length >= 1) {
      confidence += 10;
    }

    // Action impact confidence
    if (action.expectedImpact.confidence === 'high') {
      confidence += 15;
    } else if (action.expectedImpact.confidence === 'medium') {
      confidence += 8;
    }

    // Criteria clarity
    const avgCriteria = Object.values(criteria).reduce((a, b) => a + b, 0) / 5;
    if (avgCriteria > 60) {
      confidence += 10;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }
}

export default SEOEvaluator;
