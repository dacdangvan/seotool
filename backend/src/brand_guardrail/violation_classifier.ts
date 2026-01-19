/**
 * Violation Classifier v1.4
 * 
 * Classifies brand violations by severity and determines
 * appropriate response actions.
 * 
 * Classification Rules:
 * - BLOCKING: Must halt execution
 * - WARNING: Allow with logged warning
 * - INFO: Track for analytics only
 * 
 * Design Principles:
 * - Deterministic classification
 * - Explainable decisions
 * - Configurable thresholds
 */

import {
  BrandViolation,
  ViolationType,
  ViolationSeverity,
  BrandGuardrailConfig,
  DEFAULT_BRAND_GUARDRAIL_CONFIG,
} from './models';

// ============================================================================
// DEFAULT SEVERITY MAPPING
// ============================================================================

/**
 * Default severity mapping for each violation type
 */
export const DEFAULT_SEVERITY_MAP: Record<ViolationType, ViolationSeverity> = {
  // Blocking by default
  [ViolationType.PROHIBITED_PHRASE]: ViolationSeverity.BLOCKING,
  [ViolationType.PROHIBITED_TERM]: ViolationSeverity.BLOCKING,
  [ViolationType.COMPETITOR_MENTION]: ViolationSeverity.BLOCKING,
  [ViolationType.SENSITIVE_TOPIC]: ViolationSeverity.BLOCKING,
  
  // Warning by default
  [ViolationType.TONE_MISMATCH]: ViolationSeverity.WARNING,
  [ViolationType.FORMALITY_DEVIATION]: ViolationSeverity.WARNING,
  [ViolationType.FORMALITY_DRIFT]: ViolationSeverity.WARNING,
  [ViolationType.AVOIDED_VOCABULARY]: ViolationSeverity.WARNING,
  [ViolationType.OFF_BRAND_VOCABULARY]: ViolationSeverity.WARNING,
  [ViolationType.KEYWORD_STUFFING]: ViolationSeverity.WARNING,
  [ViolationType.OVER_PROMOTIONAL]: ViolationSeverity.WARNING,
  [ViolationType.BRAND_VOICE_DRIFT]: ViolationSeverity.WARNING,
  [ViolationType.CTA_OVERUSE]: ViolationSeverity.WARNING,
  [ViolationType.CTA_INTENSITY_MISMATCH]: ViolationSeverity.WARNING,
  [ViolationType.CTA_FREQUENCY_VIOLATION]: ViolationSeverity.WARNING,
  
  // Info by default
  [ViolationType.SENTENCE_LENGTH]: ViolationSeverity.INFO,
  [ViolationType.SENTENCE_LENGTH_VIOLATION]: ViolationSeverity.INFO,
  [ViolationType.STRUCTURE_MISMATCH]: ViolationSeverity.INFO,
  [ViolationType.READABILITY]: ViolationSeverity.INFO,
  [ViolationType.CTA_STYLE]: ViolationSeverity.INFO,
};

// ============================================================================
// CLASSIFIER INTERFACE
// ============================================================================

export interface ClassificationResult {
  originalSeverity: ViolationSeverity;
  finalSeverity: ViolationSeverity;
  wasEscalated: boolean;
  wasDowngraded: boolean;
  escalationReason?: string;
  downgradeReason?: string;
}

export interface ClassificationContext {
  violationCount: number;
  repeatedViolations: number;
  previousBlocking: boolean;
  contentLength: number;
  isHighValueContent: boolean;
}

// ============================================================================
// VIOLATION CLASSIFIER
// ============================================================================

export class ViolationClassifier {
  private config: BrandGuardrailConfig;
  private logger: Console;
  
  constructor(config: Partial<BrandGuardrailConfig> = {}) {
    this.config = { ...DEFAULT_BRAND_GUARDRAIL_CONFIG, ...config };
    this.logger = console;
  }
  
  /**
   * Get severity for a violation type
   */
  getSeverity(type: ViolationType): ViolationSeverity {
    // Check for overrides first
    if (this.config.severityOverrides[type]) {
      return this.config.severityOverrides[type]!;
    }
    
    // Fall back to default
    return DEFAULT_SEVERITY_MAP[type] || ViolationSeverity.WARNING;
  }
  
  /**
   * Classify a violation with context
   */
  classify(
    violation: BrandViolation,
    context: Partial<ClassificationContext> = {}
  ): ClassificationResult {
    const originalSeverity = violation.severity;
    let finalSeverity = originalSeverity;
    let wasEscalated = false;
    let wasDowngraded = false;
    let escalationReason: string | undefined;
    let downgradeReason: string | undefined;
    
    // Check for escalation conditions
    const escalation = this.checkEscalation(violation, context);
    if (escalation.shouldEscalate) {
      finalSeverity = escalation.newSeverity;
      wasEscalated = true;
      escalationReason = escalation.reason;
    }
    
    // Check for downgrade conditions (only if not escalated)
    if (!wasEscalated) {
      const downgrade = this.checkDowngrade(violation, context);
      if (downgrade.shouldDowngrade) {
        finalSeverity = downgrade.newSeverity;
        wasDowngraded = true;
        downgradeReason = downgrade.reason;
      }
    }
    
    return {
      originalSeverity,
      finalSeverity,
      wasEscalated,
      wasDowngraded,
      escalationReason,
      downgradeReason,
    };
  }
  
