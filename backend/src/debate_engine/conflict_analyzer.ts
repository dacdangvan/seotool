/**
 * Conflict Analyzer
 * 
 * v1.2 - Detects and analyzes conflicts between agent evaluations
 * 
 * Responsibilities:
 * - Detect SEO vs Risk conflicts
 * - Detect SEO vs Brand conflicts
 * - Detect Risk vs Brand conflicts
 * - Identify position mismatches
 * - Identify modification conflicts
 * - Find consensus areas
 * - Suggest resolution strategies
 */

import {
  AgentRole,
  AgentEvaluation,
  AgentPosition,
  ConflictAnalysis,
  Conflict,
  ConflictType,
  ConsensusArea,
  SuggestedModification,
} from './models';

// Conflict severity thresholds
const SEVERITY_THRESHOLDS = {
  // Position weight differences that trigger conflicts
  CRITICAL_POSITION_DIFF: 2, // SUPPORT vs OPPOSE
  MAJOR_POSITION_DIFF: 1, // SUPPORT/OPPOSE vs MODIFY
  
  // Score differences that indicate conflicts
  CRITICAL_SCORE_DIFF: 80,
  MAJOR_SCORE_DIFF: 50,
  MINOR_SCORE_DIFF: 30,
  
  // Confidence thresholds for conflict severity
  HIGH_CONFIDENCE: 70,
  MEDIUM_CONFIDENCE: 50,
};

export class ConflictAnalyzer {
  private logger: Console;

  constructor() {
    this.logger = console;
    this.logger.log('[ConflictAnalyzer] Initialized');
  }

  /**
   * Analyze conflicts between agent evaluations
   */
  analyze(evaluations: AgentEvaluation[]): ConflictAnalysis {
    this.logger.log('[ConflictAnalyzer] Analyzing conflicts...');

    // Extract evaluations by role
    const evalMap = this.buildEvaluationMap(evaluations);

    // Detect all conflicts
    const conflicts: Conflict[] = [];

    // SEO vs Risk conflicts
    if (evalMap.seo && evalMap.risk) {
      const seoRiskConflict = this.detectAgentConflict(
        evalMap.seo,
        evalMap.risk,
        ConflictType.SEO_VS_RISK
      );
      if (seoRiskConflict) {
        conflicts.push(seoRiskConflict);
      }
    }

    // SEO vs Brand conflicts
    if (evalMap.seo && evalMap.brand) {
      const seoBrandConflict = this.detectAgentConflict(
        evalMap.seo,
        evalMap.brand,
        ConflictType.SEO_VS_BRAND
      );
      if (seoBrandConflict) {
        conflicts.push(seoBrandConflict);
      }
    }

    // Risk vs Brand conflicts
    if (evalMap.risk && evalMap.brand) {
      const riskBrandConflict = this.detectAgentConflict(
        evalMap.risk,
        evalMap.brand,
        ConflictType.RISK_VS_BRAND
      );
      if (riskBrandConflict) {
        conflicts.push(riskBrandConflict);
      }
    }

    // Detect modification conflicts
    const modificationConflicts = this.detectModificationConflicts(evaluations);
    conflicts.push(...modificationConflicts);

    // Find consensus areas
    const consensusAreas = this.findConsensusAreas(evaluations);

    // Calculate overall alignment
    const overallAlignment = this.calculateOverallAlignment(evaluations, conflicts);

    const analysis: ConflictAnalysis = {
      hasConflicts: conflicts.length > 0,
      conflicts,
      consensusAreas,
      overallAlignment,
    };

    this.logger.log(
      `[ConflictAnalyzer] Analysis complete: ${conflicts.length} conflicts, ` +
      `${consensusAreas.length} consensus areas, ${overallAlignment}% alignment`
    );

    return analysis;
  }

  // ============================================================================
  // EVALUATION MAP
  // ============================================================================

  private buildEvaluationMap(evaluations: AgentEvaluation[]): {
    seo?: AgentEvaluation;
    risk?: AgentEvaluation;
    brand?: AgentEvaluation;
  } {
    const map: { seo?: AgentEvaluation; risk?: AgentEvaluation; brand?: AgentEvaluation } = {};

    for (const eval_ of evaluations) {
      if (eval_.agentRole === AgentRole.SEO) {
        map.seo = eval_;
      } else if (eval_.agentRole === AgentRole.RISK) {
        map.risk = eval_;
      } else if (eval_.agentRole === AgentRole.BRAND) {
        map.brand = eval_;
      }
    }

    return map;
  }

