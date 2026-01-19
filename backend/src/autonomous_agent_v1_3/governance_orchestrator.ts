/**
 * Governance Orchestrator v1.3
 * 
 * Main coordinator for confidence-weighted auto-execution.
 * Integrates v1.2 debate engine with v1.3 governance controls.
 * 
 * Flow:
 * 1. Validate quorum (enough agents enabled?)
 * 2. Run v1.2 debate (get evaluations, conflicts)
 * 3. Calculate confidence-weighted scores
 * 4. Check for veto conditions
 * 5. Evaluate execution gate
 * 6. Log to audit trail
 * 7. Return execution decision
 */

import {
  ExecutionDecision,
  ExecutionGate,
  ExecutionGateStatus,
  ConfidenceWeightedResult,
  QuorumEvaluation,
  VetoEvaluation,
  V13Config,
  DEFAULT_V13_CONFIG,
  AgentRole,
  AuditEntry,
} from './models';
import { 
  DebateInput, 
  DebateOutput, 
  AgentEvaluation,
  ConflictAnalysis,
  AgentConfig,
  DEFAULT_AGENT_CONFIGS,
} from '../debate_engine/models';
import { RiskClassification } from '../autonomous_agent_v1_1/models';

import { QuorumValidator } from './quorum_validator';
import { VetoController } from './veto_controller';
import { ConfidenceEnforcer } from './confidence_enforcer';
import { ExecutionGateEvaluator, canAutoExecute } from './execution_gate';
import { AuditLogger } from './audit_logger';

/**
 * V1.3 Governance Orchestrator
 * 
 * Usage:
 * ```typescript
 * const orchestrator = new GovernanceOrchestrator(config);
 * const decision = await orchestrator.evaluateAction(debateOutput, riskClassification);
 * 
 * if (decision.executionGate.canExecute) {
 *   // Safe to auto-execute
 * }
 * ```
 */
export class GovernanceOrchestrator {
  private config: V13Config;
  private quorumValidator: QuorumValidator;
  private vetoController: VetoController;
  private confidenceEnforcer: ConfidenceEnforcer;
  private gateEvaluator: ExecutionGateEvaluator;
  private auditLogger: AuditLogger;
  
  constructor(config: Partial<V13Config> & { projectId: string }) {
    this.config = { ...DEFAULT_V13_CONFIG, ...config } as V13Config;
    
    this.quorumValidator = new QuorumValidator(this.config.quorumConfig);
    this.vetoController = new VetoController(this.config.vetoRules);
    this.confidenceEnforcer = new ConfidenceEnforcer(
      this.config.minimumConfidence,
      10, // unanimity bonus
    );
    this.gateEvaluator = new ExecutionGateEvaluator(this.config);
    this.auditLogger = new AuditLogger(this.config.projectId, this.config.auditActorId);
  }
  
  /**
   * Main entry point: Evaluate an action for auto-execution
   * 
   * Takes a completed debate output and risk classification,
   * applies v1.3 governance controls, and returns execution decision.
   */
  async evaluateAction(
    debateOutput: DebateOutput,
    riskClassification: RiskClassification,
    agentConfigs: AgentConfig[] = Object.values(DEFAULT_AGENT_CONFIGS)
  ): Promise<ExecutionDecision> {
    const startTime = Date.now();
    const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log debate start
    if (this.config.enableAuditTrail) {
      const enabledAgents = agentConfigs.filter(c => c.enabled).map(c => c.role);
      this.auditLogger.logDebateStart(
        debateOutput.id,
        debateOutput.actionId,
        enabledAgents
      );
    }
    
    // Step 1: Validate quorum
    const quorumEvaluation = this.quorumValidator.validateFromConfigs(agentConfigs);
    
    // Convert evaluations record to array for processing
    const evaluationsArray = Object.values(debateOutput.evaluations);
    
    // Step 2: Calculate confidence-weighted result
    const confidenceResult = this.confidenceEnforcer.calculateResult(
      evaluationsArray,
      riskClassification
    );
    
    // Step 3: Apply unanimity bonus
    const bonusResult = this.confidenceEnforcer.applyBonus(confidenceResult);
    
    // Create adjusted result with bonus applied
    const adjustedResult: ConfidenceWeightedResult = {
      ...confidenceResult,
      finalScore: bonusResult.adjustedScore,
    };
    
    // Step 4: Check for veto
    const vetoEvaluation = this.vetoController.evaluate(
      evaluationsArray,
      riskClassification
    );
    
    // Step 5: Evaluate execution gate
    const executionGate = this.gateEvaluator.evaluate(
      adjustedResult,
      quorumEvaluation,
      vetoEvaluation,
      debateOutput.conflictAnalysis
    );
    
    // Step 6: Log decision
    const auditEntries: AuditEntry[] = [];
    if (this.config.enableAuditTrail) {
      const decisionType = this.getDecisionType(executionGate);
      const entry = this.auditLogger.logExecutionDecision(
        debateOutput.actionId,
        decisionType,
        executionGate.blockingReasons[0] || 'All governance checks passed',
        {
          score: executionGate.confidenceWeightedScore,
          confidence: executionGate.aggregateConfidence,
          quorumMet: quorumEvaluation.quorumMet,
          vetoApplied: vetoEvaluation.vetoTriggered,
        }
      );
      auditEntries.push(entry);
      
      // Log debate completion
      this.auditLogger.logDebateComplete(
        debateOutput.id,
        debateOutput.actionId,
        executionGate.status,
        executionGate.confidenceWeightedScore
      );
    }
    
    return {
      id: decisionId,
      projectId: this.config.projectId,
      actionId: debateOutput.actionId,
      debateOutput,
      riskClassification,
      confidenceWeightedResult: adjustedResult,
      quorumEvaluation,
      vetoEvaluation,
      executionGate,
      auditEntries,
      decidedAt: new Date().toISOString(),
      decisionDurationMs: Date.now() - startTime,
    };
  }
  