  /**
   * Classify multiple violations and return summary
   */
  classifyMultiple(
    violations: BrandViolation[],
    context: Partial<ClassificationContext> = {}
  ): ClassificationSummary {
    const results: Map<string, ClassificationResult> = new Map();
    
    let blockingCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let escalatedCount = 0;
    let downgradedCount = 0;
    
    for (const violation of violations) {
      const result = this.classify(violation, context);
      results.set(violation.id, result);
      
      switch (result.finalSeverity) {
        case ViolationSeverity.BLOCKING:
          blockingCount++;
          break;
        case ViolationSeverity.WARNING:
          warningCount++;
          break;
        case ViolationSeverity.INFO:
          infoCount++;
          break;
      }
      
      if (result.wasEscalated) escalatedCount++;
      if (result.wasDowngraded) downgradedCount++;
    }
    
    const overallSeverity = this.determineOverallSeverity(blockingCount, warningCount);
    const canProceed = blockingCount === 0;
    
    return {
      totalViolations: violations.length,
      blockingCount,
      warningCount,
      infoCount,
      escalatedCount,
      downgradedCount,
      overallSeverity,
      canProceed,
      results,
    };
  }
  
  /**
   * Check if violation should be escalated
   */
  private checkEscalation(
    violation: BrandViolation,
    context: Partial<ClassificationContext>
  ): EscalationDecision {
    // Can't escalate beyond BLOCKING
    if (violation.severity === ViolationSeverity.BLOCKING) {
      return { shouldEscalate: false, newSeverity: violation.severity };
    }
    
    // Escalate WARNING to BLOCKING if repeated
    if (
      violation.severity === ViolationSeverity.WARNING &&
      context.repeatedViolations !== undefined &&
      context.repeatedViolations >= 3
    ) {
      return {
        shouldEscalate: true,
        newSeverity: ViolationSeverity.BLOCKING,
        reason: `Repeated violation (${context.repeatedViolations} occurrences)`,
      };
    }
    
    // Escalate INFO to WARNING if too many
    if (
      violation.severity === ViolationSeverity.INFO &&
      context.violationCount !== undefined &&
      context.violationCount >= 10
    ) {
      return {
        shouldEscalate: true,
        newSeverity: ViolationSeverity.WARNING,
        reason: `High violation count (${context.violationCount} total)`,
      };
    }
    
    // Escalate for high-value content
    if (
      violation.severity === ViolationSeverity.INFO &&
      context.isHighValueContent === true
    ) {
      return {
        shouldEscalate: true,
        newSeverity: ViolationSeverity.WARNING,
        reason: 'High-value content requires stricter standards',
      };
    }
    
    // Low confidence escalation
    if (
      violation.confidence < 0.5 &&
      violation.severity === ViolationSeverity.INFO
    ) {
      // Don't escalate low-confidence violations
    }
    
    return { shouldEscalate: false, newSeverity: violation.severity };
  }
  
  /**
   * Check if violation should be downgraded
   */
  private checkDowngrade(
    violation: BrandViolation,
    context: Partial<ClassificationContext>
  ): DowngradeDecision {
    // Can't downgrade INFO
    if (violation.severity === ViolationSeverity.INFO) {
      return { shouldDowngrade: false, newSeverity: violation.severity };
    }
    
    // Downgrade low-confidence warnings to info
    if (
      violation.severity === ViolationSeverity.WARNING &&
      violation.confidence < 0.5
    ) {
      return {
        shouldDowngrade: true,
        newSeverity: ViolationSeverity.INFO,
        reason: `Low confidence detection (${(violation.confidence * 100).toFixed(0)}%)`,
      };
    }
    
    // Downgrade for very short content (may be false positive)
    if (
      violation.severity === ViolationSeverity.WARNING &&
      context.contentLength !== undefined &&
      context.contentLength < 100
    ) {
      return {
        shouldDowngrade: true,
        newSeverity: ViolationSeverity.INFO,
        reason: 'Short content may have reduced accuracy',
      };
    }
    
    return { shouldDowngrade: false, newSeverity: violation.severity };
  }
  
  /**
   * Determine overall severity from counts
   */
  private determineOverallSeverity(
    blockingCount: number,
    warningCount: number
  ): ViolationSeverity {
    if (blockingCount > 0) return ViolationSeverity.BLOCKING;
    if (warningCount > 0) return ViolationSeverity.WARNING;
    return ViolationSeverity.INFO;
  }
  
  /**
   * Get explanation for classification
   */
  explainClassification(result: ClassificationResult): string {
    const parts: string[] = [];
    
    parts.push(`Base severity: ${result.originalSeverity}`);
    
    if (result.wasEscalated) {
      parts.push(`Escalated to ${result.finalSeverity}: ${result.escalationReason}`);
    } else if (result.wasDowngraded) {
      parts.push(`Downgraded to ${result.finalSeverity}: ${result.downgradeReason}`);
    } else {
      parts.push(`Final severity: ${result.finalSeverity} (no adjustment)`);
    }
    
    return parts.join('. ');
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<BrandGuardrailConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface EscalationDecision {
  shouldEscalate: boolean;
  newSeverity: ViolationSeverity;
  reason?: string;
}

interface DowngradeDecision {
  shouldDowngrade: boolean;
  newSeverity: ViolationSeverity;
  reason?: string;
}

export interface ClassificationSummary {
  totalViolations: number;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  escalatedCount: number;
  downgradedCount: number;
  overallSeverity: ViolationSeverity;
  canProceed: boolean;
  results: Map<string, ClassificationResult>;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createViolationClassifier(
  config?: Partial<BrandGuardrailConfig>
): ViolationClassifier {
  return new ViolationClassifier(config);
}
