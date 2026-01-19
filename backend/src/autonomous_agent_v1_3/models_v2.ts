/**
 * Autonomous SEO Agent v1.3 - Models (Confidence-Weighted Auto-Execution)
 * 
 * This module defines all types for the confidence-weighted execution system.
 * 
 * Key Concepts:
 * - Confidence Score: 0.0-1.0 representing certainty of action success
 * - Execution Mode: AUTO, PARTIAL, MANUAL based on confidence
 * - Partial Execution: Limited scope execution for medium confidence
 * - Calibration: Rule-based adjustment after observing outcomes
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import { RiskLevel, RiskClassification } from '../autonomous_agent_v1_1/models';
import { DebateOutput, AgentRole, AgentPosition } from '../debate_engine/models';

// ============================================================================
// CONFIDENCE SCORE
// ============================================================================

/**
 * Confidence score with full breakdown for transparency
 */
export interface ConfidenceScore {
  /** Final confidence score (0.0-1.0) */
  overall: number;
  
  /** Individual factor scores */
  factors: ConfidenceFactors;
  
  /** Weights applied to each factor */
  weights: ConfidenceWeights;
  
  /** Calculation breakdown for explainability */
  breakdown: ConfidenceBreakdown[];
  
  /** Timestamp of calculation */
  calculatedAt: string;
  
  /** Version of scoring algorithm */
  algorithmVersion: string;
}

/**
 * Individual confidence factors (each 0.0-1.0)
 */
export interface ConfidenceFactors {
  /** How fresh and complete is the input data? */
  dataQuality: number;
  
  /** How strong is the multi-agent debate consensus? */
  consensusStrength: number;
  
  /** Historical success rate for similar actions */
  historicalSuccess: number;
  
  /** Inverse of action scope size (smaller = higher confidence) */
  scopeConfidence: number;
  
  /** Safety margin from policy limits */
  safetyMargin: number;
}

/**
 * Configurable weights for confidence factors
 * Must sum to 1.0
 */
export interface ConfidenceWeights {
  dataQuality: number;
  consensusStrength: number;
  historicalSuccess: number;
  scopeConfidence: number;
  safetyMargin: number;
}

/**
 * Default weights - balanced across factors
 */
export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  dataQuality: 0.20,
  consensusStrength: 0.25,
  historicalSuccess: 0.25,
  scopeConfidence: 0.15,
  safetyMargin: 0.15,
};

/**
 * Breakdown item for explainability
 */
export interface ConfidenceBreakdown {
  factor: keyof ConfidenceFactors;
  rawScore: number;
  weight: number;
  weightedScore: number;
  explanation: string;
  evidence: string[];
}

// ============================================================================
// EXECUTION MODE
// ============================================================================

/**
 * Execution modes based on confidence level
 */
export enum ExecutionMode {
  /** Full auto-execution (confidence >= 0.80, low-risk only) */
  FULL_AUTO = 'full_auto',
  
  /** Partial auto-execution (0.60 <= confidence < 0.80) */
  PARTIAL_AUTO = 'partial_auto',
  
  /** No auto-execution, requires manual approval */
  MANUAL_ONLY = 'manual_only',
  
  /** Blocked - cannot execute regardless of confidence */
  BLOCKED = 'blocked',
}

/**
 * Thresholds for execution mode determination
 */
export interface ExecutionThresholds {
  /** Minimum confidence for any auto-execution */
  partialAutoMin: number;
  
  /** Minimum confidence for full auto-execution */
  fullAutoMin: number;
  
  /** Maximum risk level for full auto */
  maxRiskForFullAuto: RiskLevel;
  
  /** Maximum risk level for partial auto */
  maxRiskForPartialAuto: RiskLevel;
}

export const DEFAULT_EXECUTION_THRESHOLDS: ExecutionThresholds = {
  partialAutoMin: 0.60,
  fullAutoMin: 0.80,
  maxRiskForFullAuto: RiskLevel.LOW,
  maxRiskForPartialAuto: RiskLevel.MEDIUM,
};

/**
 * Result of execution mode resolution
 */
export interface ExecutionModeResult {
  mode: ExecutionMode;
  confidenceScore: ConfidenceScore;
  riskLevel: RiskLevel;
  
  /** Why this mode was chosen */
  rationale: string[];
  
  /** Constraints if partial execution */
  partialConstraints?: PartialExecutionConstraints;
  
  /** What's blocked and why */
  blockedReasons?: string[];
  
  resolvedAt: string;
}

// ============================================================================
// PARTIAL EXECUTION
// ============================================================================

/**
 * Constraints for partial auto-execution
 */
export interface PartialExecutionConstraints {
  /** Maximum % of content that can be changed */
  maxContentChangePercent: number;
  
  /** Maximum number of internal links to add */
  maxInternalLinks: number;
  
