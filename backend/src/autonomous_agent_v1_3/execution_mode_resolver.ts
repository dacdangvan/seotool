/**
 * Execution Mode Resolver v1.3
 * 
 * Determines execution mode based on confidence score and risk level:
 * - CONFIDENCE < 0.60 → NO AUTO-EXECUTION (manual approval required)
 * - 0.60 ≤ CONFIDENCE < 0.80 → PARTIAL AUTO-EXECUTION
 * - CONFIDENCE ≥ 0.80 → FULL AUTO-EXECUTION (low-risk only)
 * 
 * Safety Rules:
 * - HIGH risk actions NEVER auto-execute regardless of confidence
 * - MEDIUM risk actions max at PARTIAL execution
 * - Only LOW risk can reach FULL AUTO-EXECUTION
 * - Blocked actions cannot execute regardless of confidence
 */

import {
  ExecutionMode,
  ExecutionModeResult,
  ExecutionThresholds,
  DEFAULT_EXECUTION_THRESHOLDS,
  ConfidenceScore,
  PartialExecutionConstraints,
  DEFAULT_V13_CONFIDENCE_CONFIG,
  RiskLevel,
  RiskClassification,
} from './models_v2';
import { DebateOutput, DebateDecision } from '../debate_engine/models';

export class ExecutionModeResolver {
  private thresholds: ExecutionThresholds;
  private defaultPartialConstraints: PartialExecutionConstraints;
  
  constructor(
    thresholds: ExecutionThresholds = DEFAULT_EXECUTION_THRESHOLDS,
    defaultPartialConstraints: PartialExecutionConstraints = DEFAULT_V13_CONFIDENCE_CONFIG.defaultPartialConstraints
  ) {
    this.thresholds = thresholds;
    this.defaultPartialConstraints = defaultPartialConstraints;
  }
  
