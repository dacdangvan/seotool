/**
 * Safety Gate
 * 
 * v1.0 - Governance layer for autonomous agent actions
 * 
 * Responsibilities:
 * - Validate actions against safety rules
 * - Block destructive actions
 * - Block external backlink creation without approval
 * - Require human approval for execution
 * - Rate limit execution to prevent runaway operations
 */

import {
  SEOAction,
  ActionType,
  ActionPlan,
  SafetyCheck,
  SafetyCheckItem,
  SafetyRule,
} from './models';

// Safety configuration
interface SafetyConfig {
  // Rate limiting
  maxActionsPerHour: number;
  maxActionsPerDay: number;
  
  // Risk thresholds
  blockHighRiskActions: boolean;
  requireApprovalForMediumRisk: boolean;
  
  // Content safety
  maxContentChangesPerDay: number;
  requireContentReview: boolean;
  
  // Technical safety
  allowSchemaModifications: boolean;
  allowRobotsTxtChanges: boolean;
  
  // Link safety
  blockExternalLinkCreation: boolean;
  maxInternalLinksPerAction: number;
  
  // Custom blocked patterns
  blockedUrlPatterns: string[];
  blockedKeywordPatterns: string[];
}

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxActionsPerHour: 10,
  maxActionsPerDay: 50,
  blockHighRiskActions: true,
  requireApprovalForMediumRisk: true,
  maxContentChangesPerDay: 20,
  requireContentReview: true,
  allowSchemaModifications: true,
  allowRobotsTxtChanges: false,
  blockExternalLinkCreation: true,
  maxInternalLinksPerAction: 10,
  blockedUrlPatterns: ['/admin', '/api', '/auth', '/.env'],
  blockedKeywordPatterns: [],
};

// Execution history for rate limiting
interface ExecutionHistory {
  timestamp: string;
  actionId: string;
  actionType: ActionType;
}

export class SafetyGate {
  private config: SafetyConfig;
  private executionHistory: ExecutionHistory[] = [];
  private logger: Console;

  constructor(config?: Partial<SafetyConfig>) {
    this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
    this.logger = console;
    this.logger.log('[SafetyGate] Initialized with config:', this.config);
  }

  /**
   * Validate an entire action plan
   */
  async validatePlan(plan: ActionPlan): Promise<SafetyCheck> {
    this.logger.log(`[SafetyGate] Validating plan: ${plan.id} with ${plan.actions.length} actions`);

    const allChecks: SafetyCheckItem[] = [];
    const blockedActions: string[] = [];
    const warnings: string[] = [];

    // Plan-level checks
    allChecks.push(this.checkApprovalRequired(plan));
    allChecks.push(this.checkRateLimit(plan.actions.length));
    allChecks.push(this.checkDailyLimit(plan.actions));

    // Per-action checks
    for (const action of plan.actions) {
      const actionChecks = await this.validateAction(action);
      allChecks.push(...actionChecks.checks);

      if (!actionChecks.passed) {
        blockedActions.push(action.id);
      }

      // Collect warnings
      for (const check of actionChecks.checks) {
        if (check.severity === 'warning' && !check.passed) {
          warnings.push(`${action.title}: ${check.details || check.description}`);
        }
      }
    }

    const passed = allChecks.every(c => c.passed || c.severity !== 'blocker');

    this.logger.log(
      `[SafetyGate] Plan validation ${passed ? 'PASSED' : 'BLOCKED'}. ` +
      `Blocked: ${blockedActions.length}, Warnings: ${warnings.length}`
    );

    return {
      passed,
      checks: allChecks,
      blockedActions,
      warnings,
    };
  }

  /**
   * Validate a single action
   */
  async validateAction(action: SEOAction): Promise<SafetyCheck> {
    const checks: SafetyCheckItem[] = [];
    const blockedActions: string[] = [];
    const warnings: string[] = [];

    // Core safety rules
    checks.push(this.checkDestructiveAction(action));
    checks.push(this.checkExternalLinks(action));
    checks.push(this.checkRiskLevel(action));
    checks.push(this.checkBlockedPatterns(action));
    checks.push(this.checkReasoningProvided(action));

    // Type-specific checks
    switch (action.type) {
      case ActionType.CREATE_CONTENT:
      case ActionType.UPDATE_CONTENT:
      case ActionType.OPTIMIZE_CONTENT:
        checks.push(this.checkContentAction(action));
        break;

      case ActionType.ADD_INTERNAL_LINK:
        checks.push(this.checkInternalLinkAction(action));
        break;

      case ActionType.FIX_TECHNICAL_ISSUE:
      case ActionType.FIX_SCHEMA_MARKUP:
      case ActionType.IMPROVE_PAGE_SPEED:
        checks.push(this.checkTechnicalAction(action));
        break;
    }

    const passed = checks.every(c => c.passed || c.severity !== 'blocker');

    if (!passed) {
      blockedActions.push(action.id);
    }

    for (const check of checks) {
      if (check.severity === 'warning' && !check.passed) {
        warnings.push(check.details || check.description);
      }
    }

    return {
      passed,
      checks,
      blockedActions,
      warnings,
    };
  }