  /**
   * Quick check if action can be auto-executed
   */
  canAutoExecute(decision: ExecutionDecision): boolean {
    return canAutoExecute(decision.executionGate);
  }
  
  /**
   * Get human-readable explanation of decision
   */
  explainDecision(decision: ExecutionDecision): string {
    let explanation = '# v1.3 Governance Decision\n\n';
    
    // Summary
    const status = decision.executionGate.status.replace(/_/g, ' ').toUpperCase();
    const emoji = decision.executionGate.canExecute ? '✅' : '❌';
    explanation += `## Result: ${emoji} ${status}\n\n`;
    
    // Action info
    explanation += `**Action ID**: ${decision.debateOutput.actionId}\n`;
    explanation += `**Project**: ${decision.debateOutput.projectId}\n\n`;
    
    // Governance checks
    explanation += `## Governance Checks\n\n`;
    explanation += `### 1. Quorum\n`;
    explanation += decision.quorumEvaluation.quorumMet 
      ? `✅ Quorum met (${decision.quorumEvaluation.enabledAgents}/${decision.quorumEvaluation.requiredAgents} agents)\n\n`
      : `❌ Quorum NOT met (${decision.quorumEvaluation.enabledAgents}/${decision.quorumEvaluation.requiredAgents} agents)\n\n`;
    
    explanation += `### 2. Veto\n`;
    if (decision.vetoEvaluation.vetoTriggered) {
      explanation += `❌ VETOED by ${decision.vetoEvaluation.vetoingAgent}\n`;
      explanation += `Reason: ${decision.vetoEvaluation.reason}\n\n`;
    } else {
      explanation += `✅ No veto triggered\n\n`;
    }
    
    explanation += `### 3. Confidence\n`;
    const confPassed = decision.confidenceWeightedResult.averageConfidence >= this.config.minimumConfidence;
    explanation += confPassed
      ? `✅ Average confidence ${decision.confidenceWeightedResult.averageConfidence.toFixed(1)}% meets minimum ${this.config.minimumConfidence}%\n\n`
      : `❌ Average confidence ${decision.confidenceWeightedResult.averageConfidence.toFixed(1)}% below minimum ${this.config.minimumConfidence}%\n\n`;
    
    explanation += `### 4. Conflicts\n`;
    const criticalConflicts = decision.debateOutput.conflictAnalysis.conflicts
      .filter(c => c.severity === 'critical');
    if (criticalConflicts.length > 0) {
      explanation += `❌ ${criticalConflicts.length} critical conflict(s) found:\n`;
      for (const conflict of criticalConflicts) {
        explanation += `  - ${conflict.description}\n`;
      }
      explanation += '\n';
    } else {
      explanation += `✅ No critical conflicts\n\n`;
    }
    
    // Score
    explanation += `## Final Score\n\n`;
    explanation += `- **Confidence-Weighted Score**: ${decision.confidenceWeightedResult.finalScore.toFixed(2)}\n`;
    explanation += `- **Approval Threshold**: ≥${this.config.approvalThreshold}\n`;
    explanation += `- **Rejection Threshold**: ≤${this.config.rejectionThreshold}\n\n`;
    
    // Agent votes
    explanation += `## Agent Votes\n\n`;
    for (const vote of decision.confidenceWeightedResult.votes) {
      const posEmoji = vote.position === 'support' ? '👍' : vote.position === 'oppose' ? '👎' : '🔄';
      explanation += `- **${vote.agentRole.toUpperCase()}**: ${posEmoji} ${vote.position.toUpperCase()} `;
      explanation += `(confidence: ${vote.confidence}%, contribution: ${vote.contributionPercent.toFixed(1)}%)\n`;
    }
    
    // Blocking reasons
    if (decision.executionGate.blockingReasons.length > 0) {
      explanation += `\n## ${decision.executionGate.canExecute ? 'Conditions' : 'Blocking Reasons'}\n\n`;
      for (const reason of decision.executionGate.blockingReasons) {
        explanation += `- ${reason}\n`;
      }
    }
    
    explanation += `\n---\nDecision ID: ${decision.id}\n`;
    explanation += `Evaluated at: ${decision.decidedAt}\n`;
    explanation += `Duration: ${decision.decisionDurationMs}ms\n`;
    
    return explanation;
  }
  
