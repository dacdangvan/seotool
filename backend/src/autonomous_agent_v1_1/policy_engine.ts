/**
 * Policy Engine
 * 
 * v1.1 - Manages and enforces execution policies for auto-execution
 * 
 * Responsibilities:
 * - Store and retrieve project-specific policies
 * - Check if an action complies with policy
 * - Track execution limits and cooldowns
 * - Provide policy violation explanations
 */

import { v4 as uuidv4 } from 'uuid';
import { SEOAction, ActionType } from '../autonomous_agent/models';
import {
  ExecutionPolicy,
  DEFAULT_EXECUTION_POLICY,
  RiskLevel,
  RiskClassification,
} from './models';

// Policy violation result
export interface PolicyCheckResult {
  compliant: boolean;
  violations: PolicyViolation[];
  warnings: PolicyWarning[];
  checkedAt: string;
}

export interface PolicyViolation {
  rule: string;
  message: string;
  severity: 'blocker' | 'critical';
  limit?: number;
  actual?: number;
}

export interface PolicyWarning {
  rule: string;
  message: string;
  threshold: number;
  current: number;
}

// Execution tracking
interface ExecutionTracker {
  projectId: string;
  executionsToday: number;
  executionsThisHour: number;
  lastExecutionAt?: string;
  pageExecutions: Map<string, string>; // url -> lastExecutionTime
}

export class PolicyEngine {
  private policies: Map<string, ExecutionPolicy> = new Map();
  private executionTrackers: Map<string, ExecutionTracker> = new Map();
  private logger: Console;

  constructor() {
    this.logger = console;
    this.logger.log('[PolicyEngine] Initialized');
  }

  // ============================================================================
  // POLICY MANAGEMENT
  // ============================================================================

