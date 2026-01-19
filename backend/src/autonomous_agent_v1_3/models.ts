/**
 * Autonomous SEO Agent v1.3 - Models
 * 
 * Confidence-Weighted Auto-Execution with Governance Controls
 * 
 * Key Features:
 * - Confidence-weighted decision scoring
 * - Risk Agent veto power for HIGH+ risk
 * - Quorum requirements (2/3 agents minimum)
 * - Immutable audit trail
 * - Symmetric score mapping
 * - Enforced minimum confidence threshold
 * 
 * Addresses v1.2 Governance Review findings:
 * - Risk agent can no longer be outvoted on HIGH-risk actions
 * - Disabled agents trigger quorum failure
 * - Weight changes are audited
 * - Critical conflicts block approval
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import { RiskClassification, RiskLevel } from '../autonomous_agent_v1_1/models';
import { 
  AgentRole, 
  AgentPosition, 
  AgentEvaluation,
  DebateDecision,
  DebateOutput,
  ConflictAnalysis,
} from '../debate_engine/models';

// ============================================================================
// EXECUTION GATE - The core v1.3 innovation
// ============================================================================

export enum ExecutionGateStatus {
  APPROVED = 'approved',                    // Clear to execute
  APPROVED_WITH_CONDITIONS = 'approved_with_conditions', // Execute with modifications
  BLOCKED_BY_VETO = 'blocked_by_veto',     // Risk agent veto
  BLOCKED_BY_QUORUM = 'blocked_by_quorum', // Not enough agents
  BLOCKED_BY_CONFIDENCE = 'blocked_by_confidence', // Below threshold
  BLOCKED_BY_CONFLICT = 'blocked_by_conflict', // Critical conflict
  REJECTED = 'rejected',                    // Normal rejection
}

export interface ExecutionGate {
  status: ExecutionGateStatus;
  canExecute: boolean;
  
  // Confidence-weighted scoring
  confidenceWeightedScore: number; // -100 to +100
  aggregateConfidence: number; // 0-100
  
  // Governance checks
  quorumMet: boolean;
  enabledAgentCount: number;
  minimumAgentsRequired: number;
  
  // Veto status
  vetoApplied: boolean;
  vetoAgent?: AgentRole;
  vetoReason?: string;
  
  // Thresholds
  appliedThresholds: AppliedThresholds;
  
  // Blocking reasons
  blockingReasons: string[];
  
  // Audit
  gateEvaluatedAt: string;
  gateId: string;
}

export interface AppliedThresholds {
  minimumConfidence: number;
  approvalThreshold: number;
  rejectionThreshold: number;
  vetoThreshold: number; // Risk score above which veto applies
  quorumPercentage: number;
}

// ============================================================================
// CONFIDENCE-WEIGHTED VOTE
// ============================================================================

export interface ConfidenceWeightedVote {
  agentRole: AgentRole;
  position: AgentPosition;
  
  // Raw scores
  rawScore: number; // -100 to +100 (symmetric!)
  confidence: number; // 0-100
  
  // Weighted calculation
  baseWeight: number;
  effectiveWeight: number; // baseWeight * (confidence/100)
  weightedScore: number; // rawScore * effectiveWeight
  
  // Contribution to final score
  contributionPercent: number;
}

export interface ConfidenceWeightedResult {
  votes: ConfidenceWeightedVote[];
  
  // Final scores
  finalScore: number; // -100 to +100
  totalEffectiveWeight: number;
  averageConfidence: number;
  
  // Position summary
  supportCount: number;
  opposeCount: number;
  modifyCount: number;
  
  // Confidence analysis
  highConfidenceVotes: number; // confidence >= 70
  lowConfidenceVotes: number; // confidence < 50
  confidenceSpread: number; // max - min confidence
  
  calculatedAt: string;
}

// ============================================================================
// VETO SYSTEM
// ============================================================================

export interface VetoRule {
  id: string;
  agentRole: AgentRole;
  triggerCondition: VetoTriggerCondition;
  enabled: boolean;
  description: string;
}

export enum VetoTriggerCondition {
  // Risk-based triggers
  HIGH_RISK_OPPOSE = 'high_risk_oppose',         // Risk agent opposes + HIGH risk
  CRITICAL_RISK_ANY = 'critical_risk_any',       // Any CRITICAL risk action
  
  // Score-based triggers
  RISK_SCORE_ABOVE_THRESHOLD = 'risk_score_above_threshold',
  
  // Confidence-based triggers
  HIGH_CONFIDENCE_OPPOSE = 'high_confidence_oppose', // Oppose with 80%+ confidence
}

export interface VetoEvaluation {
  vetoTriggered: boolean;
  triggeringRule?: VetoRule;
  vetoingAgent?: AgentRole;
  reason?: string;
  overridable: boolean; // Can human override?
  evaluatedAt: string;
}

export const DEFAULT_VETO_RULES: VetoRule[] = [
  {
    id: 'risk_high_oppose',
    agentRole: AgentRole.RISK,
    triggerCondition: VetoTriggerCondition.HIGH_RISK_OPPOSE,
    enabled: true,
    description: 'Risk agent can veto HIGH-risk actions when opposing',
  },
  {
    id: 'risk_high_confidence',
    agentRole: AgentRole.RISK,
    triggerCondition: VetoTriggerCondition.HIGH_CONFIDENCE_OPPOSE,
    enabled: true,
    description: 'Risk agent veto when opposing with 80%+ confidence',
  },
];

// ============================================================================
// QUORUM SYSTEM
// ============================================================================

export interface QuorumConfig {
  minimumAgents: number; // Absolute minimum (default: 2)
  minimumPercentage: number; // Percentage of total agents (default: 66.67%)
  requireRiskAgent: boolean; // Risk agent must be enabled (default: true)
}

export const DEFAULT_QUORUM_CONFIG: QuorumConfig = {
  minimumAgents: 2,
  minimumPercentage: 66.67,
  requireRiskAgent: true,
};

export interface QuorumEvaluation {
  quorumMet: boolean;
  totalAgents: number;
  enabledAgents: number;
  requiredAgents: number;
  missingAgents: AgentRole[];
  riskAgentPresent: boolean;
  evaluatedAt: string;
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  actorId: string; // 'system' or user ID
  projectId: string;
  
  // Event details
  details: Record<string, unknown>;
  
  // Before/after for changes
  previousValue?: unknown;
  newValue?: unknown;
  
  // Immutability
  checksum: string;
  previousEntryChecksum?: string;
}

export enum AuditEventType {
  // Weight changes
  WEIGHT_CHANGED = 'weight_changed',
  THRESHOLD_CHANGED = 'threshold_changed',
  
  // Agent changes
  AGENT_ENABLED = 'agent_enabled',
  AGENT_DISABLED = 'agent_disabled',
  
  // Execution events
  EXECUTION_APPROVED = 'execution_approved',
  EXECUTION_REJECTED = 'execution_rejected',
  EXECUTION_VETOED = 'execution_vetoed',
  EXECUTION_BLOCKED = 'execution_blocked',
  
  // Veto events
  VETO_RULE_ADDED = 'veto_rule_added',
  VETO_RULE_REMOVED = 'veto_rule_removed',
  VETO_OVERRIDE = 'veto_override',
  
  // Debate events
  DEBATE_STARTED = 'debate_started',
  DEBATE_COMPLETED = 'debate_completed',
}

// ============================================================================
// EXECUTION DECISION
// ============================================================================

export interface ExecutionDecision {
  id: string;
  projectId: string;
  actionId: string;
  
  // Input
  debateOutput: DebateOutput;
  riskClassification: RiskClassification;
  
  // Confidence-weighted calculation
  confidenceWeightedResult: ConfidenceWeightedResult;
  
  // Governance checks
  quorumEvaluation: QuorumEvaluation;
  vetoEvaluation: VetoEvaluation;
  
  // Final gate
  executionGate: ExecutionGate;
  
  // Audit
  auditEntries: AuditEntry[];
  
  // Metadata
  decidedAt: string;
  decisionDurationMs: number;
}

// ============================================================================
// V1.3 CONFIGURATION
// ============================================================================

export interface V13Config {
  projectId: string;
  
  // Confidence thresholds
  minimumConfidence: number; // Minimum avg confidence to proceed (default: 60)
  highConfidenceThreshold: number; // What counts as high confidence (default: 70)
  
  // Score thresholds (symmetric: -100 to +100)
  approvalThreshold: number; // Score above which to approve (default: 20)
  rejectionThreshold: number; // Score below which to reject (default: -20)
  
  // Quorum
  quorumConfig: QuorumConfig;
  
  // Veto rules
  vetoRules: VetoRule[];
  
  // Feature flags
  enableVetoSystem: boolean;
  enableQuorumCheck: boolean;
  enableConfidenceWeighting: boolean;
  enableAuditTrail: boolean;
  
  // Audit
  auditActorId: string; // Default actor for system events
}

export const DEFAULT_V13_CONFIG: Omit<V13Config, 'projectId'> = {
  minimumConfidence: 60,
  highConfidenceThreshold: 70,
  approvalThreshold: 20,
  rejectionThreshold: -20,
  quorumConfig: DEFAULT_QUORUM_CONFIG,
  vetoRules: DEFAULT_VETO_RULES,
  enableVetoSystem: true,
  enableQuorumCheck: true,
  enableConfidenceWeighting: true,
  enableAuditTrail: true,
  auditActorId: 'system',
};

// ============================================================================
// SYMMETRIC SCORE MAPPING (v1.2 fix)
// ============================================================================

/**
 * v1.2 had asymmetric mapping: SUPPORT=100, MODIFY=50, OPPOSE=0
 * This biased toward approval.
 * 
 * v1.3 uses symmetric mapping: SUPPORT=+100, MODIFY=0, OPPOSE=-100
 * Now MODIFY is truly neutral.
 */
