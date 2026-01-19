/**
 * Confidence-Weighted Orchestrator v1.3
 * 
 * Main coordinator for confidence-weighted auto-execution.
 * Integrates all v1.3 components and respects v1.1/v1.2 systems.
 * 
 * Flow:
 * 1. Calculate confidence score
 * 2. Resolve execution mode
 * 3. Execute (full, partial, or defer to manual)
 * 4. Log decision for audit
 * 5. Record outcome for calibration
 * 
 * Safety:
 * - Respects v1.1 policy engine (never exceeds allowed risk)
 * - Respects v1.2 debate decisions (blocked = blocked)
 * - Always maintains rollback availability
 */

import {
  ConfidenceScore,
  ExecutionMode,
  ExecutionModeResult,
  PartialExecutionResult,
  PartialExecutionConstraints,
  OutcomeObservation,
  ActionOutcome,
  V13ConfidenceConfig,
  DEFAULT_V13_CONFIDENCE_CONFIG,
  HistoricalAction,
  DataQualityInput,
  ConsensusInput,
  HistoricalInput,
  ScopeInput,
  SafetyInput,
  PolicyMargin,
} from './models_v2';
import { SEOAction, ActionType } from '../autonomous_agent/models';
import { 
  RiskClassification, 
  RiskLevel,
  ValidationResult,
  ExecutionOutcome,
  ExecutionStatus,
  CMSAdapter,
} from '../autonomous_agent_v1_1/models';
import { DebateOutput, AgentRole, AgentPosition } from '../debate_engine/models';

import { ConfidenceEngine, ConfidenceEngineInput } from './confidence_engine';
import { ExecutionModeResolver, canAutoExecute, canFullAutoExecute } from './execution_mode_resolver';
import { PartialExecutionController } from './partial_execution_controller';
import { ConfidenceCalibrator } from './confidence_calibrator';
import { ConfidenceAuditLogger } from './confidence_audit_logger';
import { AutoExecutor } from '../autonomous_agent_v1_1/auto_executor';

/**
 * Full execution decision with all context
 */
export interface ExecutionDecision {
  actionId: string;
  projectId: string;
  
  // Confidence calculation
  confidenceScore: ConfidenceScore;
  
  // Mode resolution
  modeResult: ExecutionModeResult;
  
  // Execution result (if auto-executed)
  executionOutcome?: ExecutionOutcome;
  partialResult?: PartialExecutionResult;
  
  // What requires manual attention
  manualReviewRequired: boolean;
  manualReviewItems: string[];
  
  // Audit reference
  auditEntryId?: string;
  
  decidedAt: string;
  durationMs: number;
}

/**
 * Input context for execution decision
 */
export interface ExecutionContext {
  action: SEOAction;
  riskClassification: RiskClassification;
  validation: ValidationResult;
  debateOutput?: DebateOutput;
  
  // Historical context
  historicalActions?: HistoricalAction[];
  
  // Data context
  dataAgeHours?: number;
  dataCompleteness?: number;
  dataSources?: number;
  dataValidated?: boolean;
  dataIssues?: string[];
  
  // Scope context
  totalSitePages?: number;
  contentChangePercent?: number;
  reversible?: boolean;
  scopeType?: 'single_element' | 'single_page' | 'multiple_pages' | 'site_wide';
  
  // Policy context
  policyMaxRisk?: number;
  policyMargins?: PolicyMargin[];
}

export class ConfidenceWeightedOrchestrator {
  private config: V13ConfidenceConfig;
  private confidenceEngine: ConfidenceEngine;
  private modeResolver: ExecutionModeResolver;
  private partialController: PartialExecutionController;
  private calibrator: ConfidenceCalibrator;
  private auditLogger: ConfidenceAuditLogger;
  private fullExecutor: AutoExecutor;
  private cmsAdapter?: CMSAdapter;
  
