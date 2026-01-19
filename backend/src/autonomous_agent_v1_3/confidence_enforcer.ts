/**
 * Confidence Enforcer
 * 
 * Enforces minimum confidence thresholds and applies confidence weighting.
 * 
 * Addresses v1.2 flaws:
 * - "minimumConfidence defined but NOT enforced"
 * - "unanimityBonus defined but NOT applied"
 * - "Asymmetric score mapping biased toward approval"
 * 
 * v1.3 Solutions:
 * - Enforce minimum average confidence (default 60%)
 * - Apply unanimity bonus when all agents agree
 * - Symmetric scoring: SUPPORT +100, MODIFY 0, OPPOSE -100
 */

import {
  ConfidenceWeightedVote,
  ConfidenceWeightedResult,
  SYMMETRIC_POSITION_SCORES,
  AgentRole,
  AgentPosition,
} from './models';
import { AgentEvaluation, VotingWeights, DEFAULT_VOTING_WEIGHTS } from '../debate_engine/models';
import { RiskClassification } from '../autonomous_agent_v1_1/models';
import { ActionType } from '../autonomous_agent/models';

const DEFAULT_MIN_CONFIDENCE = 60;
const DEFAULT_UNANIMITY_BONUS = 10;
const HIGH_CONFIDENCE_THRESHOLD = 70;
const LOW_CONFIDENCE_THRESHOLD = 50;

// Type for weights that may or may not have projectId
type WeightsConfig = Omit<VotingWeights, 'projectId'> | VotingWeights;

/**
 * Calculate confidence-weighted votes from evaluations
 */
export function calculateConfidenceWeightedVotes(
  evaluations: AgentEvaluation[],
  weights: WeightsConfig = DEFAULT_VOTING_WEIGHTS,
  riskClassification?: RiskClassification,
  actionType?: ActionType
): ConfidenceWeightedVote[] {
  // Get applicable weights (with modifiers for action type and risk level)
  const effectiveWeights = getEffectiveWeights(weights, riskClassification, actionType);
  
  // Calculate total effective weight for contribution percentages
  let totalEffectiveWeight = 0;
  
  const votes: ConfidenceWeightedVote[] = evaluations.map(evaluation => {
    const baseWeight = effectiveWeights[evaluation.agentRole] || 0;
    
    // Effective weight = base weight × (confidence / 100)
    // This means low-confidence votes have less impact
    const effectiveWeight = baseWeight * (evaluation.confidence / 100);
    
    // Raw score from symmetric mapping
    const rawScore = SYMMETRIC_POSITION_SCORES[evaluation.position];
    
    // Weighted score = raw score × effective weight
    const weightedScore = rawScore * effectiveWeight;
    
    totalEffectiveWeight += effectiveWeight;
    
    return {
      agentRole: evaluation.agentRole,
      position: evaluation.position,
      rawScore,
      confidence: evaluation.confidence,
      baseWeight,
      effectiveWeight,
      weightedScore,
      contributionPercent: 0, // Will be calculated after
    };
  });
  
  // Calculate contribution percentages
  return votes.map(vote => ({
    ...vote,
    contributionPercent: totalEffectiveWeight > 0 
      ? (vote.effectiveWeight / totalEffectiveWeight) * 100 
      : 0,
  }));
}

/**
 * Get effective weights with modifiers applied
 */
function getEffectiveWeights(
  weights: WeightsConfig,
  riskClassification?: RiskClassification,
  actionType?: ActionType
): Record<AgentRole, number> {
  const result = { ...weights.baseWeights };
  
  // Apply action type modifiers
  if (actionType && weights.actionTypeModifiers[actionType]) {
    const modifiers = weights.actionTypeModifiers[actionType]!;
    for (const role of Object.keys(modifiers) as AgentRole[]) {
      result[role] = (result[role] || 0) + (modifiers[role] || 0);
    }
  }
  
  // Apply risk level modifiers
  if (riskClassification) {
    const modifiers = weights.riskLevelModifiers[riskClassification.level];
    if (modifiers) {
      for (const role of Object.keys(modifiers) as AgentRole[]) {
        result[role] = (result[role] || 0) + (modifiers[role] || 0);
      }
    }
  }
  
  // Normalize weights to sum to 1.0
  const total = Object.values(result).reduce((sum, w) => sum + w, 0);
  if (total > 0) {
    for (const role of Object.keys(result) as AgentRole[]) {
      result[role] = result[role] / total;
    }
  }
  
  return result;
}

