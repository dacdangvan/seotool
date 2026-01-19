/**
 * Execution Gate
 * 
 * Final decision maker that combines all governance controls.
 * Determines if an action can be auto-executed.
 * 
 * Gate Checks (in order):
 * 1. Quorum Check - Are enough agents enabled?
 * 2. Veto Check - Has Risk agent vetoed?
 * 3. Confidence Check - Is average confidence above threshold?
 * 4. Conflict Check - Are there critical blocking conflicts?
 * 5. Score Check - Does final score meet approval threshold?
 */

import {
  ExecutionGate,
  ExecutionGateStatus,
  AppliedThresholds,
  ConfidenceWeightedResult,
  QuorumEvaluation,
  VetoEvaluation,
  V13Config,
  DEFAULT_V13_CONFIG,
  AgentRole,
} from './models';
import { ConflictAnalysis, DebateOutput } from '../debate_engine/models';
import { RiskClassification } from '../autonomous_agent_v1_1/models';

/**
 * Evaluate the execution gate
 */
export function evaluateExecutionGate(
  confidenceResult: ConfidenceWeightedResult,
  quorumEvaluation: QuorumEvaluation,
  vetoEvaluation: VetoEvaluation,
  conflictAnalysis: ConflictAnalysis,
  config: Partial<V13Config> = {}
): ExecutionGate {
  const mergedConfig = { ...DEFAULT_V13_CONFIG, ...config };
  const blockingReasons: string[] = [];
  
  // Applied thresholds for transparency
  const appliedThresholds: AppliedThresholds = {
    minimumConfidence: mergedConfig.minimumConfidence,
    approvalThreshold: mergedConfig.approvalThreshold,
    rejectionThreshold: mergedConfig.rejectionThreshold,
    vetoThreshold: 80, // Risk score threshold for veto
    quorumPercentage: mergedConfig.quorumConfig.minimumPercentage,
  };
  
  // =========================================================================
  // Gate 1: Quorum Check
  // =========================================================================
  if (mergedConfig.enableQuorumCheck && !quorumEvaluation.quorumMet) {
    blockingReasons.push(
      `Quorum not met: ${quorumEvaluation.enabledAgents}/${quorumEvaluation.requiredAgents} agents enabled`
    );
    if (!quorumEvaluation.riskAgentPresent) {
      blockingReasons.push('Risk Agent is required but not enabled');
    }
    
    return createGate(
      ExecutionGateStatus.BLOCKED_BY_QUORUM,
      false,
      confidenceResult,
      quorumEvaluation,
      vetoEvaluation,
      appliedThresholds,
      blockingReasons
    );
  }
  
  // =========================================================================
  // Gate 2: Veto Check
  // =========================================================================
  if (mergedConfig.enableVetoSystem && vetoEvaluation.vetoTriggered) {
    blockingReasons.push(`Veto by ${vetoEvaluation.vetoingAgent}: ${vetoEvaluation.reason}`);
    
    return createGate(
      ExecutionGateStatus.BLOCKED_BY_VETO,
      false,
      confidenceResult,
      quorumEvaluation,
      vetoEvaluation,
      appliedThresholds,
      blockingReasons
    );
  }
  
  // =========================================================================
  // Gate 3: Confidence Check
  // =========================================================================
  if (mergedConfig.enableConfidenceWeighting) {
    if (confidenceResult.averageConfidence < mergedConfig.minimumConfidence) {
      blockingReasons.push(
        `Average confidence ${confidenceResult.averageConfidence.toFixed(1)}% below minimum ${mergedConfig.minimumConfidence}%`
      );
      
      return createGate(
        ExecutionGateStatus.BLOCKED_BY_CONFIDENCE,
        false,
        confidenceResult,
        quorumEvaluation,
        vetoEvaluation,
        appliedThresholds,
        blockingReasons
      );
    }
  }
  
  // =========================================================================
  // Gate 4: Critical Conflict Check
  // =========================================================================
  const criticalConflicts = conflictAnalysis.conflicts.filter(c => c.severity === 'critical');
  if (criticalConflicts.length > 0) {
    for (const conflict of criticalConflicts) {
      blockingReasons.push(
        `Critical conflict: ${conflict.description} (${conflict.agentA} vs ${conflict.agentB})`
      );
    }
    
    return createGate(
      ExecutionGateStatus.BLOCKED_BY_CONFLICT,
      false,
      confidenceResult,
      quorumEvaluation,
      vetoEvaluation,
      appliedThresholds,
      blockingReasons
    );
  }
  
  // =========================================================================
  // Gate 5: Score Evaluation
  // =========================================================================
  const finalScore = confidenceResult.finalScore;
  
  // Clear rejection
  if (finalScore <= mergedConfig.rejectionThreshold) {
    return createGate(
      ExecutionGateStatus.REJECTED,
      false,
      confidenceResult,
      quorumEvaluation,
      vetoEvaluation,
      appliedThresholds,
      [`Score ${finalScore.toFixed(2)} below rejection threshold ${mergedConfig.rejectionThreshold}`]
    );
  }
  
  // Clear approval
  if (finalScore >= mergedConfig.approvalThreshold) {
    // Check for major (non-critical) conflicts that warrant conditions
    const majorConflicts = conflictAnalysis.conflicts.filter(c => c.severity === 'major');
    
    if (majorConflicts.length > 0) {
      return createGate(
        ExecutionGateStatus.APPROVED_WITH_CONDITIONS,
        true, // Can execute, but with conditions
        confidenceResult,
        quorumEvaluation,
        vetoEvaluation,
        appliedThresholds,
        majorConflicts.map(c => `Major conflict requires attention: ${c.description}`)
      );
    }
    
    return createGate(
      ExecutionGateStatus.APPROVED,
      true,
      confidenceResult,
      quorumEvaluation,
      vetoEvaluation,
      appliedThresholds,
      []
    );
  }
  
  // In the "modify" range - approved with conditions
  return createGate(
    ExecutionGateStatus.APPROVED_WITH_CONDITIONS,
    true,
    confidenceResult,
    quorumEvaluation,
    vetoEvaluation,
    appliedThresholds,
    [`Score ${finalScore.toFixed(2)} in modification range (${mergedConfig.rejectionThreshold} to ${mergedConfig.approvalThreshold})`]
  );
}