  // ============================================================================
  // AGENT CONFLICT DETECTION
  // ============================================================================

  private detectAgentConflict(
    evalA: AgentEvaluation,
    evalB: AgentEvaluation,
    conflictType: ConflictType
  ): Conflict | null {
    // Check for position mismatch
    const positionDiff = this.calculatePositionDifference(evalA.position, evalB.position);
    const scoreDiff = Math.abs(evalA.assessment.overallScore - evalB.assessment.overallScore);

    // No significant conflict
    if (positionDiff === 0 && scoreDiff < SEVERITY_THRESHOLDS.MINOR_SCORE_DIFF) {
      return null;
    }

    // Determine severity
    const severity = this.determineSeverity(positionDiff, scoreDiff, evalA, evalB);

    // Generate conflict description
    const description = this.generateConflictDescription(evalA, evalB, conflictType);

    // Generate resolution strategy
    const resolutionStrategy = this.generateResolutionStrategy(evalA, evalB, severity);

    return {
      id: `conflict_${conflictType}_${Date.now()}`,
      type: positionDiff >= SEVERITY_THRESHOLDS.CRITICAL_POSITION_DIFF
        ? ConflictType.POSITION_MISMATCH
        : conflictType,
      agentA: evalA.agentRole,
      agentB: evalB.agentRole,
      description,
      severity,
      resolutionStrategy,
    };
  }

  private calculatePositionDifference(posA: AgentPosition, posB: AgentPosition): number {
    const positionOrder: Record<AgentPosition, number> = {
      [AgentPosition.SUPPORT]: 2,
      [AgentPosition.MODIFY]: 1,
      [AgentPosition.OPPOSE]: 0,
    };

    return Math.abs(positionOrder[posA] - positionOrder[posB]);
  }

  private determineSeverity(
    positionDiff: number,
    scoreDiff: number,
    evalA: AgentEvaluation,
    evalB: AgentEvaluation
  ): 'critical' | 'major' | 'minor' {
    // Critical: Opposite positions (SUPPORT vs OPPOSE) with high confidence
    if (positionDiff >= SEVERITY_THRESHOLDS.CRITICAL_POSITION_DIFF) {
      if (evalA.confidence >= SEVERITY_THRESHOLDS.HIGH_CONFIDENCE &&
          evalB.confidence >= SEVERITY_THRESHOLDS.HIGH_CONFIDENCE) {
        return 'critical';
      }
      return 'major';
    }

    // Major: Large score difference or position difference with confidence
    if (scoreDiff >= SEVERITY_THRESHOLDS.MAJOR_SCORE_DIFF) {
      return 'major';
    }

    if (positionDiff >= SEVERITY_THRESHOLDS.MAJOR_POSITION_DIFF &&
        (evalA.confidence >= SEVERITY_THRESHOLDS.MEDIUM_CONFIDENCE ||
         evalB.confidence >= SEVERITY_THRESHOLDS.MEDIUM_CONFIDENCE)) {
      return 'major';
    }

    return 'minor';
  }

  private generateConflictDescription(
    evalA: AgentEvaluation,
    evalB: AgentEvaluation,
    conflictType: ConflictType
  ): string {
    const posA = evalA.position.toUpperCase();
    const posB = evalB.position.toUpperCase();
    const scoreA = evalA.assessment.overallScore;
    const scoreB = evalB.assessment.overallScore;

    switch (conflictType) {
      case ConflictType.SEO_VS_RISK:
        return `SEO Agent (${posA}, score: ${scoreA}) conflicts with Risk Agent ` +
               `(${posB}, score: ${scoreB}). SEO prioritizes growth while Risk emphasizes safety.`;
      
      case ConflictType.SEO_VS_BRAND:
        return `SEO Agent (${posA}, score: ${scoreA}) conflicts with Brand Agent ` +
               `(${posB}, score: ${scoreB}). SEO optimization may affect brand voice/UX.`;
      
      case ConflictType.RISK_VS_BRAND:
        return `Risk Agent (${posA}, score: ${scoreA}) conflicts with Brand Agent ` +
               `(${posB}, score: ${scoreB}). Safety concerns vs brand experience priorities.`;
      
      default:
        return `Position mismatch: ${evalA.agentName} (${posA}) vs ${evalB.agentName} (${posB})`;
    }
  }