  constructor(config: Partial<V13ConfidenceConfig> & { projectId: string }) {
    this.config = { ...DEFAULT_V13_CONFIDENCE_CONFIG, ...config } as V13ConfidenceConfig;
    
    this.confidenceEngine = new ConfidenceEngine(this.config);
    this.modeResolver = new ExecutionModeResolver(
      this.config.thresholds,
      this.config.defaultPartialConstraints
    );
    this.partialController = new PartialExecutionController();
    this.calibrator = new ConfidenceCalibrator(this.config.calibrationRules);
    this.auditLogger = new ConfidenceAuditLogger(
      this.config.projectId,
      'system',
      this.config.enableAuditLogging
    );
    this.fullExecutor = new AutoExecutor({ dryRun: false, createSnapshots: true });
  }
  
  /**
   * Set CMS adapter for actual execution
   */
  setCMSAdapter(adapter: CMSAdapter): void {
    this.cmsAdapter = adapter;
    this.partialController.setCMSAdapter(adapter);
    this.fullExecutor.setCMSAdapter(adapter);
  }
  
  /**
   * Main entry point: Evaluate and potentially execute an action
   */
  async evaluateAndExecute(context: ExecutionContext): Promise<ExecutionDecision> {
    const startTime = Date.now();
    const { action, riskClassification, validation, debateOutput } = context;
    
    // Build confidence engine input
    const confidenceInput = this.buildConfidenceInput(context);
    
    // Calculate confidence score
    const confidenceScore = this.confidenceEngine.calculate(confidenceInput);
    
    // Resolve execution mode
    const modeResult = this.modeResolver.resolve(
      confidenceScore,
      riskClassification,
      debateOutput
    );
    
    // Log to audit
    const appliedRules = this.calibrator.getActiveRules().map(r => r.id);
    const auditEntry = this.auditLogger.logDecision(
      action.id,
      confidenceScore,
      modeResult,
      riskClassification,
      appliedRules
    );
    
    // Determine what to do
    let executionOutcome: ExecutionOutcome | undefined;
    let partialResult: PartialExecutionResult | undefined;
    const manualReviewItems: string[] = [];
    
    switch (modeResult.mode) {
      case ExecutionMode.FULL_AUTO:
        // Full auto-execution
        executionOutcome = await this.fullExecutor.execute(
          action,
          validation,
          riskClassification,
          this.config.projectId
        );
        break;
      
      case ExecutionMode.PARTIAL_AUTO:
        // Partial execution
        partialResult = await this.partialController.executePartial(
          action,
          modeResult,
          this.config.projectId
        );
        
        // Add remaining items to manual review
        for (const item of partialResult.remainingScope.itemsFlaggedForManual) {
          manualReviewItems.push(`${item.description}: ${item.reason}`);
        }
        break;
      
      case ExecutionMode.MANUAL_ONLY:
        manualReviewItems.push(
          `Action requires manual approval (confidence: ${(confidenceScore.overall * 100).toFixed(1)}%)`
        );
        for (const reason of modeResult.rationale) {
          manualReviewItems.push(`- ${reason}`);
        }
        break;
      
      case ExecutionMode.BLOCKED:
        manualReviewItems.push('Action is BLOCKED and cannot be executed');
        if (modeResult.blockedReasons) {
          for (const reason of modeResult.blockedReasons) {
            manualReviewItems.push(`- ${reason}`);
          }
        }
        break;
    }
    
    const decision: ExecutionDecision = {
      actionId: action.id,
      projectId: this.config.projectId,
      confidenceScore,
      modeResult,
      executionOutcome,
      partialResult,
      manualReviewRequired: modeResult.mode !== ExecutionMode.FULL_AUTO,
      manualReviewItems,
      auditEntryId: auditEntry?.id,
      decidedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
    
    return decision;
  }
  
  /**
   * Record outcome for calibration learning
   */
  recordOutcome(
    decision: ExecutionDecision,
    outcome: ActionOutcome,
    metricsBefore?: Record<string, number>,
    metricsAfter?: Record<string, number>,
    notes?: string
  ): void {
    const observation: OutcomeObservation = {
      actionId: decision.actionId,
      projectId: decision.projectId,
      outcome,
      confidenceAtExecution: decision.confidenceScore,
      observedAt: new Date().toISOString(),
      metricsBefore,
      metricsAfter,
      notes,
    };
    
    this.calibrator.recordOutcome(observation);
  }
  
  /**
   * Get calibration analysis
   */
  getCalibrationReport(): string {
    return this.calibrator.generateReport();
  }
  
  /**
   * Apply a calibration rule
   */
  applyCalibrationRule(ruleId: string): boolean {
    return this.calibrator.setRuleEnabled(ruleId, true);
  }
  
  /**
   * Get audit summary
   */
  getAuditSummary(): ReturnType<ConfidenceAuditLogger['getSummary']> {
    return this.auditLogger.getSummary();
  }
  
  /**
   * Get recent audit entries for dashboard
   */
  getRecentAuditEntries(count: number = 10): ReturnType<ConfidenceAuditLogger['formatForDashboard']>[] {
    return this.auditLogger.getRecent(count).map(e => this.auditLogger.formatForDashboard(e));
  }
  
  /**
   * Explain a decision (for dashboard)
   */
  explainDecision(decision: ExecutionDecision): string {
    let explanation = `# Execution Decision\n\n`;
    
    const modeEmoji: Record<ExecutionMode, string> = {
      [ExecutionMode.FULL_AUTO]: '✅',
      [ExecutionMode.PARTIAL_AUTO]: '⚠️',
      [ExecutionMode.MANUAL_ONLY]: '🔒',
      [ExecutionMode.BLOCKED]: '❌',
    };
    
    explanation += `## Summary\n`;
    explanation += `- **Action**: ${decision.actionId}\n`;
    explanation += `- **Mode**: ${modeEmoji[decision.modeResult.mode]} ${decision.modeResult.mode.replace('_', ' ').toUpperCase()}\n`;
    explanation += `- **Confidence**: ${(decision.confidenceScore.overall * 100).toFixed(1)}%\n`;
    explanation += `- **Risk**: ${decision.modeResult.riskLevel.toUpperCase()}\n\n`;
    
    explanation += `## Why This Level of Automation?\n\n`;
    
    // Explain confidence
    explanation += `### Confidence Factors\n`;
    for (const breakdown of decision.confidenceScore.breakdown) {
      const emoji = breakdown.rawScore >= 0.7 ? '🟢' : breakdown.rawScore >= 0.5 ? '🟡' : '🔴';
      explanation += `- ${emoji} **${breakdown.factor}**: ${(breakdown.rawScore * 100).toFixed(0)}%\n`;
      explanation += `  - ${breakdown.explanation}\n`;
    }
    
    explanation += `\n### Mode Rationale\n`;
    for (const reason of decision.modeResult.rationale) {
      explanation += `- ${reason}\n`;
    }
    
    if (decision.executionOutcome) {
      explanation += `\n## Execution Result\n`;
      explanation += `- **Status**: ${decision.executionOutcome.status}\n`;
      explanation += `- **Duration**: ${decision.executionOutcome.durationMs}ms\n`;
      if (decision.executionOutcome.error) {
        explanation += `- **Error**: ${decision.executionOutcome.error}\n`;
      }
    }
    
    if (decision.partialResult) {
      explanation += `\n## Partial Execution Result\n`;
      explanation += `- **Pages Affected**: ${decision.partialResult.executedScope.pagesAffected}\n`;
      explanation += `- **Links Added**: ${decision.partialResult.executedScope.linksAdded}\n`;
      explanation += `- **Pages Remaining**: ${decision.partialResult.remainingScope.pagesRemaining}\n`;
    }
    
    if (decision.manualReviewItems.length > 0) {
      explanation += `\n## Manual Review Required\n`;
      for (const item of decision.manualReviewItems) {
        explanation += `- ${item}\n`;
      }
    }
    
    explanation += `\n---\n`;
    explanation += `Decision ID: ${decision.auditEntryId || 'N/A'}\n`;
    explanation += `Duration: ${decision.durationMs}ms\n`;
    
    return explanation;
  }
  
  /**
   * Build confidence engine input from context
   */
  private buildConfidenceInput(context: ExecutionContext): ConfidenceEngineInput {
    const { action, riskClassification, debateOutput, historicalActions = [] } = context;
    
    // Data quality input
    const dataQuality: DataQualityInput = {
      dataAgeHours: context.dataAgeHours ?? 1,
      completenessPercent: context.dataCompleteness ?? 90,
      sourceCount: context.dataSources ?? 2,
      validated: context.dataValidated ?? true,
      knownIssues: context.dataIssues ?? [],
    };
    
    // Consensus input (from debate output)
    const agentPositions: Record<AgentRole, AgentPosition> = {
      [AgentRole.SEO]: AgentPosition.SUPPORT,
      [AgentRole.RISK]: AgentPosition.SUPPORT,
      [AgentRole.BRAND]: AgentPosition.SUPPORT,
    };
    
    const agentConfidences: Record<AgentRole, number> = {
      [AgentRole.SEO]: 70,
      [AgentRole.RISK]: 70,
      [AgentRole.BRAND]: 70,
    };
    
    let hasCriticalConflicts = false;
    
    if (debateOutput) {
      // Extract from debate output
      for (const role of [AgentRole.SEO, AgentRole.RISK, AgentRole.BRAND]) {
        const evaluation = debateOutput.evaluations[role];
        if (evaluation) {
          agentPositions[role] = evaluation.position;
          agentConfidences[role] = evaluation.confidence;
        }
      }
      
      hasCriticalConflicts = debateOutput.conflictAnalysis.conflicts
        .some(c => c.severity === 'critical');
    }
    
    const consensus: ConsensusInput = {
      debateOutput: debateOutput!,
      agentPositions,
      agentConfidences,
      hasCriticalConflicts,
      debateRounds: 1,
    };
    
    // Historical input
    const history: HistoricalInput = {
      similarActions: historicalActions.filter(
        a => a.actionType === action.type || a.riskLevel === riskClassification.level
      ),
      actionType: action.type,
      riskLevel: riskClassification.level,
      minSampleSize: this.config.minHistorySampleSize,
    };
    
    // Scope input
    const scope: ScopeInput = {
      pagesAffected: 1, // Default single page
      totalSitePages: context.totalSitePages ?? 100,
      contentChangePercent: context.contentChangePercent ?? 5,
      reversible: context.reversible ?? true,
      scopeType: context.scopeType ?? 'single_page',
    };
    
    // Safety input
    const safety: SafetyInput = {
      riskScore: riskClassification.score,
      policyMaxRisk: context.policyMaxRisk ?? 70,
      respectsPolicyLimits: riskClassification.autoExecutable,
      policyMargins: context.policyMargins ?? [],
    };
    
    return {
      dataQuality,
      consensus,
      history,
      scope,
      safety,
    };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): V13ConfidenceConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<V13ConfidenceConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (updates.weights) {
      this.confidenceEngine.setWeights(updates.weights);
    }
    
    if (updates.thresholds) {
      this.modeResolver.setThresholds(updates.thresholds);
    }
  }
}

/**
 * Factory function
 */
export function createConfidenceWeightedOrchestrator(
  projectId: string,
  overrides: Partial<V13ConfidenceConfig> = {}
): ConfidenceWeightedOrchestrator {
  return new ConfidenceWeightedOrchestrator({ projectId, ...overrides });
}
