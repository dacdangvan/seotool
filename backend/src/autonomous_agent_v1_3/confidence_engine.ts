/**
 * Confidence Engine v1.3
 * 
 * Calculates confidence scores for SEO actions based on multiple factors:
 * - Data freshness & completeness
 * - Multi-agent debate consensus strength
 * - Historical success rate of similar actions
 * - Action scope size
 * - Policy safety margin
 * 
 * Design Principles:
 * - Deterministic scoring (same inputs → same output)
 * - Explainable calculation (full breakdown provided)
 * - No hidden weighting (all weights visible in config)
 * - No ML/black-box models
 */

import {
  ConfidenceScore,
  ConfidenceFactors,
  ConfidenceWeights,
  ConfidenceBreakdown,
  DEFAULT_CONFIDENCE_WEIGHTS,
  DataQualityInput,
  DataQualityResult,
  ConsensusInput,
  ConsensusResult,
  HistoricalInput,
  HistoricalResult,
  ScopeInput,
  ScopeResult,
  SafetyInput,
  SafetyResult,
  ActionOutcome,
  CalibrationRule,
  CalibrationAdjustment,
  V13ConfidenceConfig,
  DEFAULT_V13_CONFIDENCE_CONFIG,
} from './models_v2';
import { AgentPosition } from '../debate_engine/models';

const ALGORITHM_VERSION = '1.3.0';

// ============================================================================
// DATA QUALITY EVALUATOR
// ============================================================================

export class DataConfidenceEvaluator {
  private maxFreshnessHours: number;
  
  constructor(maxFreshnessHours: number = 24) {
    this.maxFreshnessHours = maxFreshnessHours;
  }
  
  /**
   * Evaluate data quality confidence factor
   */
  evaluate(input: DataQualityInput): DataQualityResult {
    // Freshness: Linear decay from 1.0 to 0.0 over maxFreshnessHours
    const freshnessScore = Math.max(0, 1 - (input.dataAgeHours / this.maxFreshnessHours));
    
    // Completeness: Direct mapping from percentage
    const completenessScore = input.completenessPercent / 100;
    
    // Source reliability: More sources = more reliable (diminishing returns)
    // 1 source = 0.5, 2 sources = 0.75, 3+ sources = 0.9+
    const sourceScore = Math.min(1, 0.3 + (input.sourceCount * 0.25));
    
    // Validation bonus
    const validationScore = input.validated ? 1.0 : 0.7;
    
    // Issue penalty: Each known issue reduces score
    const issuePenalty = Math.min(0.5, input.knownIssues.length * 0.1);
    
    // Weighted combination
    const rawScore = (
      freshnessScore * 0.30 +
      completenessScore * 0.30 +
      sourceScore * 0.20 +
      validationScore * 0.20
    ) - issuePenalty;
    
    const score = Math.max(0, Math.min(1, rawScore));
    
    return {
      score,
      freshness: {
        score: freshnessScore,
        ageHours: input.dataAgeHours,
        maxAcceptableHours: this.maxFreshnessHours,
      },
      completeness: {
        score: completenessScore,
        percent: input.completenessPercent,
      },
      sourceReliability: {
        score: sourceScore,
        sourceCount: input.sourceCount,
      },
      validation: {
        score: validationScore,
        validated: input.validated,
      },
      issues: input.knownIssues,
      explanation: this.buildExplanation(score, freshnessScore, completenessScore, sourceScore, input),
    };
  }
  
  private buildExplanation(
    score: number,
    freshness: number,
    completeness: number,
    source: number,
    input: DataQualityInput
  ): string {
    const parts: string[] = [];
    
    if (freshness < 0.5) {
      parts.push(`Data is ${input.dataAgeHours}h old (stale)`);
    } else if (freshness >= 0.9) {
      parts.push(`Data is fresh (${input.dataAgeHours}h old)`);
    }
    
    if (completeness < 0.7) {
      parts.push(`Data only ${input.completenessPercent}% complete`);
    }
    
    if (source < 0.6) {
      parts.push(`Only ${input.sourceCount} data source(s)`);
    }
    
    if (input.knownIssues.length > 0) {
      parts.push(`${input.knownIssues.length} known data issue(s)`);
    }
    
    if (parts.length === 0) {
      return `Data quality is good (${(score * 100).toFixed(0)}%)`;
    }
    
    return `Data quality at ${(score * 100).toFixed(0)}%: ${parts.join('; ')}`;
  }
}

// ============================================================================
// CONSENSUS EVALUATOR
// ============================================================================

