/**
 * Decision Explainer
 * 
 * v1.2 - Generates final decision with full explainability
 * 
 * Responsibilities:
 * - Determine final decision (APPROVE / APPROVE_WITH_MODIFICATIONS / REJECT)
 * - Identify primary influencer
 * - Generate human-readable explanation
 * - Compile required modifications
 * - Ensure full transparency of decision process
 */

import {
  AgentRole,
  AgentEvaluation,
  AgentPosition,
  AggregatedVote,
  ConflictAnalysis,
  DebateDecision,
  DecisionExplanation,
  SuggestedModification,
  KeyFactor,
  DebateThresholds,
  DEFAULT_DEBATE_THRESHOLDS,
} from './models';

export class DecisionExplainer {
  private logger: Console;
  private thresholds: DebateThresholds;

  constructor(customThresholds?: Partial<DebateThresholds>) {
    this.thresholds = { ...DEFAULT_DEBATE_THRESHOLDS, ...customThresholds };
    this.logger = console;
    this.logger.log('[DecisionExplainer] Initialized');
  }

  /**
   * Generate final decision with full explanation
   */
  explain(
    evaluations: AgentEvaluation[],
    aggregatedVote: AggregatedVote,
    conflictAnalysis: ConflictAnalysis
  ): DecisionExplanation {
    this.logger.log('[DecisionExplainer] Generating decision explanation...');

    // Determine the decision
    const decision = this.determineDecision(aggregatedVote, conflictAnalysis);

    // Calculate decision confidence
    const confidence = this.calculateDecisionConfidence(
      evaluations, aggregatedVote, conflictAnalysis, decision
    );

    // Identify primary influencer
    const primaryInfluencer = this.identifyPrimaryInfluencer(evaluations, aggregatedVote);

    // Calculate influence breakdown
    const influenceBreakdown = this.calculateInfluenceBreakdown(evaluations, aggregatedVote);

    // Generate reasoning explanation
    const reasoning = this.generateReasoning(evaluations, aggregatedVote, conflictAnalysis, decision);

    // Extract key factors
    const keyFactors = this.extractKeyFactors(evaluations, conflictAnalysis, decision);

    // Compile modifications if needed
    const modifications = decision === DebateDecision.APPROVE_WITH_MODIFICATIONS
      ? this.compileModifications(evaluations)
      : undefined;

    const explanation: DecisionExplanation = {
      decision,
      confidence,
      primaryInfluencer,
      influenceBreakdown,
      reasoning,
      keyFactors,
      modifications,
    };

    this.logger.log(
      `[DecisionExplainer] Decision: ${decision.toUpperCase()} ` +
      `(confidence: ${confidence}%, primary: ${primaryInfluencer})`
    );

    return explanation;
  }

  // ============================================================================
  // DECISION DETERMINATION
  // ============================================================================

  private determineDecision(
    aggregatedVote: AggregatedVote,
    conflictAnalysis: ConflictAnalysis
  ): DebateDecision {
    const score = aggregatedVote.aggregateScore;

    // Check for unanimous opposition
    if (aggregatedVote.unanimousOppose) {
      return DebateDecision.REJECT;
    }

    // Check for critical conflicts that block approval
    const hasCriticalConflict = conflictAnalysis.conflicts.some(
      c => c.severity === 'critical'
    );
    if (hasCriticalConflict && score < this.thresholds.approvalThreshold) {
      return DebateDecision.REJECT;
    }

    // Apply thresholds
    if (score >= this.thresholds.approvalThreshold) {
      // High score - but check if modifications are required
      if (aggregatedVote.modificationsRequired) {
        return DebateDecision.APPROVE_WITH_MODIFICATIONS;
      }
      return DebateDecision.APPROVE;
    }

    if (score <= this.thresholds.rejectionThreshold) {
      // Low score - reject
      return DebateDecision.REJECT;
    }

    // Middle range - require modifications
    return DebateDecision.APPROVE_WITH_MODIFICATIONS;
  }

  // ============================================================================
  // CONFIDENCE CALCULATION
  // ============================================================================

