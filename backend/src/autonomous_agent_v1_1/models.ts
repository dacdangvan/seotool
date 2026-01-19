/**
 * Autonomous SEO Agent v1.1 - Models
 * 
 * Type definitions for auto-execution of low-risk actions
 * 
 * Key principles:
 * - Only LOW-risk actions auto-execute
 * - Full auditability
 * - Reversible execution
 * - Deterministic classification
 */

import { SEOAction, ActionType, AgentSource } from '../autonomous_agent/models';

// ============================================================================
// RISK CLASSIFICATION
// ============================================================================

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface RiskClassification {
  actionId: string;
  level: RiskLevel;
  score: number; // 0-100, higher = more risky
  factors: RiskFactor[];
  explanation: string;
  autoExecutable: boolean;
  classifiedAt: string;
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number; // 0-100
  reason: string;
}

// Risk thresholds
export const RISK_THRESHOLDS = {
  LOW_MAX: 30,      // 0-30 = LOW
  MEDIUM_MAX: 70,   // 31-70 = MEDIUM
  // 71-100 = HIGH
} as const;

// ============================================================================
// EXECUTION POLICY
// ============================================================================

export interface ExecutionPolicy {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;

  // Auto-execution settings
  autoExecution: {
    enabled: boolean;
    maxActionsPerDay: number;
    maxActionsPerHour: number;
    allowedRiskLevels: RiskLevel[];
    requireConfidenceScore: number; // 0-100, minimum required
  };

  // Content modification limits
  contentLimits: {
    maxPercentChangePerPage: number; // e.g., 20 = max 20% change
    maxWordsAddedPerPage: number;
    maxWordsRemovedPerPage: number;
    forbiddenSections: string[]; // CSS selectors or markers
  };

  // Link limits
  linkLimits: {
    maxInternalLinksPerPage: number;
    maxNewLinksPerExecution: number;
    forbiddenLinkTargets: string[]; // URL patterns
  };

  // Allowed action types for auto-execution
  allowedActionTypes: ActionType[];

  // Time restrictions
  timeRestrictions: {
    allowedDays: number[]; // 0-6, Sunday = 0
    allowedHoursStart: number; // 0-23
    allowedHoursEnd: number; // 0-23
    timezone: string;
  };

  // Cooldown settings
  cooldown: {
    minSecondsBetweenActions: number;
    minSecondsBetweenSamePageActions: number;
  };
}

export const DEFAULT_EXECUTION_POLICY: Omit<ExecutionPolicy, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> = {
  name: 'Default Low-Risk Policy',
  enabled: true,
  autoExecution: {
    enabled: true,
    maxActionsPerDay: 20,
    maxActionsPerHour: 5,
    allowedRiskLevels: [RiskLevel.LOW],
    requireConfidenceScore: 80,
  },
  contentLimits: {
    maxPercentChangePerPage: 15,
    maxWordsAddedPerPage: 100,
    maxWordsRemovedPerPage: 50,
    forbiddenSections: ['header', 'footer', 'nav', '.no-auto-edit'],
  },
  linkLimits: {
    maxInternalLinksPerPage: 5,
    maxNewLinksPerExecution: 2,
    forbiddenLinkTargets: ['/admin', '/api', '/auth', '/checkout', '/cart'],
  },
  allowedActionTypes: [
    ActionType.OPTIMIZE_CONTENT,
    ActionType.ADD_INTERNAL_LINK,
    ActionType.FIX_SCHEMA_MARKUP,
    ActionType.OPTIMIZE_ANCHOR_TEXT,
  ],
  timeRestrictions: {
    allowedDays: [1, 2, 3, 4, 5], // Monday-Friday
    allowedHoursStart: 9,
    allowedHoursEnd: 17,
    timezone: 'UTC',
  },
  cooldown: {
    minSecondsBetweenActions: 30,
    minSecondsBetweenSamePageActions: 3600, // 1 hour
  },
};

// ============================================================================
// PRE-EXECUTION VALIDATION
// ============================================================================

export interface ValidationResult {
  actionId: string;
  valid: boolean;
  checks: ValidationCheck[];
  confidenceScore: number;
  validatedAt: string;
  blockedReason?: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  severity: 'blocker' | 'warning' | 'info';
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

export interface ExecutionRequest {
  id: string;
  projectId: string;
  actionId: string;
  action: SEOAction;
  riskClassification: RiskClassification;
  validation: ValidationResult;
  policy: ExecutionPolicy;
  requestedAt: string;
  requestedBy: 'auto' | 'manual';
}

export interface ExecutionResult {
  requestId: string;
  actionId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  
  // What was done
  changes: ExecutionChange[];
  
  // Snapshot for rollback
  snapshotId: string;
  
  // Verification results
  verification?: VerificationResult;
  
