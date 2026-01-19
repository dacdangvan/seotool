/**
 * Vote Aggregator
 * 
 * v1.2 - Aggregates agent evaluations using weighted voting
 * 
 * Responsibilities:
 * - Apply base weights (SEO: 0.35, RISK: 0.35, BRAND: 0.30)
 * - Apply action type modifiers
 * - Apply risk level modifiers
 * - Calculate aggregate score
 * - Determine preliminary decision
 */

import { ActionType } from '../autonomous_agent/models';
import { RiskLevel } from '../autonomous_agent_v1_1/models';
import {
  AgentRole,
  AgentEvaluation,
  AgentPosition,
  VotingWeights,
  VoteResult,
  AggregatedVote,
  DEFAULT_VOTING_WEIGHTS,
  ConflictAnalysis,
} from './models';

// Position to score mapping
const POSITION_SCORES: Record<AgentPosition, number> = {
  [AgentPosition.SUPPORT]: 100,
  [AgentPosition.MODIFY]: 50,
  [AgentPosition.OPPOSE]: 0,
};

export class VoteAggregator {
  private logger: Console;
  private weights: VotingWeights;

  constructor(projectId: string, customWeights?: Partial<Omit<VotingWeights, 'projectId'>>) {
    this.weights = {
      projectId,
      ...DEFAULT_VOTING_WEIGHTS,
      ...customWeights,
    };
    this.logger = console;
    this.logger.log(`[VoteAggregator] Initialized for project: ${projectId}`);
  }

  /**
   * Aggregate votes from all agents
   */
  aggregate(
    evaluations: AgentEvaluation[],
    actionType: ActionType,
    riskLevel: RiskLevel,
    conflictAnalysis: ConflictAnalysis
  ): AggregatedVote {
    this.logger.log('[VoteAggregator] Aggregating votes...');

    // Calculate effective weights for this action
    const effectiveWeights = this.calculateEffectiveWeights(actionType, riskLevel);

    // Calculate individual votes
    const votes: VoteResult[] = evaluations.map(eval_ => 
      this.calculateVote(eval_, effectiveWeights)
    );

    // Calculate weighted aggregate
    const aggregateScore = this.calculateAggregateScore(votes);

    // Determine if modifications are required
    const modificationsRequired = this.determineModificationsRequired(evaluations, conflictAnalysis);

    // Calculate consensus level
    const consensusLevel = this.calculateConsensusLevel(evaluations, conflictAnalysis);

    // Determine majority position
    const majorityPosition = this.determineMajorityPosition(evaluations);

    // Check for unanimous positions
    const unanimousSupport = evaluations.every(e => e.position === AgentPosition.SUPPORT);
    const unanimousOppose = evaluations.every(e => e.position === AgentPosition.OPPOSE);

    // Calculate weighted average (on 0-100 scale)
    const weightedAverage = (aggregateScore + 100) / 2;

    const aggregatedVote: AggregatedVote = {
      votes,
      aggregateScore,
      totalScore: aggregateScore,
      weightedAverage,
      effectiveWeights,
      modificationsRequired,
      consensusLevel,
      unanimousSupport,
      unanimousOppose,
      majorityPosition,
      calculatedAt: new Date().toISOString(),
    };

    this.logger.log(
      `[VoteAggregator] Aggregation complete: score=${aggregateScore.toFixed(2)}, ` +
      `consensus=${consensusLevel}%, modifications=${modificationsRequired}`
    );

    return aggregatedVote;
  }

  // ============================================================================
  // WEIGHT CALCULATIONS
  // ============================================================================

  private calculateEffectiveWeights(
    actionType: ActionType,
    riskLevel: RiskLevel
  ): Record<AgentRole, number> {
    // Start with base weights
    const weights = { ...this.weights.baseWeights };

    // Apply action type modifiers
    const actionModifiers = this.weights.actionTypeModifiers[actionType];
    if (actionModifiers) {
      for (const role of Object.values(AgentRole)) {
        if (actionModifiers[role] !== undefined) {
          weights[role] = actionModifiers[role];
        }
      }
    }

    // Apply risk level modifiers
    const riskModifiers = this.weights.riskLevelModifiers[riskLevel];
    if (riskModifiers) {
      for (const role of Object.values(AgentRole)) {
        // Risk modifiers are multipliers, not replacements
        weights[role] *= riskModifiers[role] || 1;
      }
    }

    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    for (const role of Object.values(AgentRole)) {
      weights[role] /= totalWeight;
    }

    return weights;
  }

  // ============================================================================
  // INDIVIDUAL VOTE CALCULATION
  // ============================================================================

  private calculateVote(
    evaluation: AgentEvaluation,
    effectiveWeights: Record<AgentRole, number>
  ): VoteResult {
    const weight = effectiveWeights[evaluation.agentRole] || 0;

    // Base vote score from position
    const positionScore = POSITION_SCORES[evaluation.position];

    // Adjust by confidence (higher confidence = stronger vote)
    const confidenceMultiplier = evaluation.confidence / 100;

    // Raw vote score (0-100 range)
    const rawScore = positionScore * confidenceMultiplier;

    // Weighted score
    const weightedScore = rawScore * weight;

    // Calculate contribution to final score
    // Convert to -100 to +100 scale for aggregate
    const scaledScore = (positionScore - 50) * 2 * confidenceMultiplier; // -100 to +100

    // Normalized score (-1 to +1)
    const normalizedScore = scaledScore / 100;

    return {
      agentRole: evaluation.agentRole,
      position: evaluation.position,
      confidence: evaluation.confidence,
      weight,
      rawScore,
      weightedScore,
      scaledScore,
      normalizedScore,
    };
  }