export class ConsensusEvaluator {
  /**
   * Evaluate multi-agent debate consensus strength
   */
  evaluate(input: ConsensusInput): ConsensusResult {
    const positions = Object.values(input.agentPositions);
    const confidences = Object.values(input.agentConfidences);
    
    // Unanimity: All agents agree
    const allAgree = positions.every(p => p === positions[0]);
    const unanimityScore = allAgree ? 1.0 : this.calculatePositionAlignment(positions);
    
    // Confidence alignment: Low spread = high score
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const maxConfidence = Math.max(...confidences);
    const minConfidence = Math.min(...confidences);
    const spread = maxConfidence - minConfidence;
    const alignmentScore = Math.max(0, 1 - (spread / 100)) * (avgConfidence / 100);
    
    // Critical conflict penalty
    const conflictPenalty = input.hasCriticalConflicts ? 0.3 : 0;
    
    // Combined score
    const rawScore = (unanimityScore * 0.5 + alignmentScore * 0.5) - conflictPenalty;
    const score = Math.max(0, Math.min(1, rawScore));
    
    return {
      score,
      unanimity: {
        score: unanimityScore,
        allAgree,
      },
      confidenceAlignment: {
        score: alignmentScore,
        spread,
      },
      conflictPenalty: {
        penalty: conflictPenalty,
        hasCritical: input.hasCriticalConflicts,
      },
      explanation: this.buildExplanation(score, allAgree, spread, input.hasCriticalConflicts),
    };
  }
  
  private calculatePositionAlignment(positions: AgentPosition[]): number {
    // Count position frequencies
    const counts: Record<string, number> = {};
    for (const p of positions) {
      counts[p] = (counts[p] || 0) + 1;
    }
    
    // Majority agreement
    const maxCount = Math.max(...Object.values(counts));
    const majorityPercent = maxCount / positions.length;
    
    // If majority supports, score higher
    // If majority opposes, also score higher (clear signal)
    // Mixed signals = lower score
    return majorityPercent;
  }
  
  private buildExplanation(
    score: number,
    allAgree: boolean,
    spread: number,
    hasCritical: boolean
  ): string {
    const parts: string[] = [];
    
    if (allAgree) {
      parts.push('All agents agree');
    } else {
      parts.push('Agents have differing positions');
    }
    
    if (spread > 30) {
      parts.push(`high confidence spread (${spread.toFixed(0)}%)`);
    }
    
    if (hasCritical) {
      parts.push('CRITICAL conflict detected');
    }
    
    return `Consensus strength ${(score * 100).toFixed(0)}%: ${parts.join('; ')}`;
  }
}

// ============================================================================
// HISTORY EVALUATOR
// ============================================================================

export class HistoryEvaluator {
  private minSampleSize: number;
  
  constructor(minSampleSize: number = 10) {
    this.minSampleSize = minSampleSize;
  }
  
  /**
   * Evaluate historical success rate for similar actions
   */
  evaluate(input: HistoricalInput): HistoricalResult {
    const { similarActions, minSampleSize } = input;
    const effectiveMinSample = minSampleSize || this.minSampleSize;
    
    // Check sample size
    if (similarActions.length < effectiveMinSample) {
      return {
        score: 0.5, // Neutral when insufficient data
        sampleSize: similarActions.length,
        successRate: 0,
        neutralRate: 0,
        negativeRate: 0,
        confidence: 'insufficient_data',
        explanation: `Only ${similarActions.length} similar actions found (need ${effectiveMinSample} for reliable stats)`,
      };
    }
    
    // Calculate outcome rates
    const total = similarActions.length;
    const successCount = similarActions.filter(a => a.outcome === ActionOutcome.SUCCESS).length;
    const neutralCount = similarActions.filter(a => a.outcome === ActionOutcome.NEUTRAL).length;
    const negativeCount = similarActions.filter(a => a.outcome === ActionOutcome.NEGATIVE).length;
    
    const successRate = successCount / total;
    const neutralRate = neutralCount / total;
    const negativeRate = negativeCount / total;
    
    // Score: Weight success positively, negative negatively
    // Success = 1.0, Neutral = 0.5, Negative = 0.0
    const weightedScore = (successRate * 1.0) + (neutralRate * 0.5) + (negativeRate * 0.0);
    
    // Apply negative rate penalty
    const negativePenalty = negativeRate > 0.2 ? (negativeRate - 0.2) : 0;
    const score = Math.max(0, Math.min(1, weightedScore - negativePenalty));
    
    // Confidence in the stats
    const statsConfidence = total >= effectiveMinSample * 3 ? 'high' 
      : total >= effectiveMinSample ? 'medium' 
      : 'low';
    
    return {
      score,
      sampleSize: total,
      successRate,
      neutralRate,
      negativeRate,
      confidence: statsConfidence,
      explanation: this.buildExplanation(score, successRate, negativeRate, total),
    };
  }
  