  // Error details if failed
  error?: ExecutionError;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  VERIFIED = 'verified',
  VERIFICATION_FAILED = 'verification_failed',
}

export interface ExecutionChange {
  type: 'content_patch' | 'schema_injection' | 'link_insertion' | 'meta_update';
  targetUrl: string;
  targetSelector?: string;
  before: string;
  after: string;
  diffStats: {
    additions: number;
    deletions: number;
    percentChange: number;
  };
}

export interface ExecutionError {
  code: string;
  message: string;
  recoverable: boolean;
  suggestedAction?: string;
}

// ============================================================================
// EXECUTION SNAPSHOT & OUTCOME (for AutoExecutor)
// ============================================================================

export interface ExecutionSnapshot {
  url: string;
  contentBefore: string;
  metadataBefore: {
    title: string;
    description?: string;
  };
  timestamp: string;
  checksum: string;
}

export interface ExecutionOutcome {
  actionId: string;
  projectId: string;
  status: ExecutionStatus;
  executedAt: string;
  durationMs: number;
  snapshot?: ExecutionSnapshot;
  data?: Record<string, unknown>;
  error?: string;
  rollbackAvailable: boolean;
}

// ============================================================================
// POST-EXECUTION VERIFICATION
// ============================================================================

export interface VerificationResult {
  executionId: string;
  passed: boolean;
  checks: VerificationCheck[];
  verifiedAt: string;
  autoRollbackTriggered: boolean;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}

// ============================================================================
// ROLLBACK TYPES
// ============================================================================

export interface Snapshot {
  id: string;
  executionId: string;
  projectId: string;
  targetUrl: string;
  createdAt: string;
  expiresAt: string;
  
  // Stored content
  content: {
    html: string;
    text: string;
    meta: Record<string, string>;
    schema: string[];
  };
  
  // Hash for integrity check
  contentHash: string;
}

export interface RollbackRequest {
  id: string;
  executionId: string;
  snapshotId: string;
  requestedBy: string;
  reason: string;
  requestedAt: string;
}

export interface RollbackResult {
  requestId: string;
  executionId: string;
  status: 'success' | 'failed' | 'partial';
  rolledBackAt: string;
  changesReverted: number;
  error?: string;
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

export interface AuditLogEntry {
  id: string;
  projectId: string;
  timestamp: string;
  
  // What happened
  eventType: AuditEventType;
  entityType: 'action' | 'execution' | 'rollback' | 'policy';
  entityId: string;
  
  // Context
  actor: {
    type: 'system' | 'user';
    id?: string;
    name: string;
  };
  
  // Details
  summary: string;
  details: Record<string, unknown>;
  
  // Risk context
  riskContext?: {
    level: RiskLevel;
    score: number;
    factors: string[];
  };
  
  // Impact
  impact?: {
    pagesAffected: number;
    changesApplied: number;
    expectedOutcome: string;
  };
  
  // Traceability
  relatedIds: {
    actionId?: string;
    executionId?: string;
    snapshotId?: string;
    rollbackId?: string;
  };
}

export enum AuditEventType {
  // Risk classification
  ACTION_CLASSIFIED = 'action_classified',
  
  // Validation
  ACTION_VALIDATED = 'action_validated',
  ACTION_VALIDATION_FAILED = 'action_validation_failed',
  
  // Execution
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  
  // Verification
  VERIFICATION_PASSED = 'verification_passed',
  VERIFICATION_FAILED = 'verification_failed',
  
  // Rollback
  ROLLBACK_REQUESTED = 'rollback_requested',
  ROLLBACK_COMPLETED = 'rollback_completed',
  ROLLBACK_FAILED = 'rollback_failed',
  
  // Policy
  POLICY_UPDATED = 'policy_updated',
  POLICY_VIOLATION = 'policy_violation',
}

// ============================================================================
// ADAPTER INTERFACES
// ============================================================================

export interface CMSAdapter {
  name: string;
  
  // Page operations
  getPage(url: string): Promise<PageContent>;
  updatePage(url: string, content: PageContent, metadata?: { reason: string; actionId: string }): Promise<boolean>;
  
  // Validation
  validateConnection(): Promise<boolean>;
}

export interface PageContent {
  url: string;
  html: string;
  content: string; // Raw content for processing
  title: string;
  description?: string;
  meta: Record<string, string>;
  schema: string[];
  lastModified: string;
}

export interface ContentStorageAdapter {
  name: string;
  
  // Snapshot operations
  saveSnapshot(snapshot: Omit<Snapshot, 'id'>): Promise<Snapshot>;
  getSnapshot(id: string): Promise<Snapshot | null>;
  deleteSnapshot(id: string): Promise<boolean>;
  
  // Cleanup
  cleanupExpiredSnapshots(): Promise<number>;
}

// ============================================================================
// EXECUTION REPORT
// ============================================================================

export interface ExecutionReport {
  projectId: string;
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  
  summary: {
    totalActionsClassified: number;
    totalAutoExecuted: number;
    totalManuallyApproved: number;
    totalBlocked: number;
    totalRolledBack: number;
    successRate: number;
  };
  
  byRiskLevel: Record<RiskLevel, {
    count: number;
    autoExecuted: number;
    blocked: number;
  }>;
  
  byActionType: Record<string, {
    count: number;
    successRate: number;
    avgConfidence: number;
  }>;
  
  recentExecutions: Array<{
    executionId: string;
    actionType: string;
    targetUrl: string;
    status: ExecutionStatus;
    riskLevel: RiskLevel;
    executedAt: string;
  }>;
  
  alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
  }>;
}