  // ============================================================================
  // INDIVIDUAL SAFETY CHECKS
  // ============================================================================

  /**
   * Check if human approval is required
   */
  private checkApprovalRequired(plan: ActionPlan): SafetyCheckItem {
    const isApproved = plan.approvalStatus.status === 'approved' || 
                       plan.approvalStatus.status === 'partial';
    
    return {
      name: SafetyRule.REQUIRE_HUMAN_APPROVAL,
      description: 'Human approval required before execution',
      passed: isApproved,
      severity: 'blocker',
      details: isApproved 
        ? `Approved by ${plan.approvalStatus.approvedBy} at ${plan.approvalStatus.approvedAt}`
        : 'Plan requires human approval before execution',
    };
  }

  /**
   * Check rate limit for actions per hour
   */
  private checkRateLimit(newActionCount: number): SafetyCheckItem {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentExecutions = this.executionHistory.filter(e => e.timestamp > oneHourAgo);
    const totalAfterExecution = recentExecutions.length + newActionCount;

    return {
      name: SafetyRule.RATE_LIMIT_EXECUTION,
      description: `Max ${this.config.maxActionsPerHour} actions per hour`,
      passed: totalAfterExecution <= this.config.maxActionsPerHour,
      severity: 'blocker',
      details: `Would execute ${totalAfterExecution}/${this.config.maxActionsPerHour} actions this hour`,
    };
  }

  /**
   * Check daily action limit
   */
  private checkDailyLimit(actions: SEOAction[]): SafetyCheckItem {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayExecutions = this.executionHistory.filter(e => e.timestamp > oneDayAgo);
    const totalAfterExecution = todayExecutions.length + actions.length;

    return {
      name: 'daily_limit',
      description: `Max ${this.config.maxActionsPerDay} actions per day`,
      passed: totalAfterExecution <= this.config.maxActionsPerDay,
      severity: 'blocker',
      details: `Would execute ${totalAfterExecution}/${this.config.maxActionsPerDay} actions today`,
    };
  }

  /**
   * Check for destructive actions
   */
  private checkDestructiveAction(action: SEOAction): SafetyCheckItem {
    const destructivePatterns = [
      /delete/i,
      /remove/i,
      /drop/i,
      /truncate/i,
      /destroy/i,
    ];

    const isDestructive = destructivePatterns.some(
      pattern => pattern.test(action.title) || pattern.test(action.description)
    );

    return {
      name: SafetyRule.NO_DESTRUCTIVE_ACTIONS,
      description: 'Destructive actions are blocked',
      passed: !isDestructive,
      severity: 'blocker',
      details: isDestructive ? 'Action appears to be destructive' : undefined,
    };
  }

  /**
   * Check for external link creation
   */
  private checkExternalLinks(action: SEOAction): SafetyCheckItem {
    if (!this.config.blockExternalLinkCreation) {
      return {
        name: SafetyRule.NO_EXTERNAL_LINKS,
        description: 'External link creation check',
        passed: true,
        severity: 'info',
        details: 'External link check disabled in config',
      };
    }

    const externalLinkPatterns = [
      /external.?link/i,
      /backlink/i,
      /outbound.?link/i,
      /link.?building/i,
    ];

    const hasExternalLinks = externalLinkPatterns.some(
      pattern => pattern.test(action.title) || pattern.test(action.description)
    );

    // Check evidence for external URLs
    const hasExternalUrls = action.evidence.some(e => {
      const urlMatch = e.description.match(/https?:\/\/[^\s]+/g);
      if (!urlMatch) return false;
      // Check if any URL is external (not internal site URL)
      return urlMatch.some(url => !url.includes('${INTERNAL_DOMAIN}')); // Placeholder
    });

    return {
      name: SafetyRule.NO_EXTERNAL_LINKS,
      description: 'External link creation requires separate approval',
      passed: !hasExternalLinks && !hasExternalUrls,
      severity: 'blocker',
      details: (hasExternalLinks || hasExternalUrls) 
        ? 'External link creation detected - requires separate approval workflow'
        : undefined,
    };
  }

  /**
   * Check action risk level
   */
  private checkRiskLevel(action: SEOAction): SafetyCheckItem {
    const isHighRisk = action.riskLevel === 'high';
    const isMediumRisk = action.riskLevel === 'medium';

    if (isHighRisk && this.config.blockHighRiskActions) {
      return {
        name: 'risk_level',
        description: 'High-risk actions are blocked',
        passed: false,
        severity: 'blocker',
        details: 'High-risk action blocked by safety config',
      };
    }

    if (isMediumRisk && this.config.requireApprovalForMediumRisk) {
      return {
        name: 'risk_level',
        description: 'Medium-risk actions require explicit approval',
        passed: true, // Pass but warn
        severity: 'warning',
        details: 'Medium-risk action - ensure explicit approval',
      };
    }

    return {
      name: 'risk_level',
      description: 'Risk level check',
      passed: true,
      severity: 'info',
      details: `Risk level: ${action.riskLevel}`,
    };
  }

