/**
 * Audit Logger
 * 
 * v1.1 - Comprehensive audit logging for auto-execution
 * 
 * Responsibilities:
 * - Log all actions (classification, validation, execution, rollback)
 * - Provide full traceability
 * - Support compliance and debugging
 * - Enable dashboard exposure
 * - Explain WHY actions were classified as low-risk
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import {
  RiskLevel,
  RiskClassification,
  ValidationResult,
  ExecutionOutcome,
  ExecutionStatus,
  RollbackRequest,
  RollbackResult,
  AuditLogEntry,
  AuditEventType,
  ExecutionPolicy,
} from './models';
import { PolicyCheckResult } from './policy_engine';

// Audit configuration
interface AuditConfig {
  retentionDays: number;
  maxEntriesPerProject: number;
  includeDetailedContext: boolean;
  redactSensitiveData: boolean;
}

const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  retentionDays: 90,
  maxEntriesPerProject: 10000,
  includeDetailedContext: true,
  redactSensitiveData: false,
};

// Query options for retrieving logs
interface AuditQueryOptions {
  projectId?: string;
  eventTypes?: AuditEventType[];
  entityType?: 'action' | 'execution' | 'rollback' | 'policy';
  startDate?: string;
  endDate?: string;
  riskLevels?: RiskLevel[];
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private logger: Console;
  private config: AuditConfig;
  
  // In-memory storage (replace with PostgreSQL in production)
  private logs: Map<string, AuditLogEntry[]> = new Map(); // projectId -> logs

  constructor(config?: Partial<AuditConfig>) {
    this.config = { ...DEFAULT_AUDIT_CONFIG, ...config };
    this.logger = console;
    this.logger.log('[AuditLogger] Initialized');
  }

  // ============================================================================
  // RISK CLASSIFICATION LOGGING
  // ============================================================================

  /**
   * Log action classification
   */
  logClassification(
    projectId: string,
    action: SEOAction,
    classification: RiskClassification
  ): AuditLogEntry {
    const entry = this.createEntry(
      projectId,
      AuditEventType.ACTION_CLASSIFIED,
      'action',
      action.id,
      `Action "${action.title}" classified as ${classification.level.toUpperCase()} risk`,
      {
        actionType: action.type,
        targetUrl: action.targetUrl,
        riskScore: classification.score,
        autoExecutable: classification.autoExecutable,
        factors: classification.factors.map(f => ({
          name: f.name,
          score: f.score,
          reason: f.reason,
        })),
        explanation: classification.explanation,
      },
      classification
    );

    this.addEntry(projectId, entry);
    this.logger.log(
      `[AuditLogger] Logged classification: ${action.id} -> ${classification.level}`
    );
    return entry;
  }

  // ============================================================================
  // VALIDATION LOGGING
  // ============================================================================

  /**
   * Log validation result
   */
  logValidation(
    projectId: string,
    action: SEOAction,
    validation: ValidationResult,
    policyCheck: PolicyCheckResult
  ): AuditLogEntry {
    const eventType = validation.valid
      ? AuditEventType.ACTION_VALIDATED
      : AuditEventType.ACTION_VALIDATION_FAILED;

    const entry = this.createEntry(
      projectId,
      eventType,
      'action',
      action.id,
      validation.valid
        ? `Action "${action.title}" passed validation (confidence: ${validation.confidenceScore}%)`
        : `Action "${action.title}" failed validation: ${validation.blockedReason}`,
      {
        checks: validation.checks.map(c => ({
          name: c.name,
          passed: c.passed,
          severity: c.severity,
          message: c.message,
        })),
        confidenceScore: validation.confidenceScore,
        blockedReason: validation.blockedReason,
        policyViolations: policyCheck.violations,
        policyWarnings: policyCheck.warnings,
      }
    );

    this.addEntry(projectId, entry);
    return entry;
  }

  // ============================================================================
  // EXECUTION LOGGING
  // ============================================================================

  /**
   * Log execution started
   */
  logExecutionStarted(
    projectId: string,
    action: SEOAction,
    classification: RiskClassification
  ): AuditLogEntry {
    const entry = this.createEntry(
      projectId,
      AuditEventType.EXECUTION_STARTED,
      'execution',
      action.id,
      `Auto-execution started: "${action.title}"`,
      {
        actionType: action.type,
        targetUrl: action.targetUrl,
        expectedImpact: action.expectedImpact,
        reasoning: action.reasoning,
      },
      classification,
      {
        pagesAffected: 1,
        changesApplied: 0,
        expectedOutcome: action.description,
      }
    );

    this.addEntry(projectId, entry);
    this.logger.log(`[AuditLogger] Logged execution start: ${action.id}`);
    return entry;
  }

  /**
   * Log execution completed
   */
  logExecutionCompleted(
    projectId: string,
    action: SEOAction,
    outcome: ExecutionOutcome,
    classification: RiskClassification
  ): AuditLogEntry {
    const isSuccess = outcome.status === ExecutionStatus.SUCCESS ||
                      outcome.status === ExecutionStatus.COMPLETED;

    const eventType = isSuccess
      ? AuditEventType.EXECUTION_COMPLETED
      : AuditEventType.EXECUTION_FAILED;

    const entry = this.createEntry(
      projectId,
      eventType,
      'execution',
      action.id,
      isSuccess
        ? `Auto-execution completed: "${action.title}"`
        : `Auto-execution failed: "${action.title}" - ${outcome.error}`,
      {
        status: outcome.status,
        durationMs: outcome.durationMs,
        data: outcome.data,
        error: outcome.error,
        rollbackAvailable: outcome.rollbackAvailable,
        snapshotExists: !!outcome.snapshot,
      },
      classification,
      {
        pagesAffected: 1,
        changesApplied: isSuccess ? 1 : 0,
        expectedOutcome: action.description,
      }
    );

    entry.relatedIds.executionId = outcome.actionId;

    this.addEntry(projectId, entry);
    this.logger.log(
      `[AuditLogger] Logged execution ${isSuccess ? 'completed' : 'failed'}: ${action.id}`
    );
    return entry;
  }

  // ============================================================================
  // VERIFICATION LOGGING
  // ============================================================================

  /**
   * Log verification result
   */
  logVerification(
    projectId: string,
    action: SEOAction,
    outcome: ExecutionOutcome,
    passed: boolean,
    autoRollbackTriggered: boolean
  ): AuditLogEntry {
    const eventType = passed
      ? AuditEventType.VERIFICATION_PASSED
      : AuditEventType.VERIFICATION_FAILED;

    const entry = this.createEntry(
      projectId,
      eventType,
      'execution',
      action.id,
      passed
        ? `Verification passed for "${action.title}"`
        : `Verification failed for "${action.title}" - ${autoRollbackTriggered ? 'auto-rollback triggered' : 'manual review required'}`,
      {
        passed,
        autoRollbackTriggered,
        executionStatus: outcome.status,
      }
    );

    entry.relatedIds.executionId = outcome.actionId;

    this.addEntry(projectId, entry);
    return entry;
  }

  // ============================================================================
  // ROLLBACK LOGGING
  // ============================================================================

  /**
   * Log rollback request
   */
  logRollbackRequested(
    projectId: string,
    request: RollbackRequest
  ): AuditLogEntry {
    const entry = this.createEntry(
      projectId,
      AuditEventType.ROLLBACK_REQUESTED,
      'rollback',
      request.id,
      `Rollback requested by ${request.requestedBy}: ${request.reason}`,
      {
        executionId: request.executionId,
        snapshotId: request.snapshotId,
        reason: request.reason,
      }
    );

    entry.relatedIds.executionId = request.executionId;
    entry.relatedIds.rollbackId = request.id;

    this.addEntry(projectId, entry);
    this.logger.log(`[AuditLogger] Logged rollback request: ${request.id}`);
    return entry;
  }

  /**
   * Log rollback result
   */
  logRollbackResult(
    projectId: string,
    request: RollbackRequest,
    result: RollbackResult
  ): AuditLogEntry {
    const eventType = result.status === 'success'
      ? AuditEventType.ROLLBACK_COMPLETED
      : AuditEventType.ROLLBACK_FAILED;

    const entry = this.createEntry(
      projectId,
      eventType,
      'rollback',
      request.id,
      result.status === 'success'
        ? `Rollback completed: ${result.changesReverted} changes reverted`
        : `Rollback failed: ${result.error}`,
      {
        status: result.status,
        changesReverted: result.changesReverted,
        error: result.error,
      }
    );

    entry.relatedIds.executionId = request.executionId;
    entry.relatedIds.rollbackId = request.id;

    this.addEntry(projectId, entry);
    return entry;
  }

  // ============================================================================
  // POLICY LOGGING
  // ============================================================================

  /**
   * Log policy update
   */
  logPolicyUpdate(
    projectId: string,
    policy: ExecutionPolicy,
    changedBy: string,
    changes: Record<string, { before: unknown; after: unknown }>
  ): AuditLogEntry {
    const entry = this.createEntry(
      projectId,
      AuditEventType.POLICY_UPDATED,
      'policy',
      policy.id,
      `Execution policy "${policy.name}" updated by ${changedBy}`,
      {
        policyName: policy.name,
        changedBy,
        changes,
      }
    );

    this.addEntry(projectId, entry);
    this.logger.log(`[AuditLogger] Logged policy update: ${policy.id}`);
    return entry;
  }

  /**
   * Log policy violation
   */
  logPolicyViolation(
    projectId: string,
    action: SEOAction,
    violations: string[]
  ): AuditLogEntry {
    const entry = this.createEntry(
      projectId,
      AuditEventType.POLICY_VIOLATION,
      'action',
      action.id,
      `Policy violation for "${action.title}": ${violations.join(', ')}`,
      {
        violations,
        actionType: action.type,
        targetUrl: action.targetUrl,
      }
    );

    this.addEntry(projectId, entry);
    return entry;
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Query audit logs
   */
  query(options: AuditQueryOptions): AuditLogEntry[] {
    let results: AuditLogEntry[] = [];

    // Get logs for specific project or all projects
    if (options.projectId) {
      results = this.logs.get(options.projectId) || [];
    } else {
      for (const projectLogs of this.logs.values()) {
        results.push(...projectLogs);
      }
    }

    // Filter by event types
    if (options.eventTypes && options.eventTypes.length > 0) {
      results = results.filter(e => options.eventTypes!.includes(e.eventType));
    }

    // Filter by entity type
    if (options.entityType) {
      results = results.filter(e => e.entityType === options.entityType);
    }

    // Filter by date range
    if (options.startDate) {
      results = results.filter(e => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      results = results.filter(e => e.timestamp <= options.endDate!);
    }

    // Filter by risk levels
    if (options.riskLevels && options.riskLevels.length > 0) {
      results = results.filter(
        e => e.riskContext && options.riskLevels!.includes(e.riskContext.level)
      );
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get full audit trail for an action
   */
  getActionAuditTrail(projectId: string, actionId: string): AuditLogEntry[] {
    const logs = this.logs.get(projectId) || [];
    return logs
      .filter(e => 
        e.entityId === actionId || 
        e.relatedIds.actionId === actionId ||
        e.relatedIds.executionId === actionId
      )
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }

  /**
   * Get recent activity for dashboard
   */
  getRecentActivity(
    projectId: string,
    limit: number = 20
  ): AuditLogEntry[] {
    return this.query({
      projectId,
      limit,
    });
  }

  /**
   * Get execution summary for a time period
   */
  getExecutionSummary(
    projectId: string,
    startDate: string,
    endDate: string
  ): {
    totalClassified: number;
    totalExecuted: number;
    totalFailed: number;
    totalRolledBack: number;
    byRiskLevel: Record<RiskLevel, number>;
    byActionType: Record<string, number>;
  } {
    const logs = this.query({ projectId, startDate, endDate, limit: 10000 });

    const summary = {
      totalClassified: 0,
      totalExecuted: 0,
      totalFailed: 0,
      totalRolledBack: 0,
      byRiskLevel: {
        [RiskLevel.LOW]: 0,
        [RiskLevel.MEDIUM]: 0,
        [RiskLevel.HIGH]: 0,
      } as Record<RiskLevel, number>,
      byActionType: {} as Record<string, number>,
    };

    for (const entry of logs) {
      switch (entry.eventType) {
        case AuditEventType.ACTION_CLASSIFIED:
          summary.totalClassified++;
          if (entry.riskContext) {
            summary.byRiskLevel[entry.riskContext.level]++;
          }
          if (entry.details.actionType) {
            const actionType = entry.details.actionType as string;
            summary.byActionType[actionType] = (summary.byActionType[actionType] || 0) + 1;
          }
          break;
        case AuditEventType.EXECUTION_COMPLETED:
          summary.totalExecuted++;
          break;
        case AuditEventType.EXECUTION_FAILED:
          summary.totalFailed++;
          break;
        case AuditEventType.ROLLBACK_COMPLETED:
          summary.totalRolledBack++;
          break;
      }
    }

    return summary;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private createEntry(
    projectId: string,
    eventType: AuditEventType,
    entityType: 'action' | 'execution' | 'rollback' | 'policy',
    entityId: string,
    summary: string,
    details: Record<string, unknown>,
    riskClassification?: RiskClassification,
    impact?: { pagesAffected: number; changesApplied: number; expectedOutcome: string }
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      timestamp: new Date().toISOString(),
      eventType,
      entityType,
      entityId,
      actor: {
        type: 'system',
        name: 'autonomous-seo-agent-v1.1',
      },
      summary,
      details: this.config.redactSensitiveData 
        ? this.redactDetails(details)
        : details,
      relatedIds: {},
    };

    if (riskClassification) {
      entry.riskContext = {
        level: riskClassification.level,
        score: riskClassification.score,
        factors: riskClassification.factors.map(f => f.name),
      };
      entry.relatedIds.actionId = riskClassification.actionId;
    }

    if (impact) {
      entry.impact = impact;
    }

    return entry;
  }

  private addEntry(projectId: string, entry: AuditLogEntry): void {
    if (!this.logs.has(projectId)) {
      this.logs.set(projectId, []);
    }

    const projectLogs = this.logs.get(projectId)!;
    projectLogs.push(entry);

    // Enforce max entries
    if (projectLogs.length > this.config.maxEntriesPerProject) {
      // Remove oldest entries
      projectLogs.splice(0, projectLogs.length - this.config.maxEntriesPerProject);
    }
  }

  private redactDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'credentials'];
    const redacted = { ...details };

    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        redacted[key] = '[REDACTED]';
      }
    }

    return redacted;
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    totalEntries: number;
    projectsTracked: number;
    entriesByEventType: Record<string, number>;
  } {
    let totalEntries = 0;
    const entriesByEventType: Record<string, number> = {};

    for (const projectLogs of this.logs.values()) {
      totalEntries += projectLogs.length;
      for (const entry of projectLogs) {
        entriesByEventType[entry.eventType] = 
          (entriesByEventType[entry.eventType] || 0) + 1;
      }
    }

    return {
      totalEntries,
      projectsTracked: this.logs.size,
      entriesByEventType,
    };
  }

  /**
   * Export logs for backup or analysis
   */
  exportLogs(projectId: string): AuditLogEntry[] {
    return this.logs.get(projectId) || [];
  }

  /**
   * Cleanup old logs
   */
  cleanupOldLogs(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    const cutoff = cutoffDate.toISOString();

    let cleaned = 0;

    for (const [projectId, projectLogs] of this.logs) {
      const filtered = projectLogs.filter(e => e.timestamp >= cutoff);
      cleaned += projectLogs.length - filtered.length;
      this.logs.set(projectId, filtered);
    }

    if (cleaned > 0) {
      this.logger.log(`[AuditLogger] Cleaned up ${cleaned} old log entries`);
    }

    return cleaned;
  }
}

export default AuditLogger;
