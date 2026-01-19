/**
 * Brand Evaluator Agent
 * 
 * v1.2 - Evaluates actions from brand integrity perspective
 * 
 * Objective: Protect brand voice, user experience, and trust
 * Metrics: readability, tone consistency, user trust, brand alignment
 * Bias: User-centric, non-promotional
 * 
 * This agent acts as guardian of brand values and user experience,
 * ensuring SEO actions don't compromise brand integrity.
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
  BrandGuidelines,
} from './models';

// Brand-specific evaluation criteria
interface BrandCriteria {
  readabilityImpact: number; // 0-100 (higher = better readability)
  toneConsistency: number; // 0-100 (higher = more consistent)
  userTrustImpact: number; // 0-100 (higher = better trust)
  brandAlignmentScore: number; // 0-100 (higher = more aligned)
  uxImpact: number; // 0-100 (higher = better UX)
  promotionalDensityRisk: number; // 0-100 (higher = more promotional/spammy)
}

// Default brand guidelines if none provided
const DEFAULT_BRAND_GUIDELINES: BrandGuidelines = {
  tone: ['professional', 'helpful', 'trustworthy'],
  forbiddenTerms: ['buy now', 'limited time', 'act fast', 'don\'t miss', 'exclusive offer'],
  preferredTerms: [],
  maxPromotionalDensity: 0.1, // 10% of content can be promotional
};

export class BrandEvaluator {
  private logger: Console;
  private config: AgentConfig;

  constructor(config?: Partial<AgentConfig>) {
    this.config = { ...DEFAULT_AGENT_CONFIGS[AgentRole.BRAND], ...config };
    this.logger = console;
    this.logger.log(`[BrandEvaluator] Initialized: ${this.config.name}`);
  }

  /**
   * Evaluate an action from brand integrity perspective
   */
  async evaluate(
    action: SEOAction,
    riskClassification: RiskClassification,
    context: DebateContext
  ): Promise<AgentEvaluation> {
    this.logger.log(`[BrandEvaluator] Evaluating action: ${action.id}`);

    // Get brand guidelines (use defaults if not provided)
    const brandGuidelines = context.brandGuidelines || DEFAULT_BRAND_GUIDELINES;

    // Analyze brand criteria
    const criteria = this.analyzeBrandCriteria(action, brandGuidelines, context);

    // Generate reasoning points
    const reasoning = this.generateReasoning(action, criteria, brandGuidelines);

    // Calculate assessment scores
    const assessment = this.calculateAssessment(criteria, reasoning);

    // Determine position (user-centric bias)
    const position = this.determinePosition(assessment, criteria);

    // Generate brand-focused modifications
    const modifications = this.suggestBrandModifications(action, criteria, brandGuidelines);

    // Calculate confidence
    const confidence = this.calculateConfidence(action, criteria, brandGuidelines);

    const evaluation: AgentEvaluation = {
      agentRole: AgentRole.BRAND,
      agentName: this.config.name,
      position,
      confidence,
      reasoning,
      assessment,
      modifications: modifications.length > 0 ? modifications : undefined,
      evaluatedAt: new Date().toISOString(),
    };

    this.logger.log(
      `[BrandEvaluator] Evaluation complete: ${position.toUpperCase()} ` +
      `(confidence: ${confidence}%, brand score: ${assessment.alignmentScore})`
    );

    return evaluation;
  }

  // ============================================================================
  // BRAND CRITERIA ANALYSIS
  // ============================================================================

  private analyzeBrandCriteria(
    action: SEOAction,
    brandGuidelines: BrandGuidelines,
    context: DebateContext
  ): BrandCriteria {
    return {
      readabilityImpact: this.assessReadabilityImpact(action),
      toneConsistency: this.assessToneConsistency(action, brandGuidelines),
      userTrustImpact: this.assessUserTrustImpact(action),
      brandAlignmentScore: this.assessBrandAlignment(action, brandGuidelines),
      uxImpact: this.assessUXImpact(action, context),
      promotionalDensityRisk: this.assessPromotionalDensity(action, brandGuidelines),
    };
  }

  private assessReadabilityImpact(action: SEOAction): number {
    let score = 70; // Neutral base

    // Content-modifying actions may affect readability
    const readabilityImpactByType: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: -10, // New content needs review
      [ActionType.TARGET_NEW_KEYWORD]: -5, // Keyword insertion risk
      [ActionType.OPTIMIZE_CONTENT]: -15, // May hurt readability
      [ActionType.ADD_INTERNAL_LINK]: -5, // Link text affects flow
      [ActionType.IMPROVE_KEYWORD_RANKING]: -10,
      [ActionType.FIX_SCHEMA_MARKUP]: 0, // No content change
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: -10, // Anchor text may be awkward
      [ActionType.IMPROVE_PAGE_SPEED]: 5, // Better UX
      [ActionType.FIX_TECHNICAL_ISSUE]: 0, // No content change
      [ActionType.INVESTIGATE_ANOMALY]: 0, // No change
      [ActionType.SET_UP_ALERT]: 0, // No change
      [ActionType.UPDATE_CONTENT]: -5, // Depends on update quality
    };

    score += readabilityImpactByType[action.type] || 0;

    // Check for keyword stuffing indicators in description
    const keywordPattern = /keyword|optimize|seo/gi;
    const keywordMentions = (action.description.match(keywordPattern) || []).length;
    if (keywordMentions > 3) {
      score -= 15; // High keyword focus may hurt readability
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessToneConsistency(action: SEOAction, brandGuidelines: BrandGuidelines): number {
    let score = 70; // Neutral base

    // Check for forbidden terms in action description
    const textToAnalyze = `${action.description} ${action.reasoning}`.toLowerCase();
    
    for (const term of brandGuidelines.forbiddenTerms) {
      if (textToAnalyze.includes(term.toLowerCase())) {
        score -= 20; // Forbidden term detected
      }
    }

    // Check for preferred terms (bonus)
    for (const term of brandGuidelines.preferredTerms) {
      if (textToAnalyze.includes(term.toLowerCase())) {
        score += 5;
      }
    }

    // Content actions have higher tone risk
    if ([ActionType.CREATE_CONTENT, ActionType.OPTIMIZE_CONTENT, ActionType.UPDATE_CONTENT]
        .includes(action.type)) {
      score -= 5; // Needs human review for tone
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessUserTrustImpact(action: SEOAction): number {
    let score = 70; // Neutral base

    // Trust impact by action type
    const trustImpactByType: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: 5, // Good content builds trust
      [ActionType.TARGET_NEW_KEYWORD]: 0,
      [ActionType.OPTIMIZE_CONTENT]: -5, // Over-optimization hurts trust
      [ActionType.ADD_INTERNAL_LINK]: 0, // Depends on relevance
      [ActionType.IMPROVE_KEYWORD_RANKING]: 0,
      [ActionType.FIX_SCHEMA_MARKUP]: 10, // Better search appearance
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: -5, // May seem manipulative
      [ActionType.IMPROVE_PAGE_SPEED]: 15, // Better UX builds trust
      [ActionType.FIX_TECHNICAL_ISSUE]: 10, // Improves reliability
      [ActionType.INVESTIGATE_ANOMALY]: 0,
      [ActionType.SET_UP_ALERT]: 0,
      [ActionType.UPDATE_CONTENT]: 5, // Fresh content
    };

    score += trustImpactByType[action.type] || 0;

    // Aggressive SEO language hurts trust
    const aggressiveIndicators = ['aggressive', 'maximize', 'boost', 'skyrocket', 'explosive'];
    const textToAnalyze = `${action.description} ${action.reasoning}`.toLowerCase();
    
    for (const indicator of aggressiveIndicators) {
      if (textToAnalyze.includes(indicator)) {
        score -= 10;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessBrandAlignment(action: SEOAction, brandGuidelines: BrandGuidelines): number {
    let score = 60; // Neutral base

    // Check alignment with brand tone
    const textToAnalyze = `${action.description} ${action.reasoning}`.toLowerCase();
    
    for (const tone of brandGuidelines.tone) {
      // Positive indicators for brand tone alignment
      const toneIndicators: Record<string, string[]> = {
        professional: ['professional', 'quality', 'expert', 'authoritative'],
        helpful: ['helpful', 'guide', 'assist', 'support', 'solution'],
        trustworthy: ['trust', 'reliable', 'honest', 'transparent', 'authentic'],
        friendly: ['friendly', 'welcoming', 'warm', 'approachable'],
        innovative: ['innovative', 'cutting-edge', 'modern', 'advanced'],
      };

      const indicators = toneIndicators[tone.toLowerCase()] || [];
      for (const indicator of indicators) {
        if (textToAnalyze.includes(indicator)) {
          score += 5;
        }
      }
    }

    // Forbidden terms severely hurt alignment
    for (const term of brandGuidelines.forbiddenTerms) {
      if (textToAnalyze.includes(term.toLowerCase())) {
        score -= 15;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessUXImpact(action: SEOAction, context: DebateContext): number {
    let score = 70; // Neutral base

    // UX impact by action type
    const uxImpactByType: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: 5, // More content can help users
      [ActionType.TARGET_NEW_KEYWORD]: 0,
      [ActionType.OPTIMIZE_CONTENT]: -5, // May prioritize SEO over UX
      [ActionType.ADD_INTERNAL_LINK]: 10, // Helps navigation
      [ActionType.IMPROVE_KEYWORD_RANKING]: 0,
      [ActionType.FIX_SCHEMA_MARKUP]: 5, // Better search appearance
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: -5, // May be awkward
      [ActionType.IMPROVE_PAGE_SPEED]: 20, // Major UX benefit
      [ActionType.FIX_TECHNICAL_ISSUE]: 15, // Fixes broken experience
      [ActionType.INVESTIGATE_ANOMALY]: 0,
      [ActionType.SET_UP_ALERT]: 0,
      [ActionType.UPDATE_CONTENT]: 10, // Fresh content
    };

    score += uxImpactByType[action.type] || 0;

    // Page metrics context
    if (context.pageMetrics) {
      if (context.pageMetrics.bounceRate > 70) {
        // High bounce rate page - UX improvements more valuable
        if (action.type === ActionType.IMPROVE_PAGE_SPEED) {
          score += 10;
        }
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessPromotionalDensity(action: SEOAction, brandGuidelines: BrandGuidelines): number {
    let risk = 20; // Base promotional risk

    // Content-focused actions have higher promotional risk
    const promotionalRiskByType: Record<ActionType, number> = {
      [ActionType.CREATE_CONTENT]: 20,
      [ActionType.TARGET_NEW_KEYWORD]: 15,
      [ActionType.OPTIMIZE_CONTENT]: 25, // Often adds promotional elements
      [ActionType.ADD_INTERNAL_LINK]: 10,
      [ActionType.IMPROVE_KEYWORD_RANKING]: 15,
      [ActionType.FIX_SCHEMA_MARKUP]: 5,
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: 15,
      [ActionType.IMPROVE_PAGE_SPEED]: 0,
      [ActionType.FIX_TECHNICAL_ISSUE]: 0,
      [ActionType.INVESTIGATE_ANOMALY]: 0,
      [ActionType.SET_UP_ALERT]: 0,
      [ActionType.UPDATE_CONTENT]: 15,
    };

    risk += promotionalRiskByType[action.type] || 0;

    // Check for promotional language
    const promotionalIndicators = [
      'call to action', 'cta', 'conversion', 'buy', 'purchase',
      'sign up', 'subscribe', 'get started', 'free trial', 'discount',
    ];
    
    const textToAnalyze = `${action.description} ${action.reasoning}`.toLowerCase();
    for (const indicator of promotionalIndicators) {
      if (textToAnalyze.includes(indicator)) {
        risk += 15;
      }
    }

    return Math.min(100, Math.max(0, risk));
  }

  // ============================================================================
  // REASONING GENERATION
  // ============================================================================

  private generateReasoning(
    action: SEOAction,
    criteria: BrandCriteria,
    brandGuidelines: BrandGuidelines
  ): ReasoningPoint[] {
    const points: ReasoningPoint[] = [];

    // Readability reasoning
    if (criteria.readabilityImpact >= 70) {
      points.push({
        type: 'benefit',
        statement: `Good readability impact (${criteria.readabilityImpact}/100) - maintains content quality`,
        weight: 'medium',
      });
    } else if (criteria.readabilityImpact < 50) {
      points.push({
        type: 'concern',
        statement: `Potential readability impact (${criteria.readabilityImpact}/100) - may affect content clarity`,
        weight: 'high',
      });
    }

    // Tone consistency
    if (criteria.toneConsistency >= 70) {
      points.push({
        type: 'benefit',
        statement: `Consistent with brand tone (${criteria.toneConsistency}/100)`,
        weight: 'medium',
      });
    } else if (criteria.toneConsistency < 50) {
      points.push({
        type: 'risk',
        statement: `Tone consistency concern (${criteria.toneConsistency}/100) - may deviate from brand voice`,
        evidence: `Brand tone: ${brandGuidelines.tone.join(', ')}`,
        weight: 'high',
      });
    }

    // User trust
    if (criteria.userTrustImpact >= 70) {
      points.push({
        type: 'benefit',
        statement: `Positive user trust impact (${criteria.userTrustImpact}/100) - builds credibility`,
        weight: 'high',
      });
    } else if (criteria.userTrustImpact < 50) {
      points.push({
        type: 'risk',
        statement: `User trust risk (${criteria.userTrustImpact}/100) - may appear manipulative`,
        weight: 'high',
      });
    }

    // Brand alignment
    if (criteria.brandAlignmentScore >= 70) {
      points.push({
        type: 'benefit',
        statement: `Well aligned with brand values (${criteria.brandAlignmentScore}/100)`,
        weight: 'medium',
      });
    } else if (criteria.brandAlignmentScore < 50) {
      points.push({
        type: 'concern',
        statement: `Brand alignment concern (${criteria.brandAlignmentScore}/100) - review recommended`,
        weight: 'high',
      });
    }

    // UX impact
    if (criteria.uxImpact >= 80) {
      points.push({
        type: 'benefit',
        statement: `Excellent UX impact (${criteria.uxImpact}/100) - improves user experience`,
        weight: 'high',
      });
    } else if (criteria.uxImpact < 50) {
      points.push({
        type: 'concern',
        statement: `UX concern (${criteria.uxImpact}/100) - may prioritize SEO over user experience`,
        weight: 'medium',
      });
    }

    // Promotional density
    if (criteria.promotionalDensityRisk >= 60) {
      points.push({
        type: 'risk',
        statement: `High promotional density risk (${criteria.promotionalDensityRisk}/100) - may seem too sales-focused`,
        weight: 'high',
      });
    } else if (criteria.promotionalDensityRisk < 30) {
      points.push({
        type: 'benefit',
        statement: `Low promotional density (${criteria.promotionalDensityRisk}/100) - maintains helpful tone`,
        weight: 'low',
      });
    }

    return points;
  }

  // ============================================================================
  // ASSESSMENT CALCULATION
  // ============================================================================

  private calculateAssessment(criteria: BrandCriteria, reasoning: ReasoningPoint[]): Assessment {
    // Calculate benefit score (positive brand metrics)
    const benefitScore = Math.round(
      (criteria.readabilityImpact + criteria.toneConsistency + 
       criteria.userTrustImpact + criteria.uxImpact) / 4
    );

    // Calculate risk score (promotional and misalignment risks)
    const riskScore = Math.round(
      (criteria.promotionalDensityRisk + (100 - criteria.brandAlignmentScore)) / 2
    );

    // Alignment with brand objective
    const alignmentScore = criteria.brandAlignmentScore;

    // Overall score: positive = support, negative = oppose
    const overallScore = Math.round(benefitScore - riskScore);

    const summary = this.generateSummary(criteria, benefitScore, riskScore);

    return {
      overallScore: Math.min(100, Math.max(-100, overallScore)),
      benefitScore,
      riskScore,
      alignmentScore,
      summary,
    };
  }

  private generateSummary(criteria: BrandCriteria, benefitScore: number, riskScore: number): string {
    if (benefitScore >= 70 && riskScore < 30) {
      return 'EXCELLENT: Action aligns with brand values and enhances user experience.';
    } else if (benefitScore >= 60 && riskScore < 40) {
      return 'GOOD: Action generally supports brand integrity with minor considerations.';
    } else if (criteria.promotionalDensityRisk >= 60) {
      return 'CAUTION: Action may appear overly promotional or sales-focused.';
    } else if (criteria.toneConsistency < 50) {
      return 'WARNING: Tone consistency concerns - may not align with brand voice.';
    } else if (criteria.userTrustImpact < 50) {
      return 'WARNING: Action may negatively impact user trust and credibility.';
    } else if (riskScore >= 50) {
      return 'MODERATE: Some brand alignment concerns that need attention.';
    }
    return 'ACCEPTABLE: Action has mixed brand impact - review recommended.';
  }

  // ============================================================================
  // POSITION DETERMINATION
  // ============================================================================

  private determinePosition(assessment: Assessment, criteria: BrandCriteria): AgentPosition {
    // User-centric bias - Brand agent is protective of user experience
    if (assessment.overallScore >= 40 && criteria.userTrustImpact >= 60) {
      return AgentPosition.SUPPORT;
    } else if (assessment.overallScore >= 20 && criteria.userTrustImpact >= 50) {
      return AgentPosition.SUPPORT;
    } else if (assessment.overallScore >= 0) {
      return AgentPosition.MODIFY;
    } else if (assessment.overallScore >= -30 && criteria.userTrustImpact >= 40) {
      return AgentPosition.MODIFY;
    }
    return AgentPosition.OPPOSE;
  }

  // ============================================================================
  // BRAND MODIFICATION SUGGESTIONS
  // ============================================================================

  private suggestBrandModifications(
    action: SEOAction,
    criteria: BrandCriteria,
    brandGuidelines: BrandGuidelines
  ): SuggestedModification[] {
    const modifications: SuggestedModification[] = [];

    // Readability improvement
    if (criteria.readabilityImpact < 60) {
      modifications.push({
        aspect: 'readability',
        currentValue: 'SEO-focused content',
        suggestedValue: 'Human-first content with natural keyword integration',
        reason: 'Prioritize readability and user comprehension',
        priority: 'recommended',
      });
    }

    // Tone alignment
    if (criteria.toneConsistency < 60) {
      modifications.push({
        aspect: 'tone',
        currentValue: 'Current tone',
        suggestedValue: `Align with brand tone: ${brandGuidelines.tone.join(', ')}`,
        reason: 'Maintain consistent brand voice across all content',
        priority: 'required',
      });
    }

    // Promotional reduction
    if (criteria.promotionalDensityRisk >= 50) {
      modifications.push({
        aspect: 'promotional_density',
        currentValue: 'High promotional content',
        suggestedValue: `Reduce promotional elements to < ${brandGuidelines.maxPromotionalDensity * 100}%`,
        reason: 'Excessive promotion damages user trust and brand perception',
        priority: 'required',
      });
    }

    // Trust building
    if (criteria.userTrustImpact < 60) {
      modifications.push({
        aspect: 'trust_signals',
        currentValue: 'Limited trust signals',
        suggestedValue: 'Add value-first content, citations, or helpful resources',
        reason: 'Build user trust through helpful, non-manipulative content',
        priority: 'recommended',
      });
    }

    // Brand alignment
    if (criteria.brandAlignmentScore < 60) {
      modifications.push({
        aspect: 'brand_review',
        currentValue: 'Automated execution',
        suggestedValue: 'Human review required for brand alignment',
        reason: 'Ensure content changes align with brand guidelines',
        priority: 'recommended',
      });
    }

    return modifications;
  }

  // ============================================================================
  // CONFIDENCE CALCULATION
  // ============================================================================

  private calculateConfidence(
    action: SEOAction,
    criteria: BrandCriteria,
    brandGuidelines: BrandGuidelines
  ): number {
    let confidence = 55; // Base confidence

    // Clear brand guidelines increase confidence
    if (brandGuidelines.tone.length > 0) {
      confidence += 10;
    }
    if (brandGuidelines.forbiddenTerms.length > 0) {
      confidence += 10;
    }

    // Clear signals increase confidence
    if (criteria.brandAlignmentScore >= 80 || criteria.brandAlignmentScore < 30) {
      confidence += 10; // Clear alignment or misalignment
    }

    // Content actions have lower confidence (need human review)
    if ([ActionType.CREATE_CONTENT, ActionType.OPTIMIZE_CONTENT, ActionType.UPDATE_CONTENT]
        .includes(action.type)) {
      confidence -= 10;
    }

    // Technical actions have higher confidence
    if ([ActionType.FIX_TECHNICAL_ISSUE, ActionType.IMPROVE_PAGE_SPEED, ActionType.FIX_SCHEMA_MARKUP]
        .includes(action.type)) {
      confidence += 10;
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

export default BrandEvaluator;
