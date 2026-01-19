/**
 * Pre-Execution Validator
 * 
 * v1.1 - Validates actions before auto-execution
 * 
 * Responsibilities:
 * - Verify target page exists and is accessible
 * - Confirm action matches LOW-risk criteria
 * - Check for conflicts with recent executions
 * - Calculate and attach confidence score
 * - Ensure all prerequisites are met
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import {
  RiskLevel,
  RiskClassification,
  ValidationResult,
  ValidationCheck,
  ExecutionPolicy,
  PageContent,
  CMSAdapter,
} from './models';
import { PolicyCheckResult } from './policy_engine';

// Validation configuration
interface ValidationConfig {
  maxRetries: number;
  timeoutMs: number;
  requirePageAccess: boolean;
}

const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  maxRetries: 2,
  timeoutMs: 10000,
  requirePageAccess: true,
};

export class PreExecutionValidator {
  private logger: Console;
  private config: ValidationConfig;
  private cmsAdapter?: CMSAdapter;
  private recentExecutions: Map<string, Set<string>> = new Map(); // projectId -> Set<actionId>

  constructor(config?: Partial<ValidationConfig>, cmsAdapter?: CMSAdapter) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
    this.cmsAdapter = cmsAdapter;
    this.logger = console;
    this.logger.log('[PreExecutionValidator] Initialized');
  }

  /**
   * Set CMS adapter for page validation
   */
  setCMSAdapter(adapter: CMSAdapter): void {
    this.cmsAdapter = adapter;
    this.logger.log(`[PreExecutionValidator] CMS adapter set: ${adapter.name}`);
  }

  /**
   * Perform full validation of an action before execution
   */
  async validate(
    action: SEOAction,
    riskClassification: RiskClassification,
    policyCheck: PolicyCheckResult,
    projectId: string
  ): Promise<ValidationResult> {
    this.logger.log(`[PreExecutionValidator] Validating action: ${action.id}`);

    const checks: ValidationCheck[] = [];

    // Check 1: Risk level must be LOW
    checks.push(this.validateRiskLevel(riskClassification));

    // Check 2: Policy compliance
    checks.push(this.validatePolicyCompliance(policyCheck));

    // Check 3: Action has required fields
    checks.push(this.validateActionCompleteness(action));

    // Check 4: No duplicate/conflict with recent executions
    checks.push(this.validateNoConflict(action, projectId));

    // Check 5: Target page exists (if applicable)
    if (action.targetUrl && this.config.requirePageAccess) {
      const pageCheck = await this.validateTargetPage(action.targetUrl);
      checks.push(pageCheck);
    }

    // Check 6: Action type specific validation
    const typeCheck = this.validateActionType(action);
    checks.push(typeCheck);

    // Check 7: Dependencies are met
    checks.push(this.validateDependencies(action));

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(checks, riskClassification);

    // Determine overall validity
    const valid = checks.every(c => c.passed || c.severity !== 'blocker');
    const blockedReason = valid ? undefined : 
      checks.find(c => !c.passed && c.severity === 'blocker')?.message;

    const result: ValidationResult = {
      actionId: action.id,
      valid,
      checks,
      confidenceScore,
      validatedAt: new Date().toISOString(),
      blockedReason,
    };

    this.logger.log(
      `[PreExecutionValidator] Validation ${valid ? 'PASSED' : 'FAILED'}. ` +
      `Confidence: ${confidenceScore}%. ${blockedReason ? `Reason: ${blockedReason}` : ''}`
    );

    return result;
  }

  /**
   * Record a recent execution to prevent conflicts
   */
  recordExecution(projectId: string, actionId: string): void {
    if (!this.recentExecutions.has(projectId)) {
      this.recentExecutions.set(projectId, new Set());
    }
    this.recentExecutions.get(projectId)!.add(actionId);
  }

  /**
   * Clear recent executions (for cleanup)
   */
  clearRecentExecutions(projectId?: string): void {
    if (projectId) {
      this.recentExecutions.delete(projectId);
    } else {
      this.recentExecutions.clear();
    }
  }

  // ============================================================================
  // VALIDATION CHECKS
  // ============================================================================

  private validateRiskLevel(riskClassification: RiskClassification): ValidationCheck {
    const passed = riskClassification.level === RiskLevel.LOW;
    
    return {
      name: 'riskLevel',
      passed,
      severity: 'blocker',
      message: passed
        ? `Risk level is LOW (score: ${riskClassification.score})`
        : `Risk level ${riskClassification.level} is not allowed for auto-execution`,
      data: {
        level: riskClassification.level,
        score: riskClassification.score,
      },
    };
  }

  private validatePolicyCompliance(policyCheck: PolicyCheckResult): ValidationCheck {
    return {
      name: 'policyCompliance',
      passed: policyCheck.compliant,
      severity: 'blocker',
      message: policyCheck.compliant
        ? 'Action complies with execution policy'
        : `Policy violations: ${policyCheck.violations.map(v => v.message).join('; ')}`,
      data: {
        violations: policyCheck.violations,
        warnings: policyCheck.warnings,
      },
    };
  }

  private validateActionCompleteness(action: SEOAction): ValidationCheck {
    const missingFields: string[] = [];

    if (!action.id) missingFields.push('id');
    if (!action.type) missingFields.push('type');
    if (!action.title) missingFields.push('title');
    if (!action.description) missingFields.push('description');
    if (!action.reasoning) missingFields.push('reasoning');
    if (!action.evidence || action.evidence.length === 0) missingFields.push('evidence');

    const passed = missingFields.length === 0;

    return {
      name: 'actionCompleteness',
      passed,
      severity: 'blocker',
      message: passed
        ? 'Action has all required fields'
        : `Missing required fields: ${missingFields.join(', ')}`,
      data: { missingFields },
    };
  }

  private validateNoConflict(action: SEOAction, projectId: string): ValidationCheck {
    const recentActions = this.recentExecutions.get(projectId) || new Set();
    const hasConflict = recentActions.has(action.id);

    // Also check for same target URL in recent executions
    // (In a real implementation, we'd track URL -> action mapping)

    return {
      name: 'noConflict',
      passed: !hasConflict,
      severity: 'blocker',
      message: hasConflict
        ? 'Action has already been executed recently'
        : 'No conflict with recent executions',
      data: { recentCount: recentActions.size },
    };
  }

  private async validateTargetPage(targetUrl: string): Promise<ValidationCheck> {
    if (!this.cmsAdapter) {
      return {
        name: 'targetPageExists',
        passed: true, // Pass if no adapter (can't verify)
        severity: 'warning',
        message: 'No CMS adapter configured - skipping page validation',
      };
    }

    try {
      const page = await this.cmsAdapter.getPage(targetUrl);
      
      return {
        name: 'targetPageExists',
        passed: true,
        severity: 'blocker',
        message: `Target page exists and is accessible: ${targetUrl}`,
        data: {
          title: page.title,
          lastModified: page.lastModified,
        },
      };
    } catch (error) {
      return {
        name: 'targetPageExists',
        passed: false,
        severity: 'blocker',
        message: `Target page not accessible: ${error instanceof Error ? error.message : String(error)}`,
        data: { url: targetUrl },
      };
    }
  }

  private validateActionType(action: SEOAction): ValidationCheck {
    // Type-specific validation rules
    const typeValidations: Record<ActionType, () => { valid: boolean; message: string }> = {
      [ActionType.OPTIMIZE_CONTENT]: () => ({
        valid: true,
        message: 'Content optimization action is valid',
      }),
      [ActionType.ADD_INTERNAL_LINK]: () => {
        // Should have link target in description or evidence
        const hasLinkInfo = action.description.includes('link') || 
          action.evidence.some(e => e.description.includes('link'));
        return {
          valid: hasLinkInfo,
          message: hasLinkInfo 
            ? 'Internal link action has link information'
            : 'Internal link action missing link target information',
        };
      },
      [ActionType.FIX_SCHEMA_MARKUP]: () => ({
        valid: true,
        message: 'Schema markup fix action is valid',
      }),
      [ActionType.OPTIMIZE_ANCHOR_TEXT]: () => ({
        valid: true,
        message: 'Anchor text optimization action is valid',
      }),
      [ActionType.UPDATE_CONTENT]: () => ({
        valid: false, // Medium risk - should not auto-execute
        message: 'UPDATE_CONTENT is medium risk and requires manual approval',
      }),
      [ActionType.IMPROVE_PAGE_SPEED]: () => ({
        valid: false, // Medium risk
        message: 'IMPROVE_PAGE_SPEED requires technical review',
      }),
      [ActionType.FIX_TECHNICAL_ISSUE]: () => ({
        valid: false, // Medium risk
        message: 'FIX_TECHNICAL_ISSUE requires technical review',
      }),
      [ActionType.IMPROVE_KEYWORD_RANKING]: () => ({
        valid: false, // Medium risk
        message: 'IMPROVE_KEYWORD_RANKING requires strategic review',
      }),
      [ActionType.CREATE_CONTENT]: () => ({
        valid: false, // High risk
        message: 'CREATE_CONTENT is high risk and requires manual approval',
      }),
      [ActionType.TARGET_NEW_KEYWORD]: () => ({
        valid: false, // High risk
        message: 'TARGET_NEW_KEYWORD is high risk and requires strategic approval',
      }),
      [ActionType.INVESTIGATE_ANOMALY]: () => ({
        valid: true, // Investigation is safe
        message: 'Investigation action is valid (read-only)',
      }),
      [ActionType.SET_UP_ALERT]: () => ({
        valid: true, // Alert setup is safe
        message: 'Alert setup action is valid',
      }),
    };

    const validation = typeValidations[action.type]?.() || {
      valid: false,
      message: `Unknown action type: ${action.type}`,
    };

    return {
      name: 'actionTypeValid',
      passed: validation.valid,
      severity: 'blocker',
      message: validation.message,
      data: { actionType: action.type },
    };
  }

  private validateDependencies(action: SEOAction): ValidationCheck {
    // Check if any dependencies are unmet
    const hasUnmetDependencies = action.dependsOn && action.dependsOn.length > 0;
    const hasBlockers = action.blockedBy && action.blockedBy.length > 0;

    if (hasBlockers) {
      return {
        name: 'dependencies',
        passed: false,
        severity: 'blocker',
        message: `Action is blocked by: ${action.blockedBy.join(', ')}`,
        data: { blockedBy: action.blockedBy },
      };
    }

    if (hasUnmetDependencies) {
      return {
        name: 'dependencies',
        passed: true, // Warning, not blocker
        severity: 'warning',
        message: `Action has dependencies that should be verified: ${action.dependsOn.join(', ')}`,
        data: { dependsOn: action.dependsOn },
      };
    }

    return {
      name: 'dependencies',
      passed: true,
      severity: 'info',
      message: 'No dependencies',
    };
  }

  // ============================================================================
  // CONFIDENCE SCORE CALCULATION
  // ============================================================================

  private calculateConfidenceScore(
    checks: ValidationCheck[],
    riskClassification: RiskClassification
  ): number {
    // Base confidence from checks
    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;
    const checkScore = (passedChecks / totalChecks) * 50; // Max 50 points from checks

    // Risk score contribution (lower risk = higher confidence)
    const riskScore = ((100 - riskClassification.score) / 100) * 30; // Max 30 points

    // Action evidence contribution
    const evidenceScore = Math.min(riskClassification.factors.length * 5, 20); // Max 20 points

    const totalScore = Math.round(checkScore + riskScore + evidenceScore);

    return Math.min(100, Math.max(0, totalScore));
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    recentExecutionCount: number;
    projectsTracked: number;
  } {
    let totalExecutions = 0;
    for (const actions of this.recentExecutions.values()) {
      totalExecutions += actions.size;
    }

    return {
      recentExecutionCount: totalExecutions,
      projectsTracked: this.recentExecutions.size,
    };
  }
}

export default PreExecutionValidator;