/**
 * Create ExecutionGate object
 */
function createGate(
  status: ExecutionGateStatus,
  canExecute: boolean,
  confidenceResult: ConfidenceWeightedResult,
  quorumEvaluation: QuorumEvaluation,
  vetoEvaluation: VetoEvaluation,
  appliedThresholds: AppliedThresholds,
  blockingReasons: string[]
): ExecutionGate {
  return {
    status,
    canExecute,
    confidenceWeightedScore: confidenceResult.finalScore,
    aggregateConfidence: confidenceResult.averageConfidence,
    quorumMet: quorumEvaluation.quorumMet,
    enabledAgentCount: quorumEvaluation.enabledAgents,
    minimumAgentsRequired: quorumEvaluation.requiredAgents,
    vetoApplied: vetoEvaluation.vetoTriggered,
    vetoAgent: vetoEvaluation.vetoingAgent,
    vetoReason: vetoEvaluation.reason,
    appliedThresholds,
    blockingReasons,
    gateEvaluatedAt: new Date().toISOString(),
    gateId: `gate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * Explain gate decision
 */
export function explainGateDecision(gate: ExecutionGate): string {
  let explanation = '## Execution Gate Decision\n\n';
  
  // Status
  const statusEmoji = gate.canExecute ? '✅' : '❌';
  explanation += `### Status: ${statusEmoji} ${gate.status.toUpperCase().replace(/_/g, ' ')}\n\n`;
  
  // Scores
  explanation += `### Scores\n`;
  explanation += `- **Confidence-Weighted Score**: ${gate.confidenceWeightedScore.toFixed(2)} (range: -100 to +100)\n`;
  explanation += `- **Average Confidence**: ${gate.aggregateConfidence.toFixed(1)}%\n\n`;
  
  // Governance Checks
  explanation += `### Governance Checks\n`;
  explanation += `- **Quorum**: ${gate.quorumMet ? '✅ Met' : '❌ NOT Met'} (${gate.enabledAgentCount}/${gate.minimumAgentsRequired} agents)\n`;
  explanation += `- **Veto**: ${gate.vetoApplied ? `❌ VETOED by ${gate.vetoAgent}` : '✅ No veto'}\n`;
  
  if (gate.vetoReason) {
    explanation += `  - Reason: ${gate.vetoReason}\n`;
  }
  
  // Thresholds
  explanation += `\n### Applied Thresholds\n`;
  explanation += `- Minimum Confidence: ${gate.appliedThresholds.minimumConfidence}%\n`;
  explanation += `- Approval Threshold: ≥${gate.appliedThresholds.approvalThreshold}\n`;
  explanation += `- Rejection Threshold: ≤${gate.appliedThresholds.rejectionThreshold}\n`;
  explanation += `- Quorum: ${gate.appliedThresholds.quorumPercentage}%\n`;
  
  // Blocking Reasons
  if (gate.blockingReasons.length > 0) {
    explanation += `\n### ${gate.canExecute ? 'Conditions' : 'Blocking Reasons'}\n`;
    for (const reason of gate.blockingReasons) {
      explanation += `- ${reason}\n`;
    }
  }
  
  // Final verdict
  explanation += `\n### Verdict\n`;
  if (gate.canExecute) {
    if (gate.status === ExecutionGateStatus.APPROVED) {
      explanation += `Action **APPROVED** for auto-execution.\n`;
    } else {
      explanation += `Action **APPROVED WITH CONDITIONS** - review conditions above.\n`;
    }
  } else {
    explanation += `Action **BLOCKED** - cannot be auto-executed.\n`;
    explanation += `Human review required to proceed.\n`;
  }
  
  return explanation;
}

/**
 * Quick check if action can auto-execute
 */
export function canAutoExecute(gate: ExecutionGate): boolean {
  return gate.canExecute && gate.status === ExecutionGateStatus.APPROVED;
}

/**
 * Get summary status for UI display
 */
export function getGateSummary(gate: ExecutionGate): {
  status: string;
  canExecute: boolean;
  score: number;
  confidence: number;
  mainReason: string;
} {
  return {
    status: gate.status.replace(/_/g, ' ').toUpperCase(),
    canExecute: gate.canExecute,
    score: gate.confidenceWeightedScore,
    confidence: gate.aggregateConfidence,
    mainReason: gate.blockingReasons[0] || (gate.canExecute ? 'All checks passed' : 'Unknown reason'),
  };
}

export class ExecutionGateEvaluator {
  private config: Partial<V13Config>;
  
  constructor(config: Partial<V13Config> = {}) {
    this.config = config;
  }
  
  evaluate(
    confidenceResult: ConfidenceWeightedResult,
    quorumEvaluation: QuorumEvaluation,
    vetoEvaluation: VetoEvaluation,
    conflictAnalysis: ConflictAnalysis
  ): ExecutionGate {
    return evaluateExecutionGate(
      confidenceResult,
      quorumEvaluation,
      vetoEvaluation,
      conflictAnalysis,
      this.config
    );
  }
  
  explain(gate: ExecutionGate): string {
    return explainGateDecision(gate);
  }
  
  canAutoExecute(gate: ExecutionGate): boolean {
    return canAutoExecute(gate);
  }
  
  getSummary(gate: ExecutionGate): {
    status: string;
    canExecute: boolean;
    score: number;
    confidence: number;
    mainReason: string;
  } {
    return getGateSummary(gate);
  }
  
  updateConfig(newConfig: Partial<V13Config>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