  private buildExplanation(
    score: number,
    successRate: number,
    negativeRate: number,
    sampleSize: number
  ): string {
    const successPct = (successRate * 100).toFixed(0);
    const negativePct = (negativeRate * 100).toFixed(0);
    
    if (negativeRate > 0.2) {
      return `Historical success ${successPct}% with ${negativePct}% negative outcomes (n=${sampleSize}) - HIGH CAUTION`;
    }
    
    if (successRate > 0.8) {
      return `Strong track record: ${successPct}% success rate (n=${sampleSize})`;
    }
    
    return `Historical success ${successPct}%, negative ${negativePct}% (n=${sampleSize})`;
  }
}

// ============================================================================
// SCOPE EVALUATOR
// ============================================================================

export class ScopeEvaluator {
  /**
   * Evaluate action scope size
   * Smaller scope = higher confidence
   */
  evaluate(input: ScopeInput): ScopeResult {
    // Coverage: Percentage of site affected
    const coveragePercent = input.totalSitePages > 0 
      ? (input.pagesAffected / input.totalSitePages) * 100 
      : 100;
    
    // Inverse relationship: More coverage = lower score
    // 0% coverage = 1.0, 10% = 0.8, 50% = 0.4, 100% = 0.0
    const coverageScore = Math.max(0, 1 - (coveragePercent / 100));
    
    // Change size: Smaller changes = higher confidence
    // 0% change = 1.0, 10% = 0.8, 50% = 0.4, 100% = 0.0
    const changeSizeScore = Math.max(0, 1 - (input.contentChangePercent / 100));
    
    // Reversibility bonus
    const reversibilityScore = input.reversible ? 1.0 : 0.5;
    
    // Scope type modifier
    const scopeModifier: Record<string, number> = {
      'single_element': 1.0,
      'single_page': 0.9,
      'multiple_pages': 0.6,
      'site_wide': 0.2,
    };
    const typeScore = scopeModifier[input.scopeType] || 0.5;
    
    // Combined score
    const score = (
      coverageScore * 0.3 +
      changeSizeScore * 0.3 +
      reversibilityScore * 0.2 +
      typeScore * 0.2
    );
    
    return {
      score,
      coverage: {
        score: coverageScore,
        percent: coveragePercent,
      },
      changeSize: {
        score: changeSizeScore,
        percent: input.contentChangePercent,
      },
      reversibility: {
        score: reversibilityScore,
        reversible: input.reversible,
      },
      explanation: this.buildExplanation(score, coveragePercent, input),
    };
  }
  
  private buildExplanation(
    score: number,
    coveragePercent: number,
    input: ScopeInput
  ): string {
    const parts: string[] = [];
    
    parts.push(`Scope: ${input.scopeType.replace('_', ' ')}`);
    parts.push(`${input.pagesAffected} page(s) affected`);
    
    if (coveragePercent > 10) {
      parts.push(`${coveragePercent.toFixed(1)}% of site`);
    }
    
    if (input.contentChangePercent > 20) {
      parts.push(`${input.contentChangePercent}% content change`);
    }
    
    if (!input.reversible) {
      parts.push('NOT REVERSIBLE');
    }
    
    return `Scope confidence ${(score * 100).toFixed(0)}%: ${parts.join(', ')}`;
  }
}

// ============================================================================
// SAFETY EVALUATOR
// ============================================================================

export class SafetyEvaluator {
  /**
   * Evaluate safety margin from policy limits
   */
  evaluate(input: SafetyInput): SafetyResult {
    // Risk buffer: Distance from max allowed risk
    const riskBuffer = (input.policyMaxRisk - input.riskScore) / input.policyMaxRisk;
    const riskBufferScore = Math.max(0, Math.min(1, riskBuffer));
    
    // Policy compliance
    const complianceScore = input.respectsPolicyLimits ? 1.0 : 0.0;
    
    // Analyze individual policy margins
    const marginScores = input.policyMargins.map(m => {
      // Higher margin percentage = better
      return Math.min(1, m.marginPercent / 50); // 50% margin = full score
    });
    
    const avgMarginScore = marginScores.length > 0 
      ? marginScores.reduce((a, b) => a + b, 0) / marginScores.length 
      : 0.5;
    
    // Combined score
    const score = complianceScore > 0 
      ? (riskBufferScore * 0.4 + avgMarginScore * 0.4 + complianceScore * 0.2)
      : 0; // Non-compliant = 0 safety score
    
    return {
      score,
      riskBuffer: {
        score: riskBufferScore,
        buffer: input.policyMaxRisk - input.riskScore,
      },
      policyCompliance: {
        score: complianceScore,
        compliant: input.respectsPolicyLimits,
      },
      marginAnalysis: input.policyMargins,
      explanation: this.buildExplanation(score, input),
    };
  }
  
