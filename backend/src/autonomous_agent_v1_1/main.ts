/**
 * Autonomous SEO Agent v1.1 - Main Orchestrator
 * 
 * Auto-execute Low-risk Actions
 * 
 * Key Principles:
 * - ONLY LOW-risk actions are auto-executed
 * - NEVER execute MEDIUM or HIGH risk automatically
 * - Full audit trail for all operations
 * - Automatic rollback on verification failure
 * - Deterministic, explainable decisions
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import {
  RiskLevel,
  RiskClassification,
  ValidationResult,
  ExecutionOutcome,
  ExecutionStatus,
  VerificationResult,
  RollbackResult,
  ExecutionPolicy,
  CMSAdapter,
  ContentStorageAdapter,
  AuditLogEntry,
} from './models';
import { RiskClassifier } from './risk_classifier';
import { PolicyEngine, PolicyCheckResult } from './policy_engine';
import { PreExecutionValidator } from './pre_execution_validator';
import { AutoExecutor } from './auto_executor';
import { PostExecutionVerifier } from './post_execution_verifier';
import { RollbackManager } from './rollback_manager';
import { AuditLogger } from './audit_logger';

// Orchestrator configuration
interface OrchestratorConfig {
  projectId: string;
  dryRun: boolean; // If true, simulate execution without changes
  autoRollbackEnabled: boolean;
  parallelExecution: boolean;
  maxConcurrentExecutions: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  projectId: '',
  dryRun: false,
  autoRollbackEnabled: true,
  parallelExecution: false,
  maxConcurrentExecutions: 1,
};

// Execution result for a single action
interface ActionExecutionResult {
  action: SEOAction;
  classification: RiskClassification;
  validation: ValidationResult;
  execution?: ExecutionOutcome;
  verification?: VerificationResult;
  rollback?: RollbackResult;
  status: 'auto_executed' | 'requires_approval' | 'blocked' | 'failed' | 'rolled_back';
  reason: string;
  auditEntries: AuditLogEntry[];
}

// Batch execution result
interface BatchExecutionResult {
  projectId: string;
  timestamp: string;
  totalActions: number;
  autoExecuted: number;
  requiresApproval: number;
  blocked: number;
  failed: number;
  rolledBack: number;
  results: ActionExecutionResult[];
  summary: string;
}

export class AutonomousSEOAgentV1_1 {
  private logger: Console;
  private config: OrchestratorConfig;
  
  // Components
  private riskClassifier: RiskClassifier;
  private policyEngine: PolicyEngine;
  private preValidator: PreExecutionValidator;
  private autoExecutor: AutoExecutor;
  private postVerifier: PostExecutionVerifier;
  private rollbackManager: RollbackManager;
  private auditLogger: AuditLogger;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = console;

    // Initialize components
    this.riskClassifier = new RiskClassifier();
    this.policyEngine = new PolicyEngine();
    this.preValidator = new PreExecutionValidator();
    this.autoExecutor = new AutoExecutor({ dryRun: this.config.dryRun });
    this.postVerifier = new PostExecutionVerifier();
    this.rollbackManager = new RollbackManager();
    this.auditLogger = new AuditLogger();

    this.logger.log(`[AutonomousSEOAgentV1.1] Initialized (dryRun: ${this.config.dryRun})`);
  }

  /**
   * Configure CMS adapter for all components
   */
  setCMSAdapter(adapter: CMSAdapter): void {
    this.preValidator.setCMSAdapter(adapter);
    this.autoExecutor.setCMSAdapter(adapter);
    this.postVerifier.setCMSAdapter(adapter);
    this.rollbackManager.setCMSAdapter(adapter);
    this.logger.log(`[AutonomousSEOAgentV1.1] CMS adapter configured: ${adapter.name}`);
  }

  /**
   * Configure storage adapter for rollback snapshots
   */
  setStorageAdapter(adapter: ContentStorageAdapter): void {
    this.rollbackManager.setStorageAdapter(adapter);
    this.logger.log(`[AutonomousSEOAgentV1.1] Storage adapter configured: ${adapter.name}`);
  }

  /**
   * Update execution policy for a project
   */
  setPolicy(projectId: string, policy: Partial<ExecutionPolicy>): void {
    this.policyEngine.updatePolicy(projectId, policy);
    this.logger.log(`[AutonomousSEOAgentV1.1] Policy updated for project: ${projectId}`);
  }

  // ============================================================================
  // MAIN PROCESSING METHODS
  // ============================================================================

  /**
   * Check if an action is eligible for auto-execution
   */
  private checkAutoExecuteEligibility(
    classification: RiskClassification,
    policyCheck: PolicyCheckResult
  ): { allowed: boolean; reason: string } {
    // Must be LOW risk
    if (classification.level !== RiskLevel.LOW) {
      return {
        allowed: false,
        reason: `Risk level ${classification.level} is not eligible for auto-execution. Only LOW-risk actions can be auto-executed.`,
      };
    }

    // Must pass policy compliance
    if (!policyCheck.compliant) {
      const violations = policyCheck.violations.map(v => v.message).join('; ');
      return {
        allowed: false,
        reason: `Policy violations: ${violations}`,
      };
    }

    // Must be classified as auto-executable
    if (!classification.autoExecutable) {
      return {
        allowed: false,
        reason: 'Action is not classified as auto-executable',
      };
    }

    return {
      allowed: true,
      reason: 'Action is eligible for auto-execution',
    };
  }

  /**
   * Process a single action through the full pipeline
   */
  async processAction(
    action: SEOAction,
    projectId: string
  ): Promise<ActionExecutionResult> {
    this.logger.log(`[AutonomousSEOAgentV1.1] Processing action: ${action.id}`);
    
    const auditEntries: AuditLogEntry[] = [];

    // Step 1: Risk Classification
    const classification = this.riskClassifier.classify(action);
    auditEntries.push(
      this.auditLogger.logClassification(projectId, action, classification)
    );

    // Step 2: Policy Check
    const policyCheck = this.policyEngine.checkCompliance(projectId, action, classification);

    // Step 3: Determine if auto-executable
    const canAutoExecute = this.checkAutoExecuteEligibility(
      classification,
      policyCheck
    );

    // If not LOW-risk or policy violation, return for approval
    if (classification.level !== RiskLevel.LOW || !canAutoExecute.allowed) {
      this.logger.log(
        `[AutonomousSEOAgentV1.1] Action ${action.id} requires approval: ${canAutoExecute.reason}`
      );

      return {
        action,
        classification,
        validation: {
          actionId: action.id,
          valid: false,
          checks: [],
          confidenceScore: 0,
          validatedAt: new Date().toISOString(),
          blockedReason: canAutoExecute.reason,
        },
        status: classification.level !== RiskLevel.LOW ? 'requires_approval' : 'blocked',
        reason: canAutoExecute.reason,
        auditEntries,
      };
    }

    // Step 4: Pre-execution Validation
    const validation = await this.preValidator.validate(
      action,
      classification,
      policyCheck,
      projectId
    );
    auditEntries.push(
      this.auditLogger.logValidation(projectId, action, validation, policyCheck)
    );

    if (!validation.valid) {
      this.logger.log(
        `[AutonomousSEOAgentV1.1] Action ${action.id} blocked: ${validation.blockedReason}`
      );

      return {
        action,
        classification,
        validation,
        status: 'blocked',
        reason: validation.blockedReason || 'Validation failed',
        auditEntries,
      };
    }

    // Step 5: Create pre-execution snapshot
    const snapshot = await this.rollbackManager.createSnapshot(
      action.id,
      projectId,
      action.targetUrl || ''
    );

    // Step 6: Execute
    auditEntries.push(
      this.auditLogger.logExecutionStarted(projectId, action, classification)
    );

    const execution = await this.autoExecutor.execute(
      action,
      validation,
      classification,
      projectId
    );

    auditEntries.push(
      this.auditLogger.logExecutionCompleted(projectId, action, execution, classification)
    );

    // Record execution for conflict detection
    this.preValidator.recordExecution(projectId, action.id);

    // Step 7: Post-execution Verification
    const verification = await this.postVerifier.verify(execution, action, projectId);
    auditEntries.push(
      this.auditLogger.logVerification(
        projectId,
        action,
        execution,
        verification.passed,
        verification.autoRollbackTriggered
      )
    );

    // Step 8: Auto-rollback if verification failed
    if (!verification.passed && verification.autoRollbackTriggered && this.config.autoRollbackEnabled) {
      this.logger.warn(
        `[AutonomousSEOAgentV1.1] Verification failed - triggering auto-rollback`
      );

      const rollbackResult = await this.rollbackManager.autoRollback(
        execution,
        'Verification failed'
      );

      if (rollbackResult) {
        const request = await this.rollbackManager.requestRollback(
          action.id,
          'system:auto-rollback',
          'Verification failed'
        );
        auditEntries.push(
          this.auditLogger.logRollbackRequested(projectId, request)
        );
        auditEntries.push(
          this.auditLogger.logRollbackResult(projectId, request, rollbackResult)
        );

        return {
          action,
          classification,
          validation,
          execution,
          verification,
          rollback: rollbackResult,
          status: 'rolled_back',
          reason: 'Auto-rollback triggered due to verification failure',
          auditEntries,
        };
      }
    }

    // Determine final status
    const isSuccess = execution.status === ExecutionStatus.SUCCESS ||
                      execution.status === ExecutionStatus.COMPLETED;

    return {
      action,
      classification,
      validation,
      execution,
      verification,
      status: isSuccess ? 'auto_executed' : 'failed',
      reason: isSuccess
        ? `Successfully auto-executed: ${action.title}`
        : execution.error || 'Execution failed',
      auditEntries,
    };
  }

  /**
   * Process multiple actions in batch
   */
  async processActions(
    actions: SEOAction[],
    projectId: string
  ): Promise<BatchExecutionResult> {
    this.logger.log(
      `[AutonomousSEOAgentV1.1] Processing ${actions.length} actions for project: ${projectId}`
    );

    const results: ActionExecutionResult[] = [];
    let autoExecuted = 0;
    let requiresApproval = 0;
    let blocked = 0;
    let failed = 0;
    let rolledBack = 0;

    for (const action of actions) {
      const result = await this.processAction(action, projectId);
      results.push(result);

      switch (result.status) {
        case 'auto_executed':
          autoExecuted++;
          break;
        case 'requires_approval':
          requiresApproval++;
          break;
        case 'blocked':
          blocked++;
          break;
        case 'failed':
          failed++;
          break;
        case 'rolled_back':
          rolledBack++;
          break;
      }
    }

    const summary = this.generateBatchSummary(
      autoExecuted,
      requiresApproval,
      blocked,
      failed,
      rolledBack
    );

    return {
      projectId,
      timestamp: new Date().toISOString(),
      totalActions: actions.length,
      autoExecuted,
      requiresApproval,
      blocked,
      failed,
      rolledBack,
      results,
      summary,
    };
  }

  // ============================================================================
  // MANUAL OPERATIONS
  // ============================================================================

  /**
   * Manually trigger rollback (Admin action)
   */
  async manualRollback(
    executionId: string,
    requestedBy: string,
    reason: string,
    projectId: string
  ): Promise<RollbackResult | null> {
    this.logger.log(
      `[AutonomousSEOAgentV1.1] Manual rollback requested for: ${executionId}`
    );

    try {
      const request = await this.rollbackManager.requestRollback(
        executionId,
        requestedBy,
        reason
      );
      this.auditLogger.logRollbackRequested(projectId, request);

      const result = await this.rollbackManager.executeRollback(request);
      this.auditLogger.logRollbackResult(projectId, request, result);

      return result;
    } catch (error) {
      this.logger.error(
        `[AutonomousSEOAgentV1.1] Manual rollback failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Get audit trail for an action
   */
  getActionAuditTrail(projectId: string, actionId: string): AuditLogEntry[] {
    return this.auditLogger.getActionAuditTrail(projectId, actionId);
  }

  /**
   * Get recent activity for dashboard
   */
  getRecentActivity(projectId: string, limit?: number): AuditLogEntry[] {
    return this.auditLogger.getRecentActivity(projectId, limit);
  }

  /**
   * Get execution summary
   */
  getExecutionSummary(projectId: string, startDate: string, endDate: string) {
    return this.auditLogger.getExecutionSummary(projectId, startDate, endDate);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private generateBatchSummary(
    autoExecuted: number,
    requiresApproval: number,
    blocked: number,
    failed: number,
    rolledBack: number
  ): string {
    const parts: string[] = [];

    if (autoExecuted > 0) {
      parts.push(`${autoExecuted} auto-executed`);
    }
    if (requiresApproval > 0) {
      parts.push(`${requiresApproval} require approval`);
    }
    if (blocked > 0) {
      parts.push(`${blocked} blocked`);
    }
    if (failed > 0) {
      parts.push(`${failed} failed`);
    }
    if (rolledBack > 0) {
      parts.push(`${rolledBack} rolled back`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No actions processed';
  }

  /**
   * Get system statistics
   */
  getStats(): {
    executor: ReturnType<AutoExecutor['getStats']>;
    validator: ReturnType<PreExecutionValidator['getValidationStats']>;
    rollback: ReturnType<RollbackManager['getStats']>;
    audit: ReturnType<AuditLogger['getStats']>;
  } {
    return {
      executor: this.autoExecutor.getStats(),
      validator: this.preValidator.getValidationStats(),
      rollback: this.rollbackManager.getStats(),
      audit: this.auditLogger.getStats(),
    };
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<{
    snapshots: number;
    logs: number;
  }> {
    const snapshots = await this.rollbackManager.cleanupExpiredSnapshots();
    const logs = this.auditLogger.cleanupOldLogs();

    return { snapshots, logs };
  }
}

export default AutonomousSEOAgentV1_1;
