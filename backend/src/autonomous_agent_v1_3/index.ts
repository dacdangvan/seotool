/**
 * Autonomous SEO Agent v1.3 - Confidence-Weighted Auto-Execution
 * 
 * This module provides governance controls for automated SEO actions
 * with confidence-weighted decision making.
 * 
 * Key Features:
 * - Quorum requirements (minimum 2/3 agents)
 * - Risk Agent veto power for HIGH+ risk
 * - Confidence-weighted scoring
 * - Immutable audit trail
 * - Symmetric score mapping
 * 
 * Addresses v1.2 Governance Review findings:
 * ✅ Risk agent veto power (can't be outvoted on HIGH-risk)
 * ✅ Quorum requirement (2/3 agents minimum)
 * ✅ Audit trail for weight changes
 * ✅ Critical conflicts block approval
 * ✅ Enforced minimumConfidence threshold
 * ✅ Applied unanimityBonus
 * ✅ Symmetric score mapping (SUPPORT +100, MODIFY 0, OPPOSE -100)
 * 
 * Usage:
 * ```typescript
 * import { GovernanceOrchestrator, createGovernanceOrchestrator } from './autonomous_agent_v1_3';
 * 
 * // Create orchestrator
 * const orchestrator = createGovernanceOrchestrator('project-123');
 * 
 * // Evaluate action (after v1.2 debate completes)
 * const decision = await orchestrator.evaluateAction(debateOutput, riskClassification);
 * 
 * // Check if auto-execution is allowed
 * if (orchestrator.canAutoExecute(decision)) {
 *   // Safe to execute
 * } else {
 *   // Requires human review
 *   console.log(orchestrator.explainDecision(decision));
 * }
 * ```
 */

// ============================================================================
// MODELS & TYPES
// ============================================================================

export {
  // Execution Gate
  ExecutionGateStatus,
  ExecutionGate,
  AppliedThresholds,
  
  // Confidence Weighting
  ConfidenceWeightedVote,
  ConfidenceWeightedResult,
  
  // Veto System
  VetoRule,
  VetoEvaluation,
  VetoTriggerCondition,
  DEFAULT_VETO_RULES,
  
  // Quorum System
  QuorumConfig,
  QuorumEvaluation,
  DEFAULT_QUORUM_CONFIG,
  
  // Audit Trail
  AuditEntry,
  AuditEventType,
  
  // Configuration
  V13Config,
  DEFAULT_V13_CONFIG,
  
  // Execution Decision
  ExecutionDecision,
  
  // Extended Risk Levels
  ExtendedRiskLevel,
  toExtendedRiskLevel,
  isCriticalRisk,
  getExtendedRiskLevel,
  
  // Symmetric Score Mapping
  SYMMETRIC_POSITION_SCORES,
  
  // Re-exports from v1.1/v1.2
  AgentRole,
  AgentPosition,
  RiskClassification,
} from './models';

// ============================================================================
// QUORUM VALIDATOR
// ============================================================================

export {
  QuorumValidator,
  validateQuorum,
  validateQuorumFromConfigs,
  explainQuorumStatus,
  canDisableAgent,
  getMinimumRequiredAgents,
} from './quorum_validator';

// ============================================================================
// VETO CONTROLLER
// ============================================================================

export {
  VetoController,
  evaluateVeto,
  canOverrideVeto,
  createVetoOverrideAuditEntry,
  getActiveVetoRules,
  explainVetoEvaluation,
} from './veto_controller';

// ============================================================================
// CONFIDENCE ENFORCER
// ============================================================================

export {
  ConfidenceEnforcer,
  calculateConfidenceWeightedVotes,
  calculateConfidenceWeightedResult,
  applyUnanimityBonus,
  checkMinimumConfidence,
  explainConfidenceWeighting,
} from './confidence_enforcer';

// ============================================================================
// EXECUTION GATE
// ============================================================================

export {
  ExecutionGateEvaluator,
  evaluateExecutionGate,
  explainGateDecision,
  canAutoExecute,
  getGateSummary,
} from './execution_gate';

// ============================================================================
// AUDIT LOGGER
// ============================================================================

export {
  AuditLogger,
  calculateChecksum,
  verifyChecksum,
  verifyAuditChain,
  createAuditEntry,
  createWeightChangeEntry,
  createThresholdChangeEntry,
  createAgentStateChangeEntry,
  createExecutionDecisionEntry,
  createDebateStartEntry,
  createDebateCompleteEntry,
} from './audit_logger';

// ============================================================================
// GOVERNANCE ORCHESTRATOR (Main Entry Point)
// ============================================================================

export {
  GovernanceOrchestrator,
  createGovernanceOrchestrator,
} from './governance_orchestrator';
