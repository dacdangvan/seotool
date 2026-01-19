/**
 * Risk Classifier
 * 
 * v1.1 - Classifies SEO actions into LOW/MEDIUM/HIGH risk levels
 * 
 * Responsibilities:
 * - Analyze action characteristics to determine risk
 * - Calculate weighted risk score
 * - Determine auto-execution eligibility
 * - Provide explainable classification
 * 
 * Classification Factors:
 * - Action type (some types are inherently riskier)
 * - Scope of change (page-level vs site-level)
 * - Reversibility (can it be undone?)
 * - Content impact (how much content changes)
 * - Historical success rate
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import {
  RiskLevel,
  RiskClassification,
  RiskFactor,
  RISK_THRESHOLDS,
} from './models';

// Action type base risk scores (0-100)
const ACTION_TYPE_RISK_SCORES: Record<ActionType, number> = {
  // Low risk actions (10-25)
  [ActionType.OPTIMIZE_CONTENT]: 15,
  [ActionType.ADD_INTERNAL_LINK]: 20,
  [ActionType.OPTIMIZE_ANCHOR_TEXT]: 15,
  [ActionType.FIX_SCHEMA_MARKUP]: 25,
  
  // Medium risk actions (30-60)
  [ActionType.UPDATE_CONTENT]: 35,
  [ActionType.IMPROVE_PAGE_SPEED]: 40,
  [ActionType.FIX_TECHNICAL_ISSUE]: 45,
  [ActionType.IMPROVE_KEYWORD_RANKING]: 50,
  [ActionType.INVESTIGATE_ANOMALY]: 30,
  [ActionType.SET_UP_ALERT]: 25,
  
  // High risk actions (65+)
  [ActionType.CREATE_CONTENT]: 65,
  [ActionType.TARGET_NEW_KEYWORD]: 70,
};

// Risk factor weights (must sum to 1.0)
const RISK_FACTOR_WEIGHTS = {
  actionType: 0.30,
  changeScope: 0.20,
  reversibility: 0.15,
  contentImpact: 0.20,
  historicalSuccess: 0.15,
};

// Reversibility scores by action type (0 = fully reversible, 100 = irreversible)
const REVERSIBILITY_SCORES: Record<ActionType, number> = {
  [ActionType.OPTIMIZE_CONTENT]: 10,
  [ActionType.ADD_INTERNAL_LINK]: 5,
  [ActionType.OPTIMIZE_ANCHOR_TEXT]: 5,
  [ActionType.FIX_SCHEMA_MARKUP]: 15,
  [ActionType.UPDATE_CONTENT]: 20,
  [ActionType.IMPROVE_PAGE_SPEED]: 30,
  [ActionType.FIX_TECHNICAL_ISSUE]: 40,
  [ActionType.IMPROVE_KEYWORD_RANKING]: 35,
  [ActionType.INVESTIGATE_ANOMALY]: 0,
  [ActionType.SET_UP_ALERT]: 0,
  [ActionType.CREATE_CONTENT]: 50,
  [ActionType.TARGET_NEW_KEYWORD]: 45,
};

export class RiskClassifier {
  private logger: Console;
  private historicalSuccessRates: Map<ActionType, number> = new Map();

  constructor() {
    this.logger = console;
    this.initializeDefaultSuccessRates();
  }

  /**
   * Classify the risk level of an action
   */
  classify(action: SEOAction): RiskClassification {
    this.logger.log(`[RiskClassifier] Classifying action: ${action.id} (${action.type})`);

    const factors: RiskFactor[] = [];

    // Factor 1: Action Type Risk
    const actionTypeScore = this.assessActionTypeRisk(action);
    factors.push(actionTypeScore);

    // Factor 2: Change Scope
    const changeScopeScore = this.assessChangeScope(action);
    factors.push(changeScopeScore);

    // Factor 3: Reversibility
    const reversibilityScore = this.assessReversibility(action);
    factors.push(reversibilityScore);

    // Factor 4: Content Impact
    const contentImpactScore = this.assessContentImpact(action);
    factors.push(contentImpactScore);

    // Factor 5: Historical Success
    const historicalScore = this.assessHistoricalSuccess(action);
    factors.push(historicalScore);

    // Calculate weighted total score
    const totalScore = this.calculateWeightedScore(factors);

    // Determine risk level based on thresholds
    const level = this.scoreToRiskLevel(totalScore);

    // Determine if auto-executable (only LOW risk)
    const autoExecutable = level === RiskLevel.LOW;

    // Generate explanation
    const explanation = this.generateExplanation(action, factors, totalScore, level);

    const classification: RiskClassification = {
      actionId: action.id,
      level,
      score: Math.round(totalScore),
      factors,
      explanation,
      autoExecutable,
      classifiedAt: new Date().toISOString(),
    };

    this.logger.log(
      `[RiskClassifier] Classification complete: ${level.toUpperCase()} (score: ${Math.round(totalScore)}, auto-executable: ${autoExecutable})`
    );

    return classification;
  }

  /**
   * Batch classify multiple actions
   */
  classifyBatch(actions: SEOAction[]): RiskClassification[] {
    return actions.map(action => this.classify(action));
  }

  /**
   * Check if an action is auto-executable based on classification
   */
  isAutoExecutable(classification: RiskClassification): boolean {
    return classification.autoExecutable && classification.level === RiskLevel.LOW;
  }

  /**
   * Update historical success rate for learning
   */
  updateSuccessRate(actionType: ActionType, success: boolean): void {
    const currentRate = this.historicalSuccessRates.get(actionType) || 0.5;
    // Exponential moving average with alpha = 0.1
    const newRate = currentRate * 0.9 + (success ? 1 : 0) * 0.1;
    this.historicalSuccessRates.set(actionType, newRate);
    
    this.logger.log(
      `[RiskClassifier] Updated success rate for ${actionType}: ${(newRate * 100).toFixed(1)}%`
    );
  }

  // ============================================================================
  // RISK FACTOR ASSESSMENTS
  // ============================================================================

  private assessActionTypeRisk(action: SEOAction): RiskFactor {
    const score = ACTION_TYPE_RISK_SCORES[action.type] || 50;
    
    return {
      name: 'actionType',
      weight: RISK_FACTOR_WEIGHTS.actionType,
      score,
      reason: `Action type "${action.type}" has base risk score of ${score}`,
    };
  }

  private assessChangeScope(action: SEOAction): RiskFactor {
    let score = 20; // Default: single page change
    let reason = 'Single page change';

    // Check for site-wide indicators
    const siteWidePatterns = [
      /site.?wide/i,
      /all pages/i,
      /entire site/i,
      /global/i,
      /template/i,
    ];

    const isSiteWide = siteWidePatterns.some(
      pattern => pattern.test(action.title) || pattern.test(action.description)
    );

    if (isSiteWide) {
      score = 80;
      reason = 'Site-wide change detected';
    } else if (action.category === 'technical') {
      score = 50;
      reason = 'Technical change may have broader impact';
    } else if (!action.targetUrl) {
      score = 40;
      reason = 'No specific target URL specified';
    }

    return {
      name: 'changeScope',
      weight: RISK_FACTOR_WEIGHTS.changeScope,
      score,
      reason,
    };
  }

  private assessReversibility(action: SEOAction): RiskFactor {
    const baseScore = REVERSIBILITY_SCORES[action.type] || 50;
    let score = baseScore;
    let reason = `Base reversibility for ${action.type}`;

    // Adjust based on action specifics
    if (action.category === 'content') {
      score = Math.max(score - 10, 0); // Content is more reversible
      reason = 'Content changes are easily reversible';
    }

    if (action.type === ActionType.CREATE_CONTENT) {
      score = Math.min(score + 20, 100); // New content is harder to "unreate"
      reason = 'New content creation is less reversible';
    }

    return {
      name: 'reversibility',
      weight: RISK_FACTOR_WEIGHTS.reversibility,
      score,
      reason,
    };
  }

  private assessContentImpact(action: SEOAction): RiskFactor {
    let score = 30; // Default moderate impact
    let reason = 'Moderate content impact expected';

    // Estimate based on action type
    switch (action.type) {
      case ActionType.OPTIMIZE_CONTENT:
        score = 20;
        reason = 'Minor content optimization';
        break;
      case ActionType.ADD_INTERNAL_LINK:
        score = 15;
        reason = 'Adding links is low impact';
        break;
      case ActionType.UPDATE_CONTENT:
        score = 45;
        reason = 'Content update may significantly change page';
        break;
      case ActionType.CREATE_CONTENT:
        score = 60;
        reason = 'New content creation has high impact';
        break;
      case ActionType.FIX_SCHEMA_MARKUP:
        score = 25;
        reason = 'Schema changes have targeted impact';
        break;
    }

    // Check estimated change in action
    if (action.expectedImpact.estimatedChange > 20) {
      score = Math.min(score + 15, 100);
      reason += ` (high expected change: ${action.expectedImpact.estimatedChange}%)`;
    }

    return {
      name: 'contentImpact',
      weight: RISK_FACTOR_WEIGHTS.contentImpact,
      score,
      reason,
    };
  }

  private assessHistoricalSuccess(action: SEOAction): RiskFactor {
    const successRate = this.historicalSuccessRates.get(action.type) || 0.5;
    
    // Convert success rate to risk score (higher success = lower risk)
    const score = Math.round((1 - successRate) * 100);
    
    return {
      name: 'historicalSuccess',
      weight: RISK_FACTOR_WEIGHTS.historicalSuccess,
      score,
      reason: `Historical success rate: ${(successRate * 100).toFixed(1)}%`,
    };
  }

  // ============================================================================
  // CALCULATION HELPERS
  // ============================================================================

  private calculateWeightedScore(factors: RiskFactor[]): number {
    return factors.reduce((total, factor) => {
      return total + factor.score * factor.weight;
    }, 0);
  }

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score <= RISK_THRESHOLDS.LOW_MAX) {
      return RiskLevel.LOW;
    } else if (score <= RISK_THRESHOLDS.MEDIUM_MAX) {
      return RiskLevel.MEDIUM;
    } else {
      return RiskLevel.HIGH;
    }
  }

  private generateExplanation(
    action: SEOAction,
    factors: RiskFactor[],
    totalScore: number,
    level: RiskLevel
  ): string {
    const topFactors = [...factors]
      .sort((a, b) => b.score * b.weight - a.score * a.weight)
      .slice(0, 3);

    const factorSummary = topFactors
      .map(f => `${f.name}: ${f.reason}`)
      .join('; ');

    return `Action "${action.title}" classified as ${level.toUpperCase()} risk (score: ${Math.round(totalScore)}/100). ` +
      `Key factors: ${factorSummary}. ` +
      `Auto-execution: ${level === RiskLevel.LOW ? 'ELIGIBLE' : 'NOT ELIGIBLE'}.`;
  }

  private initializeDefaultSuccessRates(): void {
    // Initialize with reasonable defaults based on action type
    this.historicalSuccessRates.set(ActionType.OPTIMIZE_CONTENT, 0.85);
    this.historicalSuccessRates.set(ActionType.ADD_INTERNAL_LINK, 0.90);
    this.historicalSuccessRates.set(ActionType.OPTIMIZE_ANCHOR_TEXT, 0.88);
    this.historicalSuccessRates.set(ActionType.FIX_SCHEMA_MARKUP, 0.80);
    this.historicalSuccessRates.set(ActionType.UPDATE_CONTENT, 0.75);
    this.historicalSuccessRates.set(ActionType.IMPROVE_PAGE_SPEED, 0.70);
    this.historicalSuccessRates.set(ActionType.FIX_TECHNICAL_ISSUE, 0.65);
    this.historicalSuccessRates.set(ActionType.CREATE_CONTENT, 0.60);
    this.historicalSuccessRates.set(ActionType.TARGET_NEW_KEYWORD, 0.55);
    this.historicalSuccessRates.set(ActionType.IMPROVE_KEYWORD_RANKING, 0.60);
    this.historicalSuccessRates.set(ActionType.INVESTIGATE_ANOMALY, 0.85);
    this.historicalSuccessRates.set(ActionType.SET_UP_ALERT, 0.95);
  }

  /**
   * Get risk classification summary for reporting
   */
  getClassificationSummary(classifications: RiskClassification[]): {
    total: number;
    byLevel: Record<RiskLevel, number>;
    autoExecutable: number;
    avgScore: number;
  } {
    const summary = {
      total: classifications.length,
      byLevel: {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 0,
      },
      autoExecutable: 0,
      avgScore: 0,
    };

    let totalScore = 0;

    for (const c of classifications) {
      summary.byLevel[c.level]++;
      if (c.autoExecutable) summary.autoExecutable++;
      totalScore += c.score;
    }

    summary.avgScore = classifications.length > 0 
      ? Math.round(totalScore / classifications.length) 
      : 0;

    return summary;
  }
}

export default RiskClassifier;