  // ============================================================================
  // AGGREGATE SCORE CALCULATION
  // ============================================================================

  private calculateAggregateScore(votes: VoteResult[]): number {
    // Calculate weighted average of scaled scores
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      totalWeightedScore += vote.scaledScore * vote.weight;
      totalWeight += vote.weight;
    }

    // Return aggregate score on -100 to +100 scale
    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }

  // ============================================================================
  // MODIFICATIONS DETERMINATION
  // ============================================================================

  private determineModificationsRequired(
    evaluations: AgentEvaluation[],
    conflictAnalysis: ConflictAnalysis
  ): boolean {
    // Check if any agent is in MODIFY position
    const hasModifyPosition = evaluations.some(e => e.position === AgentPosition.MODIFY);

    // Check if there are required modifications from any agent
    const hasRequiredModifications = evaluations.some(
      e => e.modifications?.some(m => m.priority === 'required')
    );

    // Check for critical or major conflicts
    const hasCriticalConflicts = conflictAnalysis.conflicts.some(
      c => c.severity === 'critical' || c.severity === 'major'
    );

    // Check for modification conflicts
    const hasModificationConflicts = conflictAnalysis.conflicts.some(
      c => c.type === 'modification_conflict' // Use string instead of enum
    );

    return hasModifyPosition || hasRequiredModifications || 
           hasCriticalConflicts || hasModificationConflicts;
  }

  // ============================================================================
  // CONSENSUS CALCULATION
  // ============================================================================

  private calculateConsensusLevel(
    evaluations: AgentEvaluation[],
    conflictAnalysis: ConflictAnalysis
  ): number {
    if (evaluations.length < 2) {
      return 100;
    }

    // Start with conflict analysis alignment
    let consensus = conflictAnalysis.overallAlignment;

    // Check position agreement
    const positions = evaluations.map(e => e.position);
    const uniquePositions = [...new Set(positions)];

    if (uniquePositions.length === 1) {
      // Full position agreement
      consensus = Math.min(100, consensus + 20);
    } else if (uniquePositions.length === evaluations.length) {
      // No agreement
      consensus = Math.max(0, consensus - 20);
    }

    // Check confidence levels
    const avgConfidence = evaluations.reduce((sum, e) => sum + e.confidence, 0) / evaluations.length;
    
    // High confidence with disagreement is worse than low confidence disagreement
    if (uniquePositions.length > 1 && avgConfidence > 70) {
      consensus = Math.max(0, consensus - 10);
    }

    // Check for consensus areas
    const fullConsensusCount = conflictAnalysis.consensusAreas.filter(
      c => c.consensusType === 'full'
    ).length;
    consensus = Math.min(100, consensus + fullConsensusCount * 5);

    return Math.round(consensus);
  }

  // ============================================================================
  // MAJORITY POSITION DETERMINATION
  // ============================================================================

  private determineMajorityPosition(evaluations: AgentEvaluation[]): AgentPosition {
    const positionCounts: Record<AgentPosition, number> = {
      [AgentPosition.SUPPORT]: 0,
      [AgentPosition.MODIFY]: 0,
      [AgentPosition.OPPOSE]: 0,
    };

    for (const eval_ of evaluations) {
      positionCounts[eval_.position]++;
    }

    let maxCount = 0;
    let majorityPosition = AgentPosition.MODIFY;

    for (const [position, count] of Object.entries(positionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        majorityPosition = position as AgentPosition;
      }
    }

    return majorityPosition;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get current voting weights
   */
  getWeights(): VotingWeights {
    return { ...this.weights };
  }

  /**
   * Update voting weights
   */
  updateWeights(newWeights: Partial<Omit<VotingWeights, 'projectId'>>): void {
    this.weights = {
      ...this.weights,
      ...newWeights,
    };
    this.logger.log('[VoteAggregator] Weights updated');
  }

  /**
   * Get weight explanation for a specific action/risk combination
   */
  explainWeights(actionType: ActionType, riskLevel: RiskLevel): string {
    const effectiveWeights = this.calculateEffectiveWeights(actionType, riskLevel);
    
    const lines = [
      `Effective weights for ${actionType} (${riskLevel} risk):`,
    ];

    for (const role of Object.values(AgentRole)) {
      const baseWeight = this.weights.baseWeights[role];
      const effectiveWeight = effectiveWeights[role];
      const diff = effectiveWeight - baseWeight;
      const diffStr = diff >= 0 ? `+${(diff * 100).toFixed(1)}%` : `${(diff * 100).toFixed(1)}%`;
      
      lines.push(
        `  ${role.toUpperCase()}: ${(effectiveWeight * 100).toFixed(1)}% ` +
        `(base: ${(baseWeight * 100).toFixed(1)}%, adjustment: ${diffStr})`
      );
    }

    return lines.join('\n');
  }
}

export default VoteAggregator;
