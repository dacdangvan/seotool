/**
 * Veto Controller
 * 
 * Implements Risk Agent veto power for HIGH+ risk actions.
 * 
 * Addresses v1.2 flaw: "Risk Agent Can Be Outvoted"
 * - SEO (SUPPORT 100) + BRAND (SUPPORT 100) could override RISK (OPPOSE 0)
 * - Weighted score: (100×0.35 + 100×0.30) / 0.65 = 100 → APPROVE despite Risk opposition
 * 
 * v1.3 Solution:
 * - Risk agent gets VETO power on HIGH/CRITICAL risk actions
 * - Veto is triggered when Risk agent OPPOSES with high confidence
 * - Veto can only be overridden by human intervention (audited)
 */

import {
  VetoRule,
  VetoEvaluation,
  VetoTriggerCondition,
  DEFAULT_VETO_RULES,
  AgentRole,
  AgentPosition,
  AuditEntry,
  AuditEventType,
  ExtendedRiskLevel,
  getExtendedRiskLevel,
  isCriticalRisk,
} from './models';
import { RiskClassification } from '../autonomous_agent_v1_1/models';
import { AgentEvaluation } from '../debate_engine/models';

const HIGH_CONFIDENCE_THRESHOLD = 80;

/**
 * Evaluates if veto should be triggered
 */
export function evaluateVeto(
  evaluations: AgentEvaluation[],
  riskClassification: RiskClassification,
  vetoRules: VetoRule[] = DEFAULT_VETO_RULES
): VetoEvaluation {
  // Find Risk agent's evaluation
  const riskEvaluation = evaluations.find(e => e.agentRole === AgentRole.RISK);
  
  // No Risk agent = no veto
  if (!riskEvaluation) {
    return {
      vetoTriggered: false,
      overridable: true,
      evaluatedAt: new Date().toISOString(),
    };
  }
  
  // Check each enabled veto rule
  for (const rule of vetoRules) {
    if (!rule.enabled) continue;
    if (rule.agentRole !== AgentRole.RISK) continue; // Only Risk agent can veto
    
    const triggered = checkVetoCondition(
      rule.triggerCondition,
      riskEvaluation,
      riskClassification
    );
    
    if (triggered) {
      return {
        vetoTriggered: true,
        triggeringRule: rule,
        vetoingAgent: AgentRole.RISK,
        reason: buildVetoReason(rule, riskEvaluation, riskClassification),
        overridable: !isCriticalRisk(riskClassification.score),
        evaluatedAt: new Date().toISOString(),
      };
    }
  }
  
  return {
    vetoTriggered: false,
    overridable: true,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Checks if a specific veto condition is met
 */
function checkVetoCondition(
  condition: VetoTriggerCondition,
  riskEvaluation: AgentEvaluation,
  riskClassification: RiskClassification
): boolean {
  const extendedLevel = getExtendedRiskLevel(riskClassification.score);
  
  switch (condition) {
    case VetoTriggerCondition.HIGH_RISK_OPPOSE:
      // Risk agent opposes AND risk level is HIGH or CRITICAL
      return (
        riskEvaluation.position === AgentPosition.OPPOSE &&
        (extendedLevel === ExtendedRiskLevel.HIGH ||
          extendedLevel === ExtendedRiskLevel.CRITICAL)
      );
    
    case VetoTriggerCondition.CRITICAL_RISK_ANY:
      // Any CRITICAL risk action triggers veto regardless of position
      return isCriticalRisk(riskClassification.score);
    
    case VetoTriggerCondition.RISK_SCORE_ABOVE_THRESHOLD:
      // Risk score above threshold (e.g., 80)
      return riskClassification.score >= 80;
    
    case VetoTriggerCondition.HIGH_CONFIDENCE_OPPOSE:
      // Risk agent opposes with high confidence
      return (
        riskEvaluation.position === AgentPosition.OPPOSE &&
        riskEvaluation.confidence >= HIGH_CONFIDENCE_THRESHOLD
      );
    
    default:
      return false;
  }
}

/**
 * Builds human-readable veto reason
 */
function buildVetoReason(
  rule: VetoRule,
  riskEvaluation: AgentEvaluation,
  riskClassification: RiskClassification
): string {
  const extendedLevel = getExtendedRiskLevel(riskClassification.score);
  const primaryConcern = riskEvaluation.reasoning[0]?.statement || 'Risk concerns identified';
  
  switch (rule.triggerCondition) {
    case VetoTriggerCondition.HIGH_RISK_OPPOSE:
      return `Risk Agent vetoed: ${extendedLevel.toUpperCase()} risk level with OPPOSE position. ` +
        `Primary concern: ${primaryConcern}`;
    
    case VetoTriggerCondition.CRITICAL_RISK_ANY:
      return `Automatic veto: CRITICAL risk level detected. ` +
        `Risk score: ${riskClassification.score}/100. ` +
        `Explanation: ${riskClassification.explanation}`;
    
    case VetoTriggerCondition.RISK_SCORE_ABOVE_THRESHOLD:
      return `Risk score veto: ${riskClassification.score}/100 exceeds threshold. ` +
        `Factors: ${riskClassification.factors.map(f => f.name).join(', ')}`;
    
    case VetoTriggerCondition.HIGH_CONFIDENCE_OPPOSE:
      return `High-confidence veto: Risk Agent opposes with ${riskEvaluation.confidence}% confidence. ` +
        `Reasoning: ${primaryConcern}`;
    
    default:
      return `Veto triggered by rule: ${rule.description}`;
  }
}

/**
 * Checks if veto can be overridden (requires human intervention)
 */
export function canOverrideVeto(evaluation: VetoEvaluation): {
  canOverride: boolean;
  requirements: string[];
} {
  if (!evaluation.vetoTriggered) {
    return { canOverride: true, requirements: [] };
  }
  
  if (!evaluation.overridable) {
    return {
      canOverride: false,
      requirements: ['CRITICAL risk actions cannot have veto overridden'],
    };
  }
  
  return {
    canOverride: true,
    requirements: [
      'Human approval required (authorized user)',
      'Override reason must be documented',
      'Action will be logged in immutable audit trail',
      'Additional monitoring will be enabled',
    ],
  };
}

/**
 * Creates audit entry for veto override
 */
export function createVetoOverrideAuditEntry(
  projectId: string,
  actorId: string,
  evaluation: VetoEvaluation,
  overrideReason: string
): AuditEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    eventType: AuditEventType.VETO_OVERRIDE,
    actorId,
    projectId,
    details: {
      vetoRule: evaluation.triggeringRule?.id,
      vetoReason: evaluation.reason,
      overrideReason,
      vetoingAgent: evaluation.vetoingAgent,
    },
    previousValue: { vetoTriggered: true },
    newValue: { vetoTriggered: false, overridden: true },
    checksum: '', // Will be computed by audit logger
  };
}