  /** Maximum number of pages to affect */
  maxPagesAffected: number;
  
  /** Execute on sample pages only */
  samplePagesOnly: boolean;
  
  /** Sample size if samplePagesOnly is true */
  sampleSize?: number;
  
  /** IDs of specific pages to execute on (if sampling) */
  allowedPageIds?: string[];
  
  /** Remaining scope flagged for manual approval */
  manualApprovalRequired: ManualApprovalItem[];
}

/**
 * Item flagged for manual approval after partial execution
 */
export interface ManualApprovalItem {
  description: string;
  scope: string;
  reason: string;
  estimatedImpact: 'low' | 'medium' | 'high';
}

/**
 * Result of partial execution
 */
export interface PartialExecutionResult {
  actionId: string;
  executedScope: ExecutedScope;
  remainingScope: RemainingScope;
  constraints: PartialExecutionConstraints;
  executedAt: string;
  durationMs: number;
}

export interface ExecutedScope {
  pagesAffected: number;
  contentChangePercent: number;
  linksAdded: number;
  details: Record<string, unknown>;
}

export interface RemainingScope {
  pagesRemaining: number;
  itemsFlaggedForManual: ManualApprovalItem[];
  estimatedRemainingWork: string;
}

// ============================================================================
// DATA QUALITY EVALUATION
// ============================================================================

/**
 * Input for data quality evaluation
 */
export interface DataQualityInput {
  /** Age of the data in hours */
  dataAgeHours: number;
  
  /** Percentage of required fields present */
  completenessPercent: number;
  
  /** Number of data sources used */
  sourceCount: number;
  
  /** Whether data has been validated */
  validated: boolean;
  
  /** Any known data quality issues */
  knownIssues: string[];
}

/**
 * Result of data quality evaluation
 */
export interface DataQualityResult {
  score: number;
  freshness: { score: number; ageHours: number; maxAcceptableHours: number };
  completeness: { score: number; percent: number };
  sourceReliability: { score: number; sourceCount: number };
  validation: { score: number; validated: boolean };
  issues: string[];
  explanation: string;
}

// ============================================================================
// CONSENSUS EVALUATION
// ============================================================================

/**
 * Input for consensus strength evaluation
 */
export interface ConsensusInput {
  debateOutput: DebateOutput;
  
  /** Positions taken by each agent */
  agentPositions: Record<AgentRole, AgentPosition>;
  
  /** Confidence levels from each agent */
  agentConfidences: Record<AgentRole, number>;
  
  /** Whether there were critical conflicts */
  hasCriticalConflicts: boolean;
  
  /** Number of debate rounds */
  debateRounds: number;
}

/**
 * Result of consensus evaluation
 */
export interface ConsensusResult {
  score: number;
  unanimity: { score: number; allAgree: boolean };
  confidenceAlignment: { score: number; spread: number };
  conflictPenalty: { penalty: number; hasCritical: boolean };
  explanation: string;
}

// ============================================================================
// HISTORICAL SUCCESS EVALUATION
// ============================================================================

/**
 * Historical action record for success rate calculation
 */
export interface HistoricalAction {
  actionId: string;
  actionType: ActionType;
  riskLevel: RiskLevel;
  confidenceAtExecution: number;
  outcome: ActionOutcome;
  executedAt: string;
  projectId: string;
  targetUrl?: string;
}

export enum ActionOutcome {
  SUCCESS = 'success',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  ROLLED_BACK = 'rolled_back',
}

/**
 * Input for historical success evaluation
 */
export interface HistoricalInput {
  /** Similar actions from history */
  similarActions: HistoricalAction[];
  
  /** Current action type */
  actionType: ActionType;
  
  /** Current risk level */
  riskLevel: RiskLevel;
  
  /** Minimum sample size for reliable stats */
  minSampleSize: number;
}

/**
 * Result of historical success evaluation
 */
export interface HistoricalResult {
  score: number;
  sampleSize: number;
  successRate: number;
  neutralRate: number;
  negativeRate: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient_data';
  explanation: string;
}

// ============================================================================
// SCOPE EVALUATION
// ============================================================================

/**
 * Input for scope size evaluation
 */
export interface ScopeInput {
  /** Number of pages affected */
  pagesAffected: number;
  
  /** Total pages in site */
  totalSitePages: number;
  
  /** Estimated content change percentage */
  contentChangePercent: number;
  
  /** Whether changes are reversible */
  reversible: boolean;
  
  /** Scope type */
  scopeType: 'single_element' | 'single_page' | 'multiple_pages' | 'site_wide';
}

/**
 * Result of scope evaluation
 */
export interface ScopeResult {
  score: number;
  coverage: { score: number; percent: number };
  changeSize: { score: number; percent: number };
  reversibility: { score: number; reversible: boolean };
  explanation: string;
}

// ============================================================================
// SAFETY MARGIN EVALUATION
// ============================================================================