export const SYMMETRIC_POSITION_SCORES: Record<AgentPosition, number> = {
  [AgentPosition.SUPPORT]: 100,
  [AgentPosition.MODIFY]: 0,
  [AgentPosition.OPPOSE]: -100,
};

// ============================================================================
// RE-EXPORTS from debate engine
// ============================================================================

export {
  AgentRole,
  AgentPosition,
  AgentEvaluation,
  DebateDecision,
  DebateOutput,
  ConflictAnalysis,
} from '../debate_engine/models';

export { RiskClassification } from '../autonomous_agent_v1_1/models';
export { SEOAction, ActionType } from '../autonomous_agent/models';

// Extended RiskLevel with CRITICAL for v1.3
// (v1.1 only had LOW, MEDIUM, HIGH)
export enum ExtendedRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical', // New in v1.3
}

// Helper to convert v1.1 RiskLevel to ExtendedRiskLevel
export function toExtendedRiskLevel(level: string): ExtendedRiskLevel {
  switch (level) {
    case 'low': return ExtendedRiskLevel.LOW;
    case 'medium': return ExtendedRiskLevel.MEDIUM;
    case 'high': return ExtendedRiskLevel.HIGH;
    default: return ExtendedRiskLevel.HIGH; // Default to HIGH for unknown
  }
}

// Check if risk score indicates CRITICAL (score >= 90)
export function isCriticalRisk(score: number): boolean {
  return score >= 90;
}

// Get extended risk level from score
export function getExtendedRiskLevel(score: number): ExtendedRiskLevel {
  if (score >= 90) return ExtendedRiskLevel.CRITICAL;
  if (score >= 70) return ExtendedRiskLevel.HIGH;
  if (score >= 30) return ExtendedRiskLevel.MEDIUM;
  return ExtendedRiskLevel.LOW;
}
