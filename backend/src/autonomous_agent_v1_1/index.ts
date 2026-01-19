/**
 * Autonomous SEO Agent v1.1 - Module Exports
 * 
 * Auto-execute Low-risk Actions
 * 
 * This module provides safe, controlled auto-execution of LOW-risk SEO actions
 * with full audit trail, rollback capability, and policy enforcement.
 * 
 * Key Principles:
 * - ONLY LOW-risk actions are auto-executed
 * - NEVER execute MEDIUM or HIGH risk automatically
 * - Full traceability for all operations
 * - Automatic rollback on failure
 * - Deterministic, explainable decisions
 */

// Main orchestrator
export { AutonomousSEOAgentV1_1, default } from './main';

// Core components
export { RiskClassifier } from './risk_classifier';
export { PolicyEngine, PolicyCheckResult, PolicyViolation, PolicyWarning } from './policy_engine';
export { PreExecutionValidator } from './pre_execution_validator';
export { AutoExecutor } from './auto_executor';
export { PostExecutionVerifier } from './post_execution_verifier';
export { RollbackManager } from './rollback_manager';
export { AuditLogger } from './audit_logger';

// Types and models
export {
  // Risk types
  RiskLevel,
  RiskClassification,
  RiskFactor,
  RISK_THRESHOLDS,
  
  // Policy types
  ExecutionPolicy,
  DEFAULT_EXECUTION_POLICY,
  
  // Validation types
  ValidationResult,
  ValidationCheck,
  
  // Execution types
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
  ExecutionChange,
  ExecutionError,
  ExecutionSnapshot,
  ExecutionOutcome,
  
  // Verification types
  VerificationResult,
  VerificationCheck,
  
  // Rollback types
  Snapshot,
  RollbackRequest,
  RollbackResult,
  
  // Audit types
  AuditLogEntry,
  AuditEventType,
  
  // Adapter interfaces
  CMSAdapter,
  PageContent,
  ContentStorageAdapter,
  
  // Report types
  ExecutionReport,
} from './models';

// Re-export base types from v1.0 for convenience
export {
  SEOAction,
  ActionType,
  SEOGoal,
  SEOGoalType,
  AgentSource,
} from '../autonomous_agent/models';
