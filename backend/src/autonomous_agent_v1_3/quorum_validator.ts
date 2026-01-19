/**
 * Quorum Validator
 * 
 * Ensures minimum agent participation before decisions are made.
 * 
 * Addresses v1.2 flaw: "No Quorum Requirement"
 * - If Brand agent is disabled, remaining two could pass HIGH-risk actions
 * - Now requires minimum 2/3 agents enabled
 * - Risk agent must be present for any decision
 */

import {
  QuorumConfig,
  QuorumEvaluation,
  DEFAULT_QUORUM_CONFIG,
  AgentRole,
} from './models';
import { AgentConfig, DEFAULT_AGENT_CONFIGS } from '../debate_engine/models';

const ALL_AGENTS: AgentRole[] = [AgentRole.SEO, AgentRole.RISK, AgentRole.BRAND];

/**
 * Validates that quorum requirements are met
 */
export function validateQuorum(
  enabledAgents: AgentRole[],
  config: QuorumConfig = DEFAULT_QUORUM_CONFIG
): QuorumEvaluation {
  const totalAgents = ALL_AGENTS.length;
  const enabledCount = enabledAgents.length;
  
  // Calculate required agents from percentage
  const requiredByPercentage = Math.ceil(totalAgents * (config.minimumPercentage / 100));
  const requiredAgents = Math.max(config.minimumAgents, requiredByPercentage);
  
  // Check if Risk agent is present (if required)
  const riskAgentPresent = enabledAgents.includes(AgentRole.RISK);
  const riskRequirementMet = !config.requireRiskAgent || riskAgentPresent;
  
  // Find missing agents
  const missingAgents = ALL_AGENTS.filter(agent => !enabledAgents.includes(agent));
  
  // Quorum is met if:
  // 1. Enough agents are enabled
  // 2. Risk agent requirement is satisfied
  const quorumMet = enabledCount >= requiredAgents && riskRequirementMet;
  
  return {
    quorumMet,
    totalAgents,
    enabledAgents: enabledCount,
    requiredAgents,
    missingAgents,
    riskAgentPresent,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Validates quorum from agent configs
 */
export function validateQuorumFromConfigs(
  agentConfigs: AgentConfig[],
  config: QuorumConfig = DEFAULT_QUORUM_CONFIG
): QuorumEvaluation {
  const enabledAgents = agentConfigs
    .filter(ac => ac.enabled)
    .map(ac => ac.role);
  
  return validateQuorum(enabledAgents, config);
}

/**
 * Gets human-readable explanation of quorum status
 */
export function explainQuorumStatus(evaluation: QuorumEvaluation): string {
  if (evaluation.quorumMet) {
    return `Quorum met: ${evaluation.enabledAgents}/${evaluation.totalAgents} agents enabled (minimum ${evaluation.requiredAgents} required)`;
  }
  
  const reasons: string[] = [];
  
  if (evaluation.enabledAgents < evaluation.requiredAgents) {
    reasons.push(
      `Only ${evaluation.enabledAgents} agents enabled, need at least ${evaluation.requiredAgents}`
    );
  }
  
  if (!evaluation.riskAgentPresent) {
    reasons.push('Risk Agent is required but not enabled');
  }
  
  if (evaluation.missingAgents.length > 0) {
    reasons.push(`Missing agents: ${evaluation.missingAgents.join(', ')}`);
  }
  
  return `Quorum NOT met: ${reasons.join('. ')}`;
}

/**
 * Checks if a specific agent can be disabled without breaking quorum
 */
export function canDisableAgent(
  currentlyEnabled: AgentRole[],
  agentToDisable: AgentRole,
  config: QuorumConfig = DEFAULT_QUORUM_CONFIG
): { canDisable: boolean; reason?: string } {
  // Risk agent can't be disabled if required
  if (agentToDisable === AgentRole.RISK && config.requireRiskAgent) {
    return {
      canDisable: false,
      reason: 'Risk Agent is required and cannot be disabled',
    };
  }
  
  // Check if disabling would break quorum
  const afterDisable = currentlyEnabled.filter(a => a !== agentToDisable);
  const evaluation = validateQuorum(afterDisable, config);
  
  if (!evaluation.quorumMet) {
    return {
      canDisable: false,
      reason: `Disabling ${agentToDisable} would break quorum (${afterDisable.length}/${evaluation.requiredAgents} agents would remain)`,
    };
  }
  
  return { canDisable: true };
}

/**
 * Gets the minimum set of agents that must be enabled
 */
export function getMinimumRequiredAgents(
  config: QuorumConfig = DEFAULT_QUORUM_CONFIG
): { roles: AgentRole[]; description: string } {
  const roles: AgentRole[] = [];
  
  // Risk agent is always required if configured
  if (config.requireRiskAgent) {
    roles.push(AgentRole.RISK);
  }
  
  // Need at least minimumAgents
  const remaining = config.minimumAgents - roles.length;
  if (remaining > 0) {
    // Prefer SEO over Brand as second agent
    if (!roles.includes(AgentRole.SEO)) {
      roles.push(AgentRole.SEO);
    }
    if (roles.length < config.minimumAgents && !roles.includes(AgentRole.BRAND)) {
      roles.push(AgentRole.BRAND);
    }
  }
  
  return {
    roles,
    description: `Minimum agents required: ${roles.join(', ')} (${config.minimumAgents} total, ${config.minimumPercentage}% of all agents)`,
  };
}

export class QuorumValidator {
  private config: QuorumConfig;
  
  constructor(config: QuorumConfig = DEFAULT_QUORUM_CONFIG) {
    this.config = config;
  }
  
  validate(enabledAgents: AgentRole[]): QuorumEvaluation {
    return validateQuorum(enabledAgents, this.config);
  }
  
  validateFromConfigs(agentConfigs: AgentConfig[]): QuorumEvaluation {
    return validateQuorumFromConfigs(agentConfigs, this.config);
  }
  
  explain(evaluation: QuorumEvaluation): string {
    return explainQuorumStatus(evaluation);
  }
  
  canDisable(
    currentlyEnabled: AgentRole[],
    agentToDisable: AgentRole
  ): { canDisable: boolean; reason?: string } {
    return canDisableAgent(currentlyEnabled, agentToDisable, this.config);
  }
  
  getMinimumRequired(): { roles: AgentRole[]; description: string } {
    return getMinimumRequiredAgents(this.config);
  }
  
  updateConfig(newConfig: Partial<QuorumConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  getConfig(): QuorumConfig {
    return { ...this.config };
  }
}