  private buildExplanation(score: number, input: SafetyInput): string {
    if (!input.respectsPolicyLimits) {
      return 'SAFETY VIOLATION: Does not respect policy limits';
    }
    
    const buffer = input.policyMaxRisk - input.riskScore;
    
    if (buffer < 10) {
      return `Safety margin thin: ${buffer} points from limit`;
    }
    
    if (buffer > 30) {
      return `Good safety margin: ${buffer} points from limit`;
    }
    
    return `Safety margin ${(score * 100).toFixed(0)}%: ${buffer} points from limit`;
  }
}

// ============================================================================
// MAIN CONFIDENCE ENGINE
// ============================================================================

export interface ConfidenceEngineInput {
  dataQuality: DataQualityInput;
  consensus: ConsensusInput;
  history: HistoricalInput;
  scope: ScopeInput;
  safety: SafetyInput;
}

export class ConfidenceEngine {
  private dataEvaluator: DataConfidenceEvaluator;
  private consensusEvaluator: ConsensusEvaluator;
  private historyEvaluator: HistoryEvaluator;
  private scopeEvaluator: ScopeEvaluator;
  private safetyEvaluator: SafetyEvaluator;
  private weights: ConfidenceWeights;
  private calibrationRules: CalibrationRule[];
  
  constructor(config?: Partial<V13ConfidenceConfig>) {
    const effectiveConfig = { ...DEFAULT_V13_CONFIDENCE_CONFIG, ...config };
    
    this.dataEvaluator = new DataConfidenceEvaluator(effectiveConfig.dataFreshnessMaxHours);
    this.consensusEvaluator = new ConsensusEvaluator();
    this.historyEvaluator = new HistoryEvaluator(effectiveConfig.minHistorySampleSize);
    this.scopeEvaluator = new ScopeEvaluator();
    this.safetyEvaluator = new SafetyEvaluator();
    this.weights = effectiveConfig.weights;
    this.calibrationRules = effectiveConfig.calibrationRules;
  }
  