  private generateResolutionStrategy(
    evalA: AgentEvaluation,
    evalB: AgentEvaluation,
    severity: 'critical' | 'major' | 'minor'
  ): string {
    if (severity === 'critical') {
      // Critical conflicts require careful resolution
      if (evalA.agentRole === AgentRole.RISK && evalA.position === AgentPosition.OPPOSE) {
        return 'RISK PRIORITY: Risk agent strongly opposes - prioritize safety. ' +
               'Consider rejecting or requiring significant modifications.';
      }
      if (evalB.agentRole === AgentRole.RISK && evalB.position === AgentPosition.OPPOSE) {
        return 'RISK PRIORITY: Risk agent strongly opposes - prioritize safety. ' +
               'Consider rejecting or requiring significant modifications.';
      }
      return 'ESCALATE: Critical conflict requires human review. ' +
             'Gather additional evidence or defer decision.';
    }

    if (severity === 'major') {
      // Major conflicts can be resolved through modifications
      const hasModifications = evalA.modifications || evalB.modifications;
      if (hasModifications) {
        return 'MODIFY: Implement suggested modifications from both agents to reach consensus.';
      }
      return 'NEGOTIATE: Consider weighted voting with emphasis on higher-confidence agent.';
    }

    // Minor conflicts
    return 'PROCEED WITH CAUTION: Minor disagreement can be resolved through voting weights.';
  }

  // ============================================================================
  // MODIFICATION CONFLICT DETECTION
  // ============================================================================