  /**
   * Create a new policy for a project
   */
  createPolicy(projectId: string, overrides?: Partial<ExecutionPolicy>): ExecutionPolicy {
    const policy: ExecutionPolicy = {
      ...DEFAULT_EXECUTION_POLICY,
      ...overrides,
      id: uuidv4(),
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.policies.set(projectId, policy);
    this.logger.log(`[PolicyEngine] Created policy for project: ${projectId}`);

    return policy;
  }

  /**
   * Get policy for a project (creates default if none exists)
   */
  getPolicy(projectId: string): ExecutionPolicy {
    let policy = this.policies.get(projectId);
    
    if (!policy) {
      policy = this.createPolicy(projectId);
    }

    return policy;
  }

  /**
   * Update an existing policy
   */
  updatePolicy(projectId: string, updates: Partial<ExecutionPolicy>): ExecutionPolicy {
    const current = this.getPolicy(projectId);
    
    const updated: ExecutionPolicy = {
      ...current,
      ...updates,
      id: current.id,
      projectId: current.projectId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.policies.set(projectId, updated);
    this.logger.log(`[PolicyEngine] Updated policy for project: ${projectId}`);

    return updated;
  }

  /**
   * Delete policy (reverts to default)
   */
  deletePolicy(projectId: string): void {
    this.policies.delete(projectId);
    this.logger.log(`[PolicyEngine] Deleted policy for project: ${projectId}`);
  }

  // ============================================================================
  // POLICY COMPLIANCE CHECKS
  // ============================================================================

  /**
   * Check if an action complies with project policy
   */
  checkCompliance(
    projectId: string,
    action: SEOAction,
    riskClassification: RiskClassification
  ): PolicyCheckResult {
    const policy = this.getPolicy(projectId);
    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    this.logger.log(`[PolicyEngine] Checking compliance for action: ${action.id}`);

    // Check 1: Is auto-execution enabled?
    if (!policy.autoExecution.enabled) {
      violations.push({
        rule: 'autoExecution.enabled',
        message: 'Auto-execution is disabled for this project',
        severity: 'blocker',
      });
    }

    // Check 2: Is the risk level allowed?
    if (!policy.autoExecution.allowedRiskLevels.includes(riskClassification.level)) {
      violations.push({
        rule: 'autoExecution.allowedRiskLevels',
        message: `Risk level ${riskClassification.level} is not allowed for auto-execution`,
        severity: 'blocker',
      });
    }

    // Check 3: Is the action type allowed?
    if (!policy.allowedActionTypes.includes(action.type)) {
      violations.push({
        rule: 'allowedActionTypes',
        message: `Action type ${action.type} is not allowed for auto-execution`,
        severity: 'blocker',
      });
    }

    // Check 4: Rate limits
    const rateLimitCheck = this.checkRateLimits(projectId, policy);
    violations.push(...rateLimitCheck.violations);
    warnings.push(...rateLimitCheck.warnings);

    // Check 5: Time restrictions
    const timeCheck = this.checkTimeRestrictions(policy);
    violations.push(...timeCheck.violations);

    // Check 6: Cooldown
    const cooldownCheck = this.checkCooldown(projectId, action.targetUrl, policy);
    violations.push(...cooldownCheck.violations);

    // Check 7: Confidence score
    if (riskClassification.score > 100 - policy.autoExecution.requireConfidenceScore) {
      violations.push({
        rule: 'autoExecution.requireConfidenceScore',
        message: `Confidence too low. Required: ${policy.autoExecution.requireConfidenceScore}%, ` +
          `Actual: ${100 - riskClassification.score}%`,
        severity: 'blocker',
        limit: policy.autoExecution.requireConfidenceScore,
        actual: 100 - riskClassification.score,
      });
    }

    // Check 8: Forbidden URL patterns
    if (action.targetUrl) {
      const forbiddenCheck = this.checkForbiddenPatterns(action.targetUrl, policy);
      violations.push(...forbiddenCheck.violations);
    }

    const compliant = violations.length === 0;

    this.logger.log(
      `[PolicyEngine] Compliance check: ${compliant ? 'PASSED' : 'FAILED'}. ` +
      `Violations: ${violations.length}, Warnings: ${warnings.length}`
    );

    return {
      compliant,
      violations,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Check content modification limits
   */
  checkContentLimits(
    projectId: string,
    percentChange: number,
    wordsAdded: number,
    wordsRemoved: number
  ): PolicyCheckResult {
    const policy = this.getPolicy(projectId);
    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    if (percentChange > policy.contentLimits.maxPercentChangePerPage) {
      violations.push({
        rule: 'contentLimits.maxPercentChangePerPage',
        message: `Content change exceeds limit: ${percentChange}% > ${policy.contentLimits.maxPercentChangePerPage}%`,
        severity: 'blocker',
        limit: policy.contentLimits.maxPercentChangePerPage,
        actual: percentChange,
      });
    }

    if (wordsAdded > policy.contentLimits.maxWordsAddedPerPage) {
      violations.push({
        rule: 'contentLimits.maxWordsAddedPerPage',
        message: `Words added exceeds limit: ${wordsAdded} > ${policy.contentLimits.maxWordsAddedPerPage}`,
        severity: 'blocker',
        limit: policy.contentLimits.maxWordsAddedPerPage,
        actual: wordsAdded,
      });
    }

    if (wordsRemoved > policy.contentLimits.maxWordsRemovedPerPage) {
      violations.push({
        rule: 'contentLimits.maxWordsRemovedPerPage',
        message: `Words removed exceeds limit: ${wordsRemoved} > ${policy.contentLimits.maxWordsRemovedPerPage}`,
        severity: 'blocker',
        limit: policy.contentLimits.maxWordsRemovedPerPage,
        actual: wordsRemoved,
      });
    }

    // Warnings at 80% of limit
    if (percentChange > policy.contentLimits.maxPercentChangePerPage * 0.8 && 
        percentChange <= policy.contentLimits.maxPercentChangePerPage) {
      warnings.push({
        rule: 'contentLimits.maxPercentChangePerPage',
        message: 'Approaching content change limit',
        threshold: policy.contentLimits.maxPercentChangePerPage,
        current: percentChange,
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Check link limits
   */
  checkLinkLimits(
    projectId: string,
    currentLinksOnPage: number,
    newLinksToAdd: number
  ): PolicyCheckResult {
    const policy = this.getPolicy(projectId);
    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    const totalAfter = currentLinksOnPage + newLinksToAdd;

    if (totalAfter > policy.linkLimits.maxInternalLinksPerPage) {
      violations.push({
        rule: 'linkLimits.maxInternalLinksPerPage',
        message: `Total links would exceed limit: ${totalAfter} > ${policy.linkLimits.maxInternalLinksPerPage}`,
        severity: 'blocker',
        limit: policy.linkLimits.maxInternalLinksPerPage,
        actual: totalAfter,
      });
    }

    if (newLinksToAdd > policy.linkLimits.maxNewLinksPerExecution) {
      violations.push({
        rule: 'linkLimits.maxNewLinksPerExecution',
        message: `New links exceed per-execution limit: ${newLinksToAdd} > ${policy.linkLimits.maxNewLinksPerExecution}`,
        severity: 'blocker',
        limit: policy.linkLimits.maxNewLinksPerExecution,
        actual: newLinksToAdd,
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // EXECUTION TRACKING
  // ============================================================================

  /**
   * Record an execution for rate limit tracking
   */
  recordExecution(projectId: string, targetUrl?: string): void {
    const tracker = this.getOrCreateTracker(projectId);
    
    tracker.executionsToday++;
    tracker.executionsThisHour++;
    tracker.lastExecutionAt = new Date().toISOString();
    
    if (targetUrl) {
      tracker.pageExecutions.set(targetUrl, new Date().toISOString());
    }

    this.logger.log(
      `[PolicyEngine] Recorded execution. Today: ${tracker.executionsToday}, This hour: ${tracker.executionsThisHour}`
    );
  }

  /**
   * Reset hourly counters (should be called periodically)
   */
  resetHourlyCounters(): void {
    for (const tracker of this.executionTrackers.values()) {
      tracker.executionsThisHour = 0;
    }
    this.logger.log('[PolicyEngine] Reset hourly counters');
  }

  /**
   * Reset daily counters (should be called at midnight)
   */
  resetDailyCounters(): void {
    for (const tracker of this.executionTrackers.values()) {
      tracker.executionsToday = 0;
      tracker.executionsThisHour = 0;
      tracker.pageExecutions.clear();
    }
    this.logger.log('[PolicyEngine] Reset daily counters');
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getOrCreateTracker(projectId: string): ExecutionTracker {
    let tracker = this.executionTrackers.get(projectId);
    
    if (!tracker) {
      tracker = {
        projectId,
        executionsToday: 0,
        executionsThisHour: 0,
        pageExecutions: new Map(),
      };
      this.executionTrackers.set(projectId, tracker);
    }

    return tracker;
  }

  private checkRateLimits(projectId: string, policy: ExecutionPolicy): {
    violations: PolicyViolation[];
    warnings: PolicyWarning[];
  } {
    const tracker = this.getOrCreateTracker(projectId);
    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    // Check daily limit
    if (tracker.executionsToday >= policy.autoExecution.maxActionsPerDay) {
      violations.push({
        rule: 'autoExecution.maxActionsPerDay',
        message: `Daily execution limit reached: ${tracker.executionsToday}/${policy.autoExecution.maxActionsPerDay}`,
        severity: 'blocker',
        limit: policy.autoExecution.maxActionsPerDay,
        actual: tracker.executionsToday,
      });
    } else if (tracker.executionsToday >= policy.autoExecution.maxActionsPerDay * 0.8) {
      warnings.push({
        rule: 'autoExecution.maxActionsPerDay',
        message: 'Approaching daily execution limit',
        threshold: policy.autoExecution.maxActionsPerDay,
        current: tracker.executionsToday,
      });
    }

    // Check hourly limit
    if (tracker.executionsThisHour >= policy.autoExecution.maxActionsPerHour) {
      violations.push({
        rule: 'autoExecution.maxActionsPerHour',
        message: `Hourly execution limit reached: ${tracker.executionsThisHour}/${policy.autoExecution.maxActionsPerHour}`,
        severity: 'blocker',
        limit: policy.autoExecution.maxActionsPerHour,
        actual: tracker.executionsThisHour,
      });
    }

    return { violations, warnings };
  }

  private checkTimeRestrictions(policy: ExecutionPolicy): {
    violations: PolicyViolation[];
  } {
    const violations: PolicyViolation[] = [];
    const now = new Date();
    
    // Get current time in policy timezone (simplified - using local time)
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    // Check allowed days
    if (!policy.timeRestrictions.allowedDays.includes(currentDay)) {
      violations.push({
        rule: 'timeRestrictions.allowedDays',
        message: `Auto-execution not allowed on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay]}`,
        severity: 'blocker',
      });
    }

    // Check allowed hours
    if (currentHour < policy.timeRestrictions.allowedHoursStart || 
        currentHour >= policy.timeRestrictions.allowedHoursEnd) {
      violations.push({
        rule: 'timeRestrictions.allowedHours',
        message: `Auto-execution only allowed between ${policy.timeRestrictions.allowedHoursStart}:00 and ${policy.timeRestrictions.allowedHoursEnd}:00`,
        severity: 'blocker',
      });
    }

    return { violations };
  }

  private checkCooldown(
    projectId: string,
    targetUrl: string | undefined,
    policy: ExecutionPolicy
  ): { violations: PolicyViolation[] } {
    const violations: PolicyViolation[] = [];
    const tracker = this.getOrCreateTracker(projectId);

    // Check general cooldown
    if (tracker.lastExecutionAt) {
      const lastExec = new Date(tracker.lastExecutionAt);
      const elapsed = (Date.now() - lastExec.getTime()) / 1000;
      
      if (elapsed < policy.cooldown.minSecondsBetweenActions) {
        violations.push({
          rule: 'cooldown.minSecondsBetweenActions',
          message: `Cooldown not elapsed. Wait ${Math.ceil(policy.cooldown.minSecondsBetweenActions - elapsed)} more seconds`,
          severity: 'blocker',
          limit: policy.cooldown.minSecondsBetweenActions,
          actual: Math.floor(elapsed),
        });
      }
    }

    // Check page-specific cooldown
    if (targetUrl) {
      const lastPageExec = tracker.pageExecutions.get(targetUrl);
      if (lastPageExec) {
        const elapsed = (Date.now() - new Date(lastPageExec).getTime()) / 1000;
        
        if (elapsed < policy.cooldown.minSecondsBetweenSamePageActions) {
          violations.push({
            rule: 'cooldown.minSecondsBetweenSamePageActions',
            message: `Page cooldown not elapsed. Wait ${Math.ceil(policy.cooldown.minSecondsBetweenSamePageActions - elapsed)} more seconds`,
            severity: 'blocker',
            limit: policy.cooldown.minSecondsBetweenSamePageActions,
            actual: Math.floor(elapsed),
          });
        }
      }
    }

    return { violations };
  }

  private checkForbiddenPatterns(
    targetUrl: string,
    policy: ExecutionPolicy
  ): { violations: PolicyViolation[] } {
    const violations: PolicyViolation[] = [];

    // Check forbidden URL patterns
    for (const pattern of policy.linkLimits.forbiddenLinkTargets) {
      if (targetUrl.includes(pattern)) {
        violations.push({
          rule: 'linkLimits.forbiddenLinkTargets',
          message: `Target URL matches forbidden pattern: ${pattern}`,
          severity: 'blocker',
        });
        break;
      }
    }

    return { violations };
  }

  /**
   * Get policy summary for reporting
   */
  getPolicySummary(projectId: string): Record<string, unknown> {
    const policy = this.getPolicy(projectId);
    const tracker = this.getOrCreateTracker(projectId);

    return {
      policyId: policy.id,
      enabled: policy.autoExecution.enabled,
      allowedActions: policy.allowedActionTypes,
      allowedRiskLevels: policy.autoExecution.allowedRiskLevels,
      limits: {
        maxActionsPerDay: policy.autoExecution.maxActionsPerDay,
        maxActionsPerHour: policy.autoExecution.maxActionsPerHour,
        maxContentChange: policy.contentLimits.maxPercentChangePerPage,
        maxLinksPerPage: policy.linkLimits.maxInternalLinksPerPage,
      },
      usage: {
        executionsToday: tracker.executionsToday,
        executionsThisHour: tracker.executionsThisHour,
        lastExecution: tracker.lastExecutionAt,
      },
    };
  }
}

export default PolicyEngine;