/**
 * Input for safety margin evaluation
 */
export interface SafetyInput {
  /** Current risk score (0-100) */
  riskScore: number;
  
  /** Maximum allowed risk score from policy */
  policyMaxRisk: number;
  
  /** Whether action respects all policy limits */
  respectsPolicyLimits: boolean;
  
  /** Distance from policy boundaries */
  policyMargins: PolicyMargin[];
}

export interface PolicyMargin {
  policyName: string;
  currentValue: number;
  limitValue: number;
  marginPercent: number;
}

/**
 * Result of safety margin evaluation
 */
export interface SafetyResult {
  score: number;
  riskBuffer: { score: number; buffer: number };
  policyCompliance: { score: number; compliant: boolean };
  marginAnalysis: PolicyMargin[];
  explanation: string;
}

// ============================================================================
// CONFIDENCE CALIBRATION
// ============================================================================

/**
 * Calibration rule for adjusting confidence
 */
export interface CalibrationRule {
  id: string;
  name: string;
  description: string;
  
  /** Condition for rule to apply */
  condition: CalibrationCondition;
  
  /** Adjustment to apply */
  adjustment: CalibrationAdjustment;
  
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalibrationCondition {
  /** Action type to match (or 'any') */
  actionType: ActionType | 'any';
  
  /** Risk level to match (or 'any') */
  riskLevel: RiskLevel | 'any';
  
  /** Minimum sample size for rule to apply */
  minSampleSize: number;
  
  /** Outcome pattern to match */
  outcomePattern: OutcomePattern;
}

export interface OutcomePattern {
  /** Required success rate (or undefined to ignore) */
  successRateBelow?: number;
  successRateAbove?: number;
  
  /** Required negative rate (or undefined to ignore) */
  negativeRateBelow?: number;
  negativeRateAbove?: number;
}

export interface CalibrationAdjustment {
  /** Factor to adjust (or 'overall' for final score) */
  targetFactor: keyof ConfidenceFactors | 'overall';
  
  /** Type of adjustment */
  type: 'multiply' | 'add' | 'cap';
  
  /** Value to apply */
  value: number;
  
  /** Reason for adjustment */
  reason: string;
}

/**
 * Outcome observation for calibration
 */
export interface OutcomeObservation {
  actionId: string;
  projectId: string;
  outcome: ActionOutcome;
  confidenceAtExecution: ConfidenceScore;
  observedAt: string;
  
  /** Metrics before/after for impact analysis */
  metricsBefore?: Record<string, number>;
  metricsAfter?: Record<string, number>;
  
  /** Any notes about the outcome */
  notes?: string;
}

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

/**
 * Confidence audit log entry
 */
export interface ConfidenceAuditEntry {
  id: string;
  timestamp: string;
  actionId: string;
  projectId: string;
  
  /** Full confidence score */
  confidenceScore: ConfidenceScore;
  
  /** Resolved execution mode */
  executionMode: ExecutionMode;
  
  /** Rationale for decision */
  rationale: string[];
  
  /** Risk classification used */
  riskClassification: RiskClassification;
  
  /** Calibration rules applied */
  calibrationRulesApplied: string[];
  
  /** Actor who triggered (system or user ID) */
  actorId: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Full v1.3 configuration
 */
export interface V13ConfidenceConfig {
  projectId: string;
  
  /** Weights for confidence factors */
  weights: ConfidenceWeights;
  
  /** Thresholds for execution mode */
  thresholds: ExecutionThresholds;
  
  /** Default partial execution constraints */
  defaultPartialConstraints: PartialExecutionConstraints;
  
  /** Calibration rules */
  calibrationRules: CalibrationRule[];
  
  /** Data freshness limits */
  dataFreshnessMaxHours: number;
  
  /** Minimum history sample size */
  minHistorySampleSize: number;
  
  /** Enable audit logging */
  enableAuditLogging: boolean;
}

export const DEFAULT_V13_CONFIDENCE_CONFIG: Omit<V13ConfidenceConfig, 'projectId'> = {
  weights: DEFAULT_CONFIDENCE_WEIGHTS,
  thresholds: DEFAULT_EXECUTION_THRESHOLDS,
  defaultPartialConstraints: {
    maxContentChangePercent: 10,
    maxInternalLinks: 3,
    maxPagesAffected: 5,
    samplePagesOnly: true,
    sampleSize: 3,
    manualApprovalRequired: [],
  },
  calibrationRules: [],
  dataFreshnessMaxHours: 24,
  minHistorySampleSize: 10,
  enableAuditLogging: true,
};

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { SEOAction, ActionType } from '../autonomous_agent/models';
export { RiskLevel, RiskClassification } from '../autonomous_agent_v1_1/models';
export { DebateOutput, AgentRole, AgentPosition } from '../debate_engine/models';