/**
 * Gets all active veto rules
 */
export function getActiveVetoRules(
  rules: VetoRule[] = DEFAULT_VETO_RULES
): VetoRule[] {
  return rules.filter(r => r.enabled);
}

/**
 * Explains veto evaluation result
 */
export function explainVetoEvaluation(evaluation: VetoEvaluation): string {
  if (!evaluation.vetoTriggered) {
    return 'No veto triggered. Action proceeds to normal evaluation.';
  }
  
  let explanation = `⛔ VETO TRIGGERED by ${evaluation.vetoingAgent}\n`;
  explanation += `Reason: ${evaluation.reason}\n`;
  explanation += `Rule: ${evaluation.triggeringRule?.description}\n`;
  explanation += `Overridable: ${evaluation.overridable ? 'Yes (requires human approval)' : 'No (CRITICAL risk)'}`;
  
  return explanation;
}

export class VetoController {
  private rules: VetoRule[];
  
  constructor(rules: VetoRule[] = DEFAULT_VETO_RULES) {
    this.rules = rules;
  }
  
  evaluate(
    evaluations: AgentEvaluation[],
    riskClassification: RiskClassification
  ): VetoEvaluation {
    return evaluateVeto(evaluations, riskClassification, this.rules);
  }
  
  canOverride(evaluation: VetoEvaluation): {
    canOverride: boolean;
    requirements: string[];
  } {
    return canOverrideVeto(evaluation);
  }
  
  createOverrideAudit(
    projectId: string,
    actorId: string,
    evaluation: VetoEvaluation,
    overrideReason: string
  ): AuditEntry {
    return createVetoOverrideAuditEntry(projectId, actorId, evaluation, overrideReason);
  }
  
  explain(evaluation: VetoEvaluation): string {
    return explainVetoEvaluation(evaluation);
  }
  
  getActiveRules(): VetoRule[] {
    return getActiveVetoRules(this.rules);
  }
  
  addRule(rule: VetoRule): void {
    // Check for duplicate ID
    if (this.rules.some(r => r.id === rule.id)) {
      throw new Error(`Veto rule with ID ${rule.id} already exists`);
    }
    this.rules.push(rule);
  }
  
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;
    this.rules.splice(index, 1);
    return true;
  }
  
  enableRule(ruleId: string): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return false;
    rule.enabled = true;
    return true;
  }
  
  disableRule(ruleId: string): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return false;
    rule.enabled = false;
    return true;
  }
  
  getRules(): VetoRule[] {
    return [...this.rules];
  }
}