  /**
   * Check for blocked URL patterns
   */
  private checkBlockedPatterns(action: SEOAction): SafetyCheckItem {
    if (!action.targetUrl) {
      return {
        name: 'blocked_patterns',
        description: 'Blocked URL pattern check',
        passed: true,
        severity: 'info',
      };
    }

    const isBlocked = this.config.blockedUrlPatterns.some(
      pattern => action.targetUrl?.includes(pattern)
    );

    return {
      name: 'blocked_patterns',
      description: 'Check against blocked URL patterns',
      passed: !isBlocked,
      severity: 'blocker',
      details: isBlocked ? `URL matches blocked pattern` : undefined,
    };
  }

  /**
   * Check that reasoning is provided
   */
  private checkReasoningProvided(action: SEOAction): SafetyCheckItem {
    const hasReasoning = Boolean(action.reasoning && action.reasoning.length > 20);
    const hasEvidence = Boolean(action.evidence && action.evidence.length > 0);

    return {
      name: SafetyRule.EXPLAIN_REASONING,
      description: 'Action must have clear reasoning and evidence',
      passed: hasReasoning && hasEvidence,
      severity: 'warning',
      details: !hasReasoning 
        ? 'Insufficient reasoning provided'
        : !hasEvidence 
        ? 'No evidence provided'
        : undefined,
    };
  }

  /**
   * Check content-specific safety
   */
  private checkContentAction(action: SEOAction): SafetyCheckItem {
    if (!this.config.requireContentReview) {
      return {
        name: 'content_review',
        description: 'Content review requirement',
        passed: true,
        severity: 'info',
        details: 'Content review disabled in config',
      };
    }

    return {
      name: 'content_review',
      description: 'Content changes require review',
      passed: true, // Pass but warn - actual review happens at approval
      severity: 'warning',
      details: 'Content changes should be reviewed before publishing',
    };
  }

  /**
   * Check internal link action safety
   */
  private checkInternalLinkAction(action: SEOAction): SafetyCheckItem {
    // Extract link count from action if available
    const linkCountMatch = action.description.match(/(\d+)\s*link/i);
    const estimatedLinks = linkCountMatch ? parseInt(linkCountMatch[1]) : 1;

    return {
      name: 'internal_link_limit',
      description: `Max ${this.config.maxInternalLinksPerAction} internal links per action`,
      passed: estimatedLinks <= this.config.maxInternalLinksPerAction,
      severity: 'warning',
      details: estimatedLinks > this.config.maxInternalLinksPerAction
        ? `Estimated ${estimatedLinks} links exceeds limit`
        : undefined,
    };
  }

  /**
   * Check technical action safety
   */
  private checkTechnicalAction(action: SEOAction): SafetyCheckItem {
    // Check for robots.txt modifications
    if (!this.config.allowRobotsTxtChanges) {
      const robotsPattern = /robots\.txt/i;
      if (robotsPattern.test(action.description) || robotsPattern.test(action.targetUrl || '')) {
        return {
          name: 'robots_txt_protection',
          description: 'robots.txt modifications are blocked',
          passed: false,
          severity: 'blocker',
          details: 'robots.txt changes blocked by safety config',
        };
      }
    }

    // Check for schema modifications
    if (!this.config.allowSchemaModifications && action.type === ActionType.FIX_SCHEMA_MARKUP) {
      return {
        name: 'schema_modification',
        description: 'Schema modifications are blocked',
        passed: false,
        severity: 'blocker',
        details: 'Schema changes blocked by safety config',
      };
    }

    return {
      name: 'technical_safety',
      description: 'Technical action safety check',
      passed: true,
      severity: 'info',
    };
  }

  // ============================================================================
  // EXECUTION TRACKING
  // ============================================================================

  /**
   * Record an execution for rate limiting
   */
  recordExecution(actionId: string, actionType: ActionType): void {
    this.executionHistory.push({
      timestamp: new Date().toISOString(),
      actionId,
      actionType,
    });

    // Clean up old history (keep 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    this.executionHistory = this.executionHistory.filter(e => e.timestamp > oneDayAgo);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    lastHour: number;
    last24Hours: number;
    byType: Record<string, number>;
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const lastHour = this.executionHistory.filter(e => e.timestamp > oneHourAgo).length;
    const last24Hours = this.executionHistory.filter(e => e.timestamp > oneDayAgo).length;

    const byType: Record<string, number> = {};
    for (const exec of this.executionHistory) {
      byType[exec.actionType] = (byType[exec.actionType] || 0) + 1;
    }

    return { lastHour, last24Hours, byType };
  }

  /**
   * Update safety configuration
   */
  updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log('[SafetyGate] Config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): SafetyConfig {
    return { ...this.config };
  }
}

export default SafetyGate;
