/**
 * Risk Evaluator Agent
 * 
 * v1.2 - Evaluates actions from risk control perspective
 * 
 * Objective: Minimize SEO and platform risk
 * Metrics: spam signals, guideline violations, penalty indicators
 * Bias: Conservative, defensive
 * 
 * This agent acts as a guardian against risky actions that could
 * harm the website's search standing or violate guidelines.
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
  ActionReversibility,
  ActionScope,
  HistoricalOutcome,
} from './models';

// Risk-specific evaluation criteria
interface RiskCriteria {
  spamRisk: number; // 0-100 (higher = more risky)
  guidelineViolationRisk: number; // 0-100
  penaltyRisk: number; // 0-100
  reversibilityScore: number; // 0-100 (higher = more reversible)
  impactScopeRisk: number; // 0-100 (higher = wider blast radius)
  historicalRisk: number; // 0-100 (based on similar action outcomes)
}

// Known spam/penalty indicators
const SPAM_KEYWORDS = ['keyword stuffing', 'hidden text', 'link scheme', 'doorway page'];
const RISKY_PATTERNS = ['bulk', 'automated', 'mass', 'aggressive'];

export class RiskEvaluator {
  private logger: Console;
  private config: AgentConfig;

  constructor(config?: Partial<AgentConfig>) {
    this.config = { ...DEFAULT_AGENT_CONFIGS[AgentRole.RISK], ...config };
    this.logger = console;
    this.logger.log(`[RiskEvaluator] Initialized: ${this.config.name}`);
  }

  /**
   * Evaluate an action from risk control perspective
   */
  async evaluate(
    action: SEOAction,
    riskClassification: RiskClassification,
    context: DebateContext
  ): Promise<AgentEvaluation> {
    this.logger.log(`[RiskEvaluator] Evaluating action: ${action.id}`);

    // Analyze risk criteria
    const criteria = this.analyzeRiskCriteria(action, riskClassification, context);

    // Generate reasoning points
    const reasoning = this.generateReasoning(action, criteria, riskClassification);

    // Calculate assessment scores
    const assessment = this.calculateAssessment(criteria, reasoning);

    // Determine position (conservative bias)
    const position = this.determinePosition(assessment, criteria);

    // Generate risk mitigation modifications
    const modifications = this.suggestRiskMitigations(action, criteria, position);

    // Calculate confidence
    const confidence = this.calculateConfidence(action, criteria, riskClassification);

    const evaluation: AgentEvaluation = {
      agentRole: AgentRole.RISK,
      agentName: this.config.name,
      position,
      confidence,
      reasoning,
      assessment,
      modifications: modifications.length > 0 ? modifications : undefined,
      evaluatedAt: new Date().toISOString(),
    };

    this.logger.log(
      `[RiskEvaluator] Evaluation complete: ${position.toUpperCase()} ` +
      `(confidence: ${confidence}%, risk score: ${assessment.riskScore})`
    );

    return evaluation;
  }

  // ============================================================================
  // RISK CRITERIA ANALYSIS
  // ============================================================================

  private analyzeRiskCriteria(
    action: SEOAction,
    riskClassification: RiskClassification,
    context: DebateContext
  ): RiskCriteria {
    return {
      spamRisk: this.assessSpamRisk(action),
      guidelineViolationRisk: this.assessGuidelineViolationRisk(action),
      penaltyRisk: this.assessPenaltyRisk(action, riskClassification),
      reversibilityScore: this.assessReversibility(action, context),
      impactScopeRisk: this.assessImpactScope(action, context),
      historicalRisk: this.assessHistoricalRisk(action, context),
    };
  }

  private assessSpamRisk(action: SEOAction): number {
    let risk = 10; // Base risk

    // Check for spam indicators in action description/reasoning
    const textToAnalyze = `${action.description} ${action.reasoning}`.toLowerCase();
    
    for (const keyword of SPAM_KEYWORDS) {
      if (textToAnalyze.includes(keyword)) {
        risk += 40;
      }
    }

    for (const pattern of RISKY_PATTERNS) {
      if (textToAnalyze.includes(pattern)) {
        risk += 15;
      }
    }

    // Action type spam risk
    const spamRiskByType: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: 20, // Can be spammy if low quality
      [ActionType.TARGET_NEW_KEYWORD]: 15,
      [ActionType.OPTIMIZE_CONTENT]: 25, // Keyword stuffing risk
      [ActionType.ADD_INTERNAL_LINK]: 15, // Link scheme risk
      [ActionType.IMPROVE_KEYWORD_RANKING]: 10,
      [ActionType.FIX_SCHEMA_MARKUP]: 5,
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: 20, // Over-optimization risk
      [ActionType.IMPROVE_PAGE_SPEED]: 5,
      [ActionType.FIX_TECHNICAL_ISSUE]: 5,
      [ActionType.INVESTIGATE_ANOMALY]: 0,
      [ActionType.SET_UP_ALERT]: 0,
      [ActionType.UPDATE_CONTENT]: 15,
    };

    risk += spamRiskByType[action.type] || 10;

    return Math.min(100, Math.max(0, risk));
  }

  private assessGuidelineViolationRisk(action: SEOAction): number {
    let risk = 10;

    // Check for guideline violation indicators
    const violationIndicators = [
      'hidden', 'cloaking', 'redirect', 'doorway', 'scraped', 'duplicate',
      'thin content', 'link farm', 'paid links', 'unnatural'
    ];

    const textToAnalyze = `${action.description} ${action.reasoning}`.toLowerCase();

    for (const indicator of violationIndicators) {
      if (textToAnalyze.includes(indicator)) {
        risk += 30;
      }
    }

    // Content-modifying actions have higher guideline risk
    const guidelineRiskByType: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: 15,
      [ActionType.TARGET_NEW_KEYWORD]: 10,
      [ActionType.OPTIMIZE_CONTENT]: 20,
      [ActionType.ADD_INTERNAL_LINK]: 10,
      [ActionType.IMPROVE_KEYWORD_RANKING]: 5,
      [ActionType.FIX_SCHEMA_MARKUP]: 15, // Schema spam risk
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: 15,
      [ActionType.IMPROVE_PAGE_SPEED]: 5,
      [ActionType.FIX_TECHNICAL_ISSUE]: 5,
      [ActionType.INVESTIGATE_ANOMALY]: 0,
      [ActionType.SET_UP_ALERT]: 0,
      [ActionType.UPDATE_CONTENT]: 15,
    };

    risk += guidelineRiskByType[action.type] || 10;

    return Math.min(100, Math.max(0, risk));
  }

  private assessPenaltyRisk(action: SEOAction, riskClassification: RiskClassification): number {
    let risk = 10;

    // Base on risk classification level
    const levelRisk: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 10,
      [RiskLevel.MEDIUM]: 40,
      [RiskLevel.HIGH]: 80,
    };

    risk += levelRisk[riskClassification.level];

    // Factor count increases penalty risk
    risk += Math.min(30, riskClassification.factors.length * 10);

    return Math.min(100, Math.max(0, risk));
  }

  private assessReversibility(action: SEOAction, context: DebateContext): number {
    // Higher score = more reversible = safer
    let score = 50;

    // Reversibility from context
    const reversibilityBonus: Record<ActionReversibility, number> = {
      easy: 30,
      moderate: 15,
      difficult: -20,
      impossible: -40,
    };

    if (context.actionReversibility) {
      score += reversibilityBonus[context.actionReversibility] || 0;
    }

    // Action type reversibility
    const typeReversibility: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: 10, // Can delete
      [ActionType.TARGET_NEW_KEYWORD]: 10, // Can remove
      [ActionType.OPTIMIZE_CONTENT]: 5, // If we keep backup
      [ActionType.ADD_INTERNAL_LINK]: 15, // Easy to remove
      [ActionType.IMPROVE_KEYWORD_RANKING]: 10,
      [ActionType.FIX_SCHEMA_MARKUP]: 10, // Can revert
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: 5,
      [ActionType.IMPROVE_PAGE_SPEED]: 10,
      [ActionType.FIX_TECHNICAL_ISSUE]: 5,
      [ActionType.INVESTIGATE_ANOMALY]: 20, // No changes
      [ActionType.SET_UP_ALERT]: 20, // No changes
      [ActionType.UPDATE_CONTENT]: 10,
    };

    score += typeReversibility[action.type] || 0;

    return Math.min(100, Math.max(0, score));
  }

  private assessImpactScope(action: SEOAction, context: DebateContext): number {
    let risk = 20;

    // Scope from context
    const scopeRisk: Record<ActionScope, number> = {
      single_element: 10,
      single_page: 20,
      multiple_pages: 40,
      site_wide: 70,
    };

    if (context.actionScope) {
      risk = scopeRisk[context.actionScope] || 30;
    }

    // Action type scope risk
    if (action.type === ActionType.FIX_TECHNICAL_ISSUE) {
      risk += 15; // Technical issues often affect multiple pages
    }

    return Math.min(100, Math.max(0, risk));
  }

  private assessHistoricalRisk(action: SEOAction, context: DebateContext): number {
    let risk = 20; // Base historical risk

    // If we have historical context
    if (context.historicalOutcomes) {
      const similarOutcomes = context.historicalOutcomes.filter(
        o => o.actionType === action.type
      );
      
      if (similarOutcomes.length > 0) {
        const negativeOutcomes = similarOutcomes.filter(o => !o.success);
        risk = Math.round((negativeOutcomes.length / similarOutcomes.length) * 100);
      }
    }

    return Math.min(100, Math.max(0, risk));
  }

  // ============================================================================
  // REASONING GENERATION
  // ============================================================================

  private generateReasoning(
    action: SEOAction,
    criteria: RiskCriteria,
    riskClassification: RiskClassification
  ): ReasoningPoint[] {
    const points: ReasoningPoint[] = [];

    // Spam risk reasoning
    if (criteria.spamRisk >= 50) {
      points.push({
        type: 'risk',
        statement: `High spam risk detected (${criteria.spamRisk}/100) - action may trigger spam filters`,
        evidence: 'Action characteristics match known spam patterns',
        weight: 'high',
      });
    } else if (criteria.spamRisk >= 30) {
      points.push({
        type: 'concern',
        statement: `Moderate spam risk (${criteria.spamRisk}/100) - proceed with caution`,
        weight: 'medium',
      });
    }

    // Guideline violation risk
    if (criteria.guidelineViolationRisk >= 50) {
      points.push({
        type: 'risk',
        statement: `Potential guideline violation risk (${criteria.guidelineViolationRisk}/100)`,
        evidence: 'Action may conflict with search engine webmaster guidelines',
        weight: 'high',
      });
    }

    // Penalty risk
    if (criteria.penaltyRisk >= 60) {
      points.push({
        type: 'risk',
        statement: `Significant penalty risk identified (${criteria.penaltyRisk}/100)`,
        evidence: `Risk level: ${riskClassification.level.toUpperCase()}, Factors: ${riskClassification.factors.length}`,
        weight: 'high',
      });
    } else if (criteria.penaltyRisk >= 30) {
      points.push({
        type: 'concern',
        statement: `Moderate penalty risk (${criteria.penaltyRisk}/100)`,
        weight: 'medium',
      });
    }

    // Reversibility assessment
    if (criteria.reversibilityScore >= 70) {
      points.push({
        type: 'benefit',
        statement: `High reversibility (${criteria.reversibilityScore}/100) - changes can be easily undone`,
        weight: 'medium',
      });
    } else if (criteria.reversibilityScore < 40) {
      points.push({
        type: 'risk',
        statement: `Low reversibility (${criteria.reversibilityScore}/100) - difficult to undo changes`,
        evidence: `Action type ${action.type} has limited rollback options`,
        weight: 'high',
      });
    }

    // Impact scope
    if (criteria.impactScopeRisk >= 60) {
      points.push({
        type: 'risk',
        statement: `Wide impact scope (${criteria.impactScopeRisk}/100) - affects multiple areas`,
        weight: 'high',
      });
    }

    // Historical risk
    if (criteria.historicalRisk >= 50) {
      points.push({
        type: 'concern',
        statement: `Historical data shows elevated risk for similar actions`,
        weight: 'medium',
      });
    }

    // Positive observation if overall low risk
    const avgRisk = (criteria.spamRisk + criteria.guidelineViolationRisk + 
                    criteria.penaltyRisk + criteria.impactScopeRisk) / 4;
    if (avgRisk < 25) {
      points.push({
        type: 'benefit',
        statement: `Overall low risk profile - action appears safe to execute`,
        weight: 'medium',
      });
    }

    return points;
  }

  // ============================================================================
  // ASSESSMENT CALCULATION
  // ============================================================================

  private calculateAssessment(criteria: RiskCriteria, reasoning: ReasoningPoint[]): Assessment {
    // Calculate overall risk score (average of risk factors)
    const riskScore = Math.round(
      (criteria.spamRisk + criteria.guidelineViolationRisk + 
       criteria.penaltyRisk + criteria.impactScopeRisk + criteria.historicalRisk) / 5
    );

    // Benefit score is inverse - high reversibility and low risk = benefit
    const benefitScore = Math.round(
      (criteria.reversibilityScore + (100 - riskScore)) / 2
    );

    // Alignment with risk control objective (lower risk = better alignment)
    const alignmentScore = 100 - riskScore;

    // Overall score: positive = support, negative = oppose
    // Risk agent uses inverted logic - high risk = negative score
    const overallScore = Math.round(benefitScore - riskScore);

    const summary = this.generateSummary(riskScore, criteria);

    return {
      overallScore: Math.min(100, Math.max(-100, overallScore)),
      benefitScore,
      riskScore,
      alignmentScore,
      summary,
    };
  }

  private generateSummary(riskScore: number, criteria: RiskCriteria): string {
    if (riskScore >= 70) {
      return 'CRITICAL: High risk action that could result in penalties or ranking loss. Recommend REJECT.';
    } else if (riskScore >= 50) {
      return 'WARNING: Elevated risk detected. Requires risk mitigation before proceeding.';
    } else if (riskScore >= 30) {
      return 'MODERATE: Some risk factors present but manageable with proper safeguards.';
    } else if (criteria.reversibilityScore >= 70) {
      return 'LOW RISK: Action appears safe with good reversibility. Minor concerns only.';
    }
    return 'ACCEPTABLE: Risk profile within tolerance. No significant concerns identified.';
  }

  // ============================================================================
  // POSITION DETERMINATION
  // ============================================================================

  private determinePosition(assessment: Assessment, criteria: RiskCriteria): AgentPosition {
    // Conservative bias - Risk agent is more likely to oppose
    if (assessment.riskScore >= 60) {
      return AgentPosition.OPPOSE;
    } else if (assessment.riskScore >= 40) {
      return AgentPosition.MODIFY;
    } else if (assessment.riskScore >= 25) {
      // Even moderate risk gets MODIFY due to conservative bias
      if (criteria.reversibilityScore < 50) {
        return AgentPosition.MODIFY;
      }
      return AgentPosition.SUPPORT;
    }
    return AgentPosition.SUPPORT;
  }

  // ============================================================================
  // RISK MITIGATION SUGGESTIONS
  // ============================================================================

  private suggestRiskMitigations(
    action: SEOAction,
    criteria: RiskCriteria,
    position: AgentPosition
  ): SuggestedModification[] {
    const modifications: SuggestedModification[] = [];

    // Always suggest rollback capability if reversibility is low
    if (criteria.reversibilityScore < 50) {
      modifications.push({
        aspect: 'rollback',
        currentValue: 'No rollback plan',
        suggestedValue: 'Implement pre-change backup and rollback mechanism',
        reason: 'Low reversibility score requires explicit rollback capability',
        priority: 'required',
      });
    }

    // Scope reduction for wide-impact actions
    if (criteria.impactScopeRisk >= 50) {
      modifications.push({
        aspect: 'scope',
        currentValue: 'Current scope',
        suggestedValue: 'Start with single page pilot before wider rollout',
        reason: 'Wide impact scope increases risk - phased approach recommended',
        priority: 'required',
      });
    }

    // Content review for spam risk
    if (criteria.spamRisk >= 40) {
      modifications.push({
        aspect: 'content_review',
        currentValue: 'No review',
        suggestedValue: 'Manual review of content changes before publishing',
        reason: 'Elevated spam risk requires human oversight',
        priority: 'recommended',
      });
    }

    // Monitoring for high-risk actions
    if (criteria.penaltyRisk >= 40) {
      modifications.push({
        aspect: 'monitoring',
        currentValue: 'Standard monitoring',
        suggestedValue: 'Enhanced monitoring for 7 days post-execution',
        reason: 'Penalty risk requires close observation of ranking changes',
        priority: 'recommended',
      });
    }

    // Gradual rollout for guideline-adjacent actions
    if (criteria.guidelineViolationRisk >= 40) {
      modifications.push({
        aspect: 'rollout_strategy',
        currentValue: 'Immediate full execution',
        suggestedValue: 'Gradual rollout with pause-and-assess checkpoints',
        reason: 'Guideline violation risk warrants cautious execution',
        priority: 'required',
      });
    }

    return modifications;
  }

  // ============================================================================
  // CONFIDENCE CALCULATION
  // ============================================================================

  private calculateConfidence(
    action: SEOAction,
    criteria: RiskCriteria,
    riskClassification: RiskClassification
  ): number {
    let confidence = 60; // Base confidence (higher for risk agent)

    // Risk classification score contributes to confidence
    // Higher score (riskier) = clearer signal = more confidence
    if (riskClassification.score >= 70 || riskClassification.score <= 20) {
      confidence += 15; // Clear signals = high confidence
    }

    // Clear risk signals increase confidence
    if (criteria.penaltyRisk >= 60 || criteria.spamRisk >= 60) {
      confidence += 15; // Clear high risk = confident opposition
    }

    // Clear low risk also increases confidence
    const avgRisk = (criteria.spamRisk + criteria.guidelineViolationRisk + 
                    criteria.penaltyRisk + criteria.impactScopeRisk) / 4;
    if (avgRisk < 20) {
      confidence += 10; // Clear low risk = confident support
    }

    // Ambiguous risk decreases confidence
    if (avgRisk >= 30 && avgRisk <= 50) {
      confidence -= 10;
    }

    return Math.min(100, Math.max(0, Math.round(confidence)));
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }
}

export default RiskEvaluator;