  private calculateDecisionConfidence(
    evaluations: AgentEvaluation[],
    aggregatedVote: AggregatedVote,
    conflictAnalysis: ConflictAnalysis,
    decision: DebateDecision
  ): number {
    let confidence = 50; // Base confidence

    // Consensus level boosts confidence
    confidence += (aggregatedVote.consensusLevel - 50) * 0.4;

    // Unanimous decision has high confidence
    if (aggregatedVote.unanimousSupport || aggregatedVote.unanimousOppose) {
      confidence += 30;
    }

    // Average agent confidence
    const avgAgentConfidence = evaluations.reduce((sum, e) => sum + e.confidence, 0) / evaluations.length;
    confidence += (avgAgentConfidence - 50) * 0.3;

    // Score extremity increases confidence
    const scoreExtremity = Math.abs(aggregatedVote.aggregateScore);
    confidence += scoreExtremity * 0.2;

    // Critical conflicts reduce confidence
    const criticalConflicts = conflictAnalysis.conflicts.filter(c => c.severity === 'critical').length;
    confidence -= criticalConflicts * 15;

    // MODIFY decisions typically have lower confidence
    if (decision === DebateDecision.APPROVE_WITH_MODIFICATIONS) {
      confidence -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  // ============================================================================
  // INFLUENCER IDENTIFICATION
  // ============================================================================

  private identifyPrimaryInfluencer(
    evaluations: AgentEvaluation[],
    aggregatedVote: AggregatedVote
  ): AgentRole {
    // Find the agent with the highest weighted contribution
    let maxInfluence = -Infinity;
    let primaryInfluencer = AgentRole.RISK; // Default to risk

    for (const vote of aggregatedVote.votes) {
      const absoluteInfluence = Math.abs(vote.weightedScore * vote.confidence / 100);
      
      if (absoluteInfluence > maxInfluence) {
        maxInfluence = absoluteInfluence;
        primaryInfluencer = vote.agentRole;
      }
    }

    return primaryInfluencer;
  }

  private calculateInfluenceBreakdown(
    evaluations: AgentEvaluation[],
    aggregatedVote: AggregatedVote
  ): Record<AgentRole, number> {
    const breakdown: Record<AgentRole, number> = {
      [AgentRole.SEO]: 0,
      [AgentRole.RISK]: 0,
      [AgentRole.BRAND]: 0,
    };

    // Calculate total absolute influence
    let totalInfluence = 0;
    for (const vote of aggregatedVote.votes) {
      const influence = Math.abs(vote.weightedScore * vote.confidence / 100);
      totalInfluence += influence;
      breakdown[vote.agentRole] = influence;
    }

    // Normalize to percentages
    if (totalInfluence > 0) {
      for (const role of Object.values(AgentRole)) {
        breakdown[role] = Math.round((breakdown[role] / totalInfluence) * 100);
      }
    }

    return breakdown;
  }

  // ============================================================================
  // REASONING GENERATION
  // ============================================================================

  private generateReasoning(
    evaluations: AgentEvaluation[],
    aggregatedVote: AggregatedVote,
    conflictAnalysis: ConflictAnalysis,
    decision: DebateDecision
  ): string[] {
    const reasoning: string[] = [];

    // Decision rationale
    switch (decision) {
      case DebateDecision.APPROVE:
        reasoning.push(
          `Action APPROVED with aggregate score of ${aggregatedVote.aggregateScore.toFixed(1)} ` +
          `(threshold: ${this.thresholds.approvalThreshold}).`
        );
        if (aggregatedVote.unanimousSupport) {
          reasoning.push('All agents unanimously support this action.');
        }
        break;

      case DebateDecision.APPROVE_WITH_MODIFICATIONS:
        reasoning.push(
          `Action approved with MODIFICATIONS required. Aggregate score: ${aggregatedVote.aggregateScore.toFixed(1)}.`
        );
        if (conflictAnalysis.hasConflicts) {
          reasoning.push(
            `${conflictAnalysis.conflicts.length} conflict(s) detected requiring resolution.`
          );
        }
        break;

      case DebateDecision.REJECT:
        reasoning.push(
          `Action REJECTED with aggregate score of ${aggregatedVote.aggregateScore.toFixed(1)} ` +
          `(threshold: ${this.thresholds.rejectionThreshold}).`
        );
        if (aggregatedVote.unanimousOppose) {
          reasoning.push('All agents unanimously oppose this action.');
        }
        break;
    }

    // Agent position summary
    for (const eval_ of evaluations) {
      reasoning.push(
        `${eval_.agentName}: ${eval_.position.toUpperCase()} ` +
        `(confidence: ${eval_.confidence}%, score: ${eval_.assessment.overallScore})`
      );
    }

    // Conflict summary
    if (conflictAnalysis.hasConflicts) {
      const criticalConflicts = conflictAnalysis.conflicts.filter(c => c.severity === 'critical');
      if (criticalConflicts.length > 0) {
        reasoning.push(
          `CRITICAL CONFLICTS: ${criticalConflicts.map(c => c.description).join('; ')}`
        );
      }
    }

    // Consensus areas
    const fullConsensus = conflictAnalysis.consensusAreas.filter(c => c.consensusType === 'full');
    if (fullConsensus.length > 0) {
      reasoning.push(
        `Consensus areas: ${fullConsensus.map(c => c.aspect).join(', ')}`
      );
    }

    return reasoning;
  }

  // ============================================================================
  // KEY FACTORS EXTRACTION
  // ============================================================================

  private extractKeyFactors(
    evaluations: AgentEvaluation[],
    conflictAnalysis: ConflictAnalysis,
    decision: DebateDecision
  ): KeyFactor[] {
    const factors: KeyFactor[] = [];

    // Extract high-weight reasoning points from each agent
    for (const eval_ of evaluations) {
      const highWeightReasons = eval_.reasoning.filter(r => r.weight === 'high');
      
      for (const reason of highWeightReasons) {
        factors.push({
          factor: reason.statement,
          source: eval_.agentRole,
          impact: reason.type === 'benefit' ? 'positive' : 
                  reason.type === 'risk' ? 'negative' : 'neutral',
          weight: this.mapWeightToNumber(reason.weight),
        });
      }
    }

    // Add conflict factors
    for (const conflict of conflictAnalysis.conflicts) {
      if (conflict.severity === 'critical' || conflict.severity === 'major') {
        factors.push({
          factor: conflict.description,
          source: conflict.agentA, // Attribute to first agent
          impact: 'negative',
          weight: conflict.severity === 'critical' ? 1.0 : 0.7,
        });
      }
    }

    // Sort by weight
    factors.sort((a, b) => b.weight - a.weight);

    // Return top factors
    return factors.slice(0, 10);
  }

  private mapWeightToNumber(weight: 'high' | 'medium' | 'low'): number {
    switch (weight) {
      case 'high': return 1.0;
      case 'medium': return 0.6;
      case 'low': return 0.3;
    }
  }

  // ============================================================================
  // MODIFICATIONS COMPILATION
  // ============================================================================

  private compileModifications(evaluations: AgentEvaluation[]): SuggestedModification[] {
    const allModifications: SuggestedModification[] = [];
    const seenAspects = new Set<string>();

    // Collect all modifications, prioritizing required ones
    const sortedEvaluations = [...evaluations].sort((a, b) => {
      const aHasRequired = a.modifications?.some(m => m.priority === 'required') ? 1 : 0;
      const bHasRequired = b.modifications?.some(m => m.priority === 'required') ? 1 : 0;
      return bHasRequired - aHasRequired;
    });

    for (const eval_ of sortedEvaluations) {
      if (!eval_.modifications) continue;

      for (const mod of eval_.modifications) {
        // Avoid duplicate aspects (prioritize first seen = required priority)
        if (!seenAspects.has(mod.aspect)) {
          allModifications.push(mod);
          seenAspects.add(mod.aspect);
        }
      }
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = {
      required: 0,
      recommended: 1,
      optional: 2,
    };

    allModifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return allModifications;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get current thresholds
   */
  getThresholds(): DebateThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<DebateThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger.log('[DecisionExplainer] Thresholds updated');
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(explanation: DecisionExplanation): string {
    const lines: string[] = [
      `=== DEBATE DECISION: ${explanation.decision.toUpperCase()} ===`,
      `Confidence: ${explanation.confidence}%`,
      `Primary Influencer: ${explanation.primaryInfluencer.toUpperCase()}`,
      '',
      'Reasoning:',
      ...explanation.reasoning.map(r => `  • ${r}`),
      '',
      'Key Factors:',
      ...explanation.keyFactors.slice(0, 5).map(f => 
        `  • [${f.impact.toUpperCase()}] ${f.factor} (source: ${f.source})`
      ),
    ];

    if (explanation.modifications && explanation.modifications.length > 0) {
      lines.push('');
      lines.push('Required Modifications:');
      for (const mod of explanation.modifications) {
        lines.push(`  • [${mod.priority.toUpperCase()}] ${mod.aspect}: ${mod.suggestedValue}`);
        lines.push(`    Reason: ${mod.reason}`);
      }
    }

    return lines.join('\n');
  }
}

export default DecisionExplainer;