  private detectModificationConflicts(evaluations: AgentEvaluation[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Collect all modifications by aspect
    const modificationsByAspect: Map<string, { agent: AgentRole; mod: SuggestedModification }[]> = new Map();

    for (const eval_ of evaluations) {
      if (!eval_.modifications) continue;

      for (const mod of eval_.modifications) {
        const existing = modificationsByAspect.get(mod.aspect) || [];
        existing.push({ agent: eval_.agentRole, mod });
        modificationsByAspect.set(mod.aspect, existing);
      }
    }

    // Check for conflicting modifications on same aspect
    for (const [aspect, mods] of modificationsByAspect) {
      if (mods.length < 2) continue;

      // Check if modifications conflict
      for (let i = 0; i < mods.length; i++) {
        for (let j = i + 1; j < mods.length; j++) {
          const modA = mods[i];
          const modB = mods[j];

          // Different suggested values = potential conflict
          if (modA.mod.suggestedValue !== modB.mod.suggestedValue) {
            conflicts.push({
              id: `modification_conflict_${aspect}_${Date.now()}`,
              type: ConflictType.MODIFICATION_CONFLICT,
              agentA: modA.agent,
              agentB: modB.agent,
              description: `Conflicting modifications for "${aspect}": ` +
                          `${modA.agent} suggests "${modA.mod.suggestedValue}" ` +
                          `vs ${modB.agent} suggests "${modB.mod.suggestedValue}"`,
              severity: modA.mod.priority === 'required' || modB.mod.priority === 'required'
                ? 'major'
                : 'minor',
              resolutionStrategy: modA.mod.priority === 'required'
                ? `Apply ${modA.agent}'s required modification for "${aspect}"`
                : modB.mod.priority === 'required'
                  ? `Apply ${modB.agent}'s required modification for "${aspect}"`
                  : `Combine or choose between modifications for "${aspect}"`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  // ============================================================================
  // CONSENSUS DETECTION
  // ============================================================================

  private findConsensusAreas(evaluations: AgentEvaluation[]): ConsensusArea[] {
    const consensusAreas: ConsensusArea[] = [];

    if (evaluations.length < 2) {
      return consensusAreas;
    }

    // Check for position consensus
    const positions = evaluations.map(e => e.position);
    const uniquePositions = [...new Set(positions)];

    if (uniquePositions.length === 1) {
      consensusAreas.push({
        aspect: 'position',
        agentsAgreed: evaluations.map(e => e.agentRole),
        consensusType: 'full',
      });
    } else if (uniquePositions.length === 2 && evaluations.length === 3) {
      // Partial consensus - 2 out of 3 agree
      const mostCommonPosition = this.findMostCommonPosition(positions);
      const agreeingAgents = evaluations
        .filter(e => e.position === mostCommonPosition)
        .map(e => e.agentRole);
      
      if (agreeingAgents.length >= 2) {
        consensusAreas.push({
          aspect: `position_${mostCommonPosition}`,
          agentsAgreed: agreeingAgents,
          consensusType: 'partial',
        });
      }
    }

    // Check for reasoning type consensus
    const benefitConsensus = this.checkReasoningTypeConsensus(evaluations, 'benefit');
    if (benefitConsensus) {
      consensusAreas.push(benefitConsensus);
    }

    const riskConsensus = this.checkReasoningTypeConsensus(evaluations, 'risk');
    if (riskConsensus) {
      consensusAreas.push(riskConsensus);
    }

    // Check for modification aspect consensus
    const modificationConsensus = this.checkModificationConsensus(evaluations);
    consensusAreas.push(...modificationConsensus);

    return consensusAreas;
  }

  private findMostCommonPosition(positions: AgentPosition[]): AgentPosition {
    const counts: Record<AgentPosition, number> = {
      [AgentPosition.SUPPORT]: 0,
      [AgentPosition.MODIFY]: 0,
      [AgentPosition.OPPOSE]: 0,
    };

    for (const pos of positions) {
      counts[pos]++;
    }

    let maxCount = 0;
    let mostCommon = AgentPosition.MODIFY;

    for (const [pos, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = pos as AgentPosition;
      }
    }

    return mostCommon;
  }

  private checkReasoningTypeConsensus(
    evaluations: AgentEvaluation[],
    reasoningType: 'benefit' | 'risk' | 'concern' | 'observation'
  ): ConsensusArea | null {
    const agentsWithType: AgentRole[] = [];

    for (const eval_ of evaluations) {
      const hasType = eval_.reasoning.some(r => r.type === reasoningType && r.weight === 'high');
      if (hasType) {
        agentsWithType.push(eval_.agentRole);
      }
    }

    if (agentsWithType.length >= 2) {
      return {
        aspect: `identified_${reasoningType}`,
        agentsAgreed: agentsWithType,
        consensusType: agentsWithType.length === evaluations.length ? 'full' : 'partial',
      };
    }

    return null;
  }

  private checkModificationConsensus(evaluations: AgentEvaluation[]): ConsensusArea[] {
    const consensusAreas: ConsensusArea[] = [];
    const modificationAspects: Map<string, AgentRole[]> = new Map();

    for (const eval_ of evaluations) {
      if (!eval_.modifications) continue;

      for (const mod of eval_.modifications) {
        const existing = modificationAspects.get(mod.aspect) || [];
        existing.push(eval_.agentRole);
        modificationAspects.set(mod.aspect, existing);
      }
    }

    for (const [aspect, agents] of modificationAspects) {
      if (agents.length >= 2) {
        consensusAreas.push({
          aspect: `modification_needed_${aspect}`,
          agentsAgreed: agents,
          consensusType: agents.length === evaluations.length ? 'full' : 'partial',
        });
      }
    }

    return consensusAreas;
  }

  // ============================================================================
  // ALIGNMENT CALCULATION
  // ============================================================================

  private calculateOverallAlignment(
    evaluations: AgentEvaluation[],
    conflicts: Conflict[]
  ): number {
    if (evaluations.length < 2) {
      return 100; // Single agent = full alignment
    }

    let alignment = 100;

    // Deduct for conflicts by severity
    for (const conflict of conflicts) {
      switch (conflict.severity) {
        case 'critical':
          alignment -= 30;
          break;
        case 'major':
          alignment -= 20;
          break;
        case 'minor':
          alignment -= 10;
          break;
      }
    }

    // Consider position variance
    const scores = evaluations.map(e => e.assessment.overallScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // High standard deviation reduces alignment
    alignment -= Math.min(20, stdDev * 0.5);

    return Math.max(0, Math.round(alignment));
  }
}

export default ConflictAnalyzer;