/**
 * Calculate the final confidence-weighted result
 */
export function calculateConfidenceWeightedResult(
  evaluations: AgentEvaluation[],
  weights: WeightsConfig = DEFAULT_VOTING_WEIGHTS,
  riskClassification?: RiskClassification,
  actionType?: ActionType
): ConfidenceWeightedResult {
  const votes = calculateConfidenceWeightedVotes(
    evaluations, 
    weights, 
    riskClassification, 
    actionType
  );
  
  // Calculate totals
  const totalEffectiveWeight = votes.reduce((sum, v) => sum + v.effectiveWeight, 0);
  const totalWeightedScore = votes.reduce((sum, v) => sum + v.weightedScore, 0);
  
  // Final score is weighted average: sum of weighted scores / total effective weight
  const finalScore = totalEffectiveWeight > 0 
    ? totalWeightedScore / totalEffectiveWeight 
    : 0;
  
  // Position counts
  const supportCount = votes.filter(v => v.position === AgentPosition.SUPPORT).length;
  const opposeCount = votes.filter(v => v.position === AgentPosition.OPPOSE).length;
  const modifyCount = votes.filter(v => v.position === AgentPosition.MODIFY).length;
  
  // Confidence analysis
  const confidences = votes.map(v => v.confidence);
  const averageConfidence = confidences.length > 0 
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
    : 0;
  const highConfidenceVotes = votes.filter(v => v.confidence >= HIGH_CONFIDENCE_THRESHOLD).length;
  const lowConfidenceVotes = votes.filter(v => v.confidence < LOW_CONFIDENCE_THRESHOLD).length;
  const confidenceSpread = confidences.length > 0 
    ? Math.max(...confidences) - Math.min(...confidences) 
    : 0;
  
  return {
    votes,
    finalScore,
    totalEffectiveWeight,
    averageConfidence,
    supportCount,
    opposeCount,
    modifyCount,
    highConfidenceVotes,
    lowConfidenceVotes,
    confidenceSpread,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Apply unanimity bonus to final score
 */
export function applyUnanimityBonus(
  result: ConfidenceWeightedResult,
  bonus: number = DEFAULT_UNANIMITY_BONUS
): { adjustedScore: number; bonusApplied: boolean; reason?: string } {
  // Check if all agents have the same position
  const positions = new Set(result.votes.map(v => v.position));
  
  if (positions.size === 1) {
    const position = result.votes[0]?.position;
    
    // Apply bonus in the direction of the unanimous decision
    if (position === AgentPosition.SUPPORT) {
      return {
        adjustedScore: Math.min(100, result.finalScore + bonus),
        bonusApplied: true,
        reason: `Unanimity bonus +${bonus}: All agents SUPPORT`,
      };
    } else if (position === AgentPosition.OPPOSE) {
      return {
        adjustedScore: Math.max(-100, result.finalScore - bonus),
        bonusApplied: true,
        reason: `Unanimity bonus -${bonus}: All agents OPPOSE`,
      };
    }
    // No bonus for unanimous MODIFY (neutral position)
  }
  
  return {
    adjustedScore: result.finalScore,
    bonusApplied: false,
  };
}

/**
 * Check if minimum confidence threshold is met
 */
export function checkMinimumConfidence(
  result: ConfidenceWeightedResult,
  minimumRequired: number = DEFAULT_MIN_CONFIDENCE
): { passed: boolean; averageConfidence: number; deficit?: number; explanation: string } {
  const passed = result.averageConfidence >= minimumRequired;
  
  if (passed) {
    return {
      passed: true,
      averageConfidence: result.averageConfidence,
      explanation: `Average confidence ${result.averageConfidence.toFixed(1)}% meets minimum ${minimumRequired}%`,
    };
  }
  
  return {
    passed: false,
    averageConfidence: result.averageConfidence,
    deficit: minimumRequired - result.averageConfidence,
    explanation: `Average confidence ${result.averageConfidence.toFixed(1)}% below minimum ${minimumRequired}% (deficit: ${(minimumRequired - result.averageConfidence).toFixed(1)}%)`,
  };
}

/**
 * Explain confidence-weighted calculation
 */
export function explainConfidenceWeighting(result: ConfidenceWeightedResult): string {
  let explanation = '## Confidence-Weighted Calculation\n\n';
  
  explanation += '### Individual Votes\n';
  for (const vote of result.votes) {
    explanation += `- **${vote.agentRole.toUpperCase()}**: ${vote.position} `;
    explanation += `(raw: ${vote.rawScore}, confidence: ${vote.confidence}%, `;
    explanation += `effective weight: ${(vote.effectiveWeight * 100).toFixed(1)}%, `;
    explanation += `weighted score: ${vote.weightedScore.toFixed(2)})\n`;
  }
  
  explanation += `\n### Summary\n`;
  explanation += `- **Final Score**: ${result.finalScore.toFixed(2)} (range: -100 to +100)\n`;
  explanation += `- **Average Confidence**: ${result.averageConfidence.toFixed(1)}%\n`;
  explanation += `- **Position Distribution**: ${result.supportCount} support, ${result.modifyCount} modify, ${result.opposeCount} oppose\n`;
  explanation += `- **High Confidence Votes**: ${result.highConfidenceVotes}/${result.votes.length}\n`;
  explanation += `- **Confidence Spread**: ${result.confidenceSpread.toFixed(1)}%\n`;
  
  return explanation;
}

export class ConfidenceEnforcer {
  private minimumConfidence: number;
  private unanimityBonus: number;
  private weights: WeightsConfig;
  
  constructor(
    minimumConfidence: number = DEFAULT_MIN_CONFIDENCE,
    unanimityBonus: number = DEFAULT_UNANIMITY_BONUS,
    weights: WeightsConfig = DEFAULT_VOTING_WEIGHTS
  ) {
    this.minimumConfidence = minimumConfidence;
    this.unanimityBonus = unanimityBonus;
    this.weights = weights;
  }
  
  calculateVotes(
    evaluations: AgentEvaluation[],
    riskClassification?: RiskClassification,
    actionType?: ActionType
  ): ConfidenceWeightedVote[] {
    return calculateConfidenceWeightedVotes(
      evaluations,
      this.weights,
      riskClassification,
      actionType
    );
  }
  
  calculateResult(
    evaluations: AgentEvaluation[],
    riskClassification?: RiskClassification,
    actionType?: ActionType
  ): ConfidenceWeightedResult {
    return calculateConfidenceWeightedResult(
      evaluations,
      this.weights,
      riskClassification,
      actionType
    );
  }
  
  applyBonus(result: ConfidenceWeightedResult): {
    adjustedScore: number;
    bonusApplied: boolean;
    reason?: string;
  } {
    return applyUnanimityBonus(result, this.unanimityBonus);
  }
  
  checkConfidence(result: ConfidenceWeightedResult): {
    passed: boolean;
    averageConfidence: number;
    deficit?: number;
    explanation: string;
  } {
    return checkMinimumConfidence(result, this.minimumConfidence);
  }
  
  explain(result: ConfidenceWeightedResult): string {
    return explainConfidenceWeighting(result);
  }
  
  // Full evaluation pipeline
  evaluate(
    evaluations: AgentEvaluation[],
    riskClassification?: RiskClassification,
    actionType?: ActionType
  ): {
    result: ConfidenceWeightedResult;
    adjustedScore: number;
    unanimityBonus: { applied: boolean; reason?: string };
    confidenceCheck: { passed: boolean; explanation: string };
  } {
    const result = this.calculateResult(evaluations, riskClassification, actionType);
    const bonusResult = this.applyBonus(result);
    const confidenceCheck = this.checkConfidence(result);
    
    return {
      result,
      adjustedScore: bonusResult.adjustedScore,
      unanimityBonus: {
        applied: bonusResult.bonusApplied,
        reason: bonusResult.reason,
      },
      confidenceCheck: {
        passed: confidenceCheck.passed,
        explanation: confidenceCheck.explanation,
      },
    };
  }
  
  setMinimumConfidence(value: number): void {
    this.minimumConfidence = Math.max(0, Math.min(100, value));
  }
  
  setUnanimityBonus(value: number): void {
    this.unanimityBonus = Math.max(0, value);
  }
  
  setWeights(weights: WeightsConfig): void {
    this.weights = weights;
  }
}