  /**
   * Resolve execution mode for an action
   */
  resolve(
    confidenceScore: ConfidenceScore,
    riskClassification: RiskClassification,
    debateOutput?: DebateOutput
  ): ExecutionModeResult {
    const rationale: string[] = [];
    const blockedReasons: string[] = [];
    
    const riskLevel = riskClassification.level;
    const confidence = confidenceScore.overall;
    
    // Check for blocking conditions first
    if (this.isBlocked(riskClassification, debateOutput, blockedReasons)) {
      return {
        mode: ExecutionMode.BLOCKED,
        confidenceScore,
        riskLevel,
        rationale: ['Action is blocked due to policy or debate decision'],
        blockedReasons,
        resolvedAt: new Date().toISOString(),
      };
    }
    
    // Determine mode based on confidence and risk
    const mode = this.determineMode(confidence, riskLevel, rationale);
    
    // Calculate partial constraints if applicable
    const partialConstraints = mode === ExecutionMode.PARTIAL_AUTO
      ? this.calculatePartialConstraints(confidenceScore, riskLevel)
      : undefined;
    
    return {
      mode,
      confidenceScore,
      riskLevel,
      rationale,
      partialConstraints,
      resolvedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Check if action is blocked
   */
  private isBlocked(
    riskClassification: RiskClassification,
    debateOutput?: DebateOutput,
    blockedReasons: string[] = []
  ): boolean {
    // Check debate decision
    if (debateOutput?.decision.decision === DebateDecision.REJECT) {
      blockedReasons.push('Debate decision: REJECT');
      return true;
    }
    
    // Check if risk score exceeds maximum
    if (riskClassification.score >= 90) {
      blockedReasons.push(`Risk score ${riskClassification.score} exceeds safety threshold (90)`);
      return true;
    }
    
    // Check if action is not auto-executable per v1.1 policy
    if (!riskClassification.autoExecutable) {
      blockedReasons.push('Action not marked as auto-executable by policy engine');
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine execution mode based on confidence and risk
   */
  private determineMode(
    confidence: number,
    riskLevel: RiskLevel,
    rationale: string[]
  ): ExecutionMode {
    // HIGH risk: Never auto-execute
    if (riskLevel === RiskLevel.HIGH) {
      rationale.push('HIGH risk actions require manual approval regardless of confidence');
      return ExecutionMode.MANUAL_ONLY;
    }
    
    // Below minimum threshold: Manual only
    if (confidence < this.thresholds.partialAutoMin) {
      rationale.push(
        `Confidence ${(confidence * 100).toFixed(1)}% below partial threshold ${(this.thresholds.partialAutoMin * 100).toFixed(0)}%`
      );
      return ExecutionMode.MANUAL_ONLY;
    }
    
    // MEDIUM risk: Max at partial
    if (riskLevel === RiskLevel.MEDIUM) {
      if (confidence >= this.thresholds.partialAutoMin) {
        rationale.push(
          `MEDIUM risk with confidence ${(confidence * 100).toFixed(1)}% qualifies for PARTIAL auto-execution`
        );
        return ExecutionMode.PARTIAL_AUTO;
      }
      rationale.push('MEDIUM risk with low confidence requires manual approval');
      return ExecutionMode.MANUAL_ONLY;
    }
    
    // LOW risk: Can reach full auto
    if (riskLevel === RiskLevel.LOW) {
      if (confidence >= this.thresholds.fullAutoMin) {
        rationale.push(
          `LOW risk with confidence ${(confidence * 100).toFixed(1)}% qualifies for FULL auto-execution`
        );
        return ExecutionMode.FULL_AUTO;
      }
      
      if (confidence >= this.thresholds.partialAutoMin) {
        rationale.push(
          `LOW risk with confidence ${(confidence * 100).toFixed(1)}% qualifies for PARTIAL auto-execution`
        );
        return ExecutionMode.PARTIAL_AUTO;
      }
      
      rationale.push(
        `LOW risk but confidence ${(confidence * 100).toFixed(1)}% below threshold`
      );
      return ExecutionMode.MANUAL_ONLY;
    }
    
    // Default fallback
    rationale.push('Defaulting to manual approval for safety');
    return ExecutionMode.MANUAL_ONLY;
  }
  
  /**
   * Calculate partial execution constraints based on confidence
   */
  private calculatePartialConstraints(
    confidenceScore: ConfidenceScore,
    riskLevel: RiskLevel
  ): PartialExecutionConstraints {
    const confidence = confidenceScore.overall;
    const base = this.defaultPartialConstraints;
    
    // Scale constraints based on confidence level
    // Higher confidence = more permissive constraints
    const scaleFactor = (confidence - this.thresholds.partialAutoMin) / 
      (this.thresholds.fullAutoMin - this.thresholds.partialAutoMin);
    
    // Risk level modifier
    const riskModifier = riskLevel === RiskLevel.LOW ? 1.5 : 1.0;
    
    // Calculate adjusted constraints
    const maxContentChangePercent = Math.min(
      base.maxContentChangePercent * (1 + scaleFactor * 0.5) * riskModifier,
      25 // Hard cap at 25%
    );
    
    const maxInternalLinks = Math.min(
      Math.floor(base.maxInternalLinks * (1 + scaleFactor * 0.5) * riskModifier),
      10 // Hard cap at 10
    );
    
    const maxPagesAffected = Math.min(
      Math.floor(base.maxPagesAffected * (1 + scaleFactor * 0.5) * riskModifier),
      20 // Hard cap at 20
    );
    
    // Determine if sampling is required
    const samplePagesOnly = confidence < 0.75 || riskLevel === RiskLevel.MEDIUM;
    const sampleSize = samplePagesOnly 
      ? Math.max(1, Math.floor(maxPagesAffected * 0.3))
      : undefined;
    
    return {
      maxContentChangePercent: Math.round(maxContentChangePercent * 10) / 10,
      maxInternalLinks,
      maxPagesAffected,
      samplePagesOnly,
      sampleSize,
      manualApprovalRequired: [], // Will be populated by PartialExecutionController
    };
  }
  
  /**
   * Explain the mode decision
   */
  explainDecision(result: ExecutionModeResult): string {
    let explanation = `## Execution Mode Decision\n\n`;
    
    const modeEmoji: Record<ExecutionMode, string> = {
      [ExecutionMode.FULL_AUTO]: '✅',
      [ExecutionMode.PARTIAL_AUTO]: '⚠️',
      [ExecutionMode.MANUAL_ONLY]: '🔒',
      [ExecutionMode.BLOCKED]: '❌',
    };
    
    explanation += `**Mode**: ${modeEmoji[result.mode]} ${result.mode.replace('_', ' ').toUpperCase()}\n\n`;
    explanation += `**Confidence**: ${(result.confidenceScore.overall * 100).toFixed(1)}%\n`;
    explanation += `**Risk Level**: ${result.riskLevel.toUpperCase()}\n\n`;
    
    explanation += `### Rationale\n`;
    for (const reason of result.rationale) {
      explanation += `- ${reason}\n`;
    }
    
    if (result.blockedReasons && result.blockedReasons.length > 0) {
      explanation += `\n### Blocking Reasons\n`;
      for (const reason of result.blockedReasons) {
        explanation += `- ❌ ${reason}\n`;
      }
    }
    
    if (result.partialConstraints) {
      explanation += `\n### Partial Execution Constraints\n`;
      explanation += `- Max content change: ${result.partialConstraints.maxContentChangePercent}%\n`;
      explanation += `- Max internal links: ${result.partialConstraints.maxInternalLinks}\n`;
      explanation += `- Max pages affected: ${result.partialConstraints.maxPagesAffected}\n`;
      explanation += `- Sample pages only: ${result.partialConstraints.samplePagesOnly ? 'Yes' : 'No'}\n`;
      if (result.partialConstraints.sampleSize) {
        explanation += `- Sample size: ${result.partialConstraints.sampleSize}\n`;
      }
    }
    
    return explanation;
  }
  
  /**
   * Get confidence thresholds for display
   */
  getThresholds(): ExecutionThresholds {
    return { ...this.thresholds };
  }
  
  /**
   * Update thresholds
   */
  setThresholds(thresholds: Partial<ExecutionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    
    // Validate
    if (this.thresholds.partialAutoMin >= this.thresholds.fullAutoMin) {
      throw new Error('partialAutoMin must be less than fullAutoMin');
    }
  }
}

/**
 * Quick check functions for common use cases
 */

export function canAutoExecute(result: ExecutionModeResult): boolean {
  return result.mode === ExecutionMode.FULL_AUTO || result.mode === ExecutionMode.PARTIAL_AUTO;
}

export function canFullAutoExecute(result: ExecutionModeResult): boolean {
  return result.mode === ExecutionMode.FULL_AUTO;
}

export function requiresManualApproval(result: ExecutionModeResult): boolean {
  return result.mode === ExecutionMode.MANUAL_ONLY || result.mode === ExecutionMode.BLOCKED;
}

export function isBlocked(result: ExecutionModeResult): boolean {
  return result.mode === ExecutionMode.BLOCKED;
}