  /**
   * Override a veto (requires authorization)
   */
  overrideVeto(
    decision: ExecutionDecision,
    actorId: string,
    reason: string
  ): { success: boolean; newGate?: ExecutionGate; auditEntry?: AuditEntry } {
    if (!decision.vetoEvaluation.vetoTriggered) {
      return { success: false };
    }
    
    const canOverride = this.vetoController.canOverride(decision.vetoEvaluation);
    if (!canOverride.canOverride) {
      return { success: false };
    }
    
    // Create audit entry for override
    const auditEntry = this.vetoController.createOverrideAudit(
      this.config.projectId,
      actorId,
      decision.vetoEvaluation,
      reason
    );
    
    // Re-evaluate gate without veto
    const newVetoEvaluation: VetoEvaluation = {
      vetoTriggered: false,
      overridable: true,
      evaluatedAt: new Date().toISOString(),
    };
    
    const newGate = this.gateEvaluator.evaluate(
      decision.confidenceWeightedResult,
      decision.quorumEvaluation,
      newVetoEvaluation,
      decision.debateOutput.conflictAnalysis
    );
    
    return { success: true, newGate, auditEntry };
  }
  
  /**
   * Get audit trail
   */
  getAuditTrail(): AuditEntry[] {
    return this.auditLogger.getEntries();
  }
  
  /**
   * Verify audit trail integrity
   */
  verifyAuditIntegrity(): { valid: boolean; brokenAt?: number; reason?: string } {
    return this.auditLogger.verifyIntegrity();
  }
  
  /**
   * Update configuration (logged to audit trail)
   */
  updateConfig(
    updates: Partial<V13Config>,
    actorId: string,
    reason: string
  ): void {
    // Log threshold changes
    if (updates.minimumConfidence !== undefined && 
        updates.minimumConfidence !== this.config.minimumConfidence) {
      this.auditLogger.logThresholdChange(
        'minimumConfidence',
        this.config.minimumConfidence,
        updates.minimumConfidence,
        reason,
        actorId
      );
    }
    
    if (updates.approvalThreshold !== undefined && 
        updates.approvalThreshold !== this.config.approvalThreshold) {
      this.auditLogger.logThresholdChange(
        'approvalThreshold',
        this.config.approvalThreshold,
        updates.approvalThreshold,
        reason,
        actorId
      );
    }
    
    if (updates.rejectionThreshold !== undefined && 
        updates.rejectionThreshold !== this.config.rejectionThreshold) {
      this.auditLogger.logThresholdChange(
        'rejectionThreshold',
        this.config.rejectionThreshold,
        updates.rejectionThreshold,
        reason,
        actorId
      );
    }
    
    // Apply updates
    this.config = { ...this.config, ...updates };
    this.gateEvaluator.updateConfig(this.config);
    
    if (updates.quorumConfig) {
      this.quorumValidator.updateConfig(updates.quorumConfig);
    }
    
    if (updates.minimumConfidence) {
      this.confidenceEnforcer.setMinimumConfidence(updates.minimumConfidence);
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): V13Config {
    return { ...this.config };
  }
  
  private getDecisionType(gate: ExecutionGate): 'approved' | 'rejected' | 'vetoed' | 'blocked' {
    switch (gate.status) {
      case ExecutionGateStatus.APPROVED:
      case ExecutionGateStatus.APPROVED_WITH_CONDITIONS:
        return 'approved';
      case ExecutionGateStatus.REJECTED:
        return 'rejected';
      case ExecutionGateStatus.BLOCKED_BY_VETO:
        return 'vetoed';
      default:
        return 'blocked';
    }
  }
}

/**
 * Factory function for quick setup
 */
export function createGovernanceOrchestrator(
  projectId: string,
  overrides: Partial<V13Config> = {}
): GovernanceOrchestrator {
  return new GovernanceOrchestrator({ projectId, ...overrides });
}