  /**
   * Calculate confidence score for an action
   */
  calculate(input: ConfidenceEngineInput): ConfidenceScore {
    // Evaluate each factor
    const dataResult = this.dataEvaluator.evaluate(input.dataQuality);
    const consensusResult = this.consensusEvaluator.evaluate(input.consensus);
    const historyResult = this.historyEvaluator.evaluate(input.history);
    const scopeResult = this.scopeEvaluator.evaluate(input.scope);
    const safetyResult = this.safetyEvaluator.evaluate(input.safety);
    
    // Build factors object
    const factors: ConfidenceFactors = {
      dataQuality: dataResult.score,
      consensusStrength: consensusResult.score,
      historicalSuccess: historyResult.score,
      scopeConfidence: scopeResult.score,
      safetyMargin: safetyResult.score,
    };
    
    // Calculate weighted score
    const breakdown: ConfidenceBreakdown[] = [
      {
        factor: 'dataQuality',
        rawScore: factors.dataQuality,
        weight: this.weights.dataQuality,
        weightedScore: factors.dataQuality * this.weights.dataQuality,
        explanation: dataResult.explanation,
        evidence: dataResult.issues,
      },
      {
        factor: 'consensusStrength',
        rawScore: factors.consensusStrength,
        weight: this.weights.consensusStrength,
        weightedScore: factors.consensusStrength * this.weights.consensusStrength,
        explanation: consensusResult.explanation,
        evidence: [],
      },
      {
        factor: 'historicalSuccess',
        rawScore: factors.historicalSuccess,
        weight: this.weights.historicalSuccess,
        weightedScore: factors.historicalSuccess * this.weights.historicalSuccess,
        explanation: historyResult.explanation,
        evidence: [`Sample size: ${historyResult.sampleSize}`, `Confidence: ${historyResult.confidence}`],
      },
      {
        factor: 'scopeConfidence',
        rawScore: factors.scopeConfidence,
        weight: this.weights.scopeConfidence,
        weightedScore: factors.scopeConfidence * this.weights.scopeConfidence,
        explanation: scopeResult.explanation,
        evidence: [],
      },
      {
        factor: 'safetyMargin',
        rawScore: factors.safetyMargin,
        weight: this.weights.safetyMargin,
        weightedScore: factors.safetyMargin * this.weights.safetyMargin,
        explanation: safetyResult.explanation,
        evidence: safetyResult.marginAnalysis.map(m => `${m.policyName}: ${m.marginPercent}% margin`),
      },
    ];
    
    // Sum weighted scores
    let overall = breakdown.reduce((sum, b) => sum + b.weightedScore, 0);
    
    // Apply calibration rules
    overall = this.applyCalibration(overall, factors, input);
    
    // Clamp to [0, 1]
    overall = Math.max(0, Math.min(1, overall));
    
    return {
      overall,
      factors,
      weights: this.weights,
      breakdown,
      calculatedAt: new Date().toISOString(),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }
  
  /**
   * Apply calibration rules to adjust score
   */
  private applyCalibration(
    score: number,
    factors: ConfidenceFactors,
    input: ConfidenceEngineInput
  ): number {
    let adjustedScore = score;
    
    for (const rule of this.calibrationRules) {
      if (!rule.enabled) continue;
      
      // Check if condition matches
      if (!this.matchesCondition(rule.condition, input)) continue;
      
      // Apply adjustment
      adjustedScore = this.applyAdjustment(adjustedScore, factors, rule.adjustment);
    }
    
    return adjustedScore;
  }
  
  private matchesCondition(
    condition: CalibrationRule['condition'],
    input: ConfidenceEngineInput
  ): boolean {
    // Check action type
    if (condition.actionType !== 'any' && 
        condition.actionType !== input.history.actionType) {
      return false;
    }
    
    // Check risk level
    if (condition.riskLevel !== 'any' && 
        condition.riskLevel !== input.history.riskLevel) {
      return false;
    }
    
    // Check sample size
    if (input.history.similarActions.length < condition.minSampleSize) {
      return false;
    }
    
    // Check outcome pattern
    const successRate = input.history.similarActions.filter(
      a => a.outcome === ActionOutcome.SUCCESS
    ).length / input.history.similarActions.length;
    
    const negativeRate = input.history.similarActions.filter(
      a => a.outcome === ActionOutcome.NEGATIVE
    ).length / input.history.similarActions.length;
    
    if (condition.outcomePattern.successRateBelow !== undefined && 
        successRate >= condition.outcomePattern.successRateBelow) {
      return false;
    }
    
    if (condition.outcomePattern.successRateAbove !== undefined && 
        successRate <= condition.outcomePattern.successRateAbove) {
      return false;
    }
    
    if (condition.outcomePattern.negativeRateBelow !== undefined && 
        negativeRate >= condition.outcomePattern.negativeRateBelow) {
      return false;
    }
    
    if (condition.outcomePattern.negativeRateAbove !== undefined && 
        negativeRate <= condition.outcomePattern.negativeRateAbove) {
      return false;
    }
    
    return true;
  }
  
  private applyAdjustment(
    score: number,
    factors: ConfidenceFactors,
    adjustment: CalibrationAdjustment
  ): number {
    const target = adjustment.targetFactor === 'overall' 
      ? score 
      : factors[adjustment.targetFactor];
    
    let newValue: number;
    
    switch (adjustment.type) {
      case 'multiply':
        newValue = target * adjustment.value;
        break;
      case 'add':
        newValue = target + adjustment.value;
        break;
      case 'cap':
        newValue = Math.min(target, adjustment.value);
        break;
      default:
        newValue = target;
    }
    
    // If adjusting a factor, recalculate overall
    if (adjustment.targetFactor !== 'overall') {
      const weightKey = adjustment.targetFactor as keyof ConfidenceWeights;
      const oldContribution = factors[adjustment.targetFactor] * this.weights[weightKey];
      const newContribution = newValue * this.weights[weightKey];
      return score - oldContribution + newContribution;
    }
    
    return newValue;
  }
  
  /**
   * Update weights (for configuration changes)
   */
  setWeights(weights: ConfidenceWeights): void {
    // Validate weights sum to ~1.0
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(`Weights must sum to 1.0, got ${sum}`);
    }
    this.weights = weights;
  }
  
  /**
   * Add a calibration rule
   */
  addCalibrationRule(rule: CalibrationRule): void {
    this.calibrationRules.push(rule);
  }
  
  /**
   * Get current weights
   */
  getWeights(): ConfidenceWeights {
    return { ...this.weights };
  }
}
