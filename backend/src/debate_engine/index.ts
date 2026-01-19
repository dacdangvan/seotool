/**
 * Multi-Agent Debate System
 * 
 * v1.2 - Autonomous SEO Agent with Multi-Agent Debate
 * 
 * This module provides a structured debate system where multiple agents
 * (SEO, Risk, Brand) evaluate proposed SEO actions before execution.
 * 
 * Key Features:
 * - 3 Specialized Agents: SEO Growth, Risk Control, Brand Integrity
 * - Structured Debate: No free-form chat, explicit arguments only
 * - Conflict Detection: Identifies and analyzes agent disagreements
 * - Weighted Voting: Configurable weights based on action type and risk
 * - Full Explainability: Every decision is traceable and transparent
 * - No Execution Without APPROVE: Actions require debate consensus
 * 
 * Usage:
 * ```typescript
 * import { DebateOrchestrator, DebateDecision } from './debate_engine';
 * 
 * const orchestrator = new DebateOrchestrator(projectId);
 * 
 * const input = DebateOrchestrator.createInput(
 *   projectId,
 *   action,
 *   riskClassification,
 *   'Project Name',
 *   'example.com'
 * );
 * 
 * const result = await orchestrator.debate(input);
 * 
 * if (result.decision.decision === DebateDecision.APPROVE) {
 *   // Execute action
 * } else if (result.decision.decision === DebateDecision.APPROVE_WITH_MODIFICATIONS) {
 *   // Apply modifications first
 * } else {
 *   // Reject action
 * }
 * ```
 */

// Models and Types
export {
  // Agent Types
  AgentRole,
  AgentConfig,
  DEFAULT_AGENT_CONFIGS,
  
  // Debate Input
  DebateInput,
  DebateContext,
  PageMetrics,
  BrandGuidelines,
  ActionReversibility,
  ActionScope,
  HistoricalOutcome,
  
  // Agent Evaluation
  AgentPosition,
  AgentEvaluation,
  ReasoningPoint,
  Assessment,
  SuggestedModification,
  
  // Conflict Analysis
  ConflictAnalysis,
  Conflict,
  ConflictType,
  ConsensusArea,
  
  // Voting
  VotingWeights,
  DEFAULT_VOTING_WEIGHTS,
  VoteResult,
  AggregatedVote,
  
  // Decision
  DebateDecision,
  DecisionExplanation,
  KeyFactor,
  
  // Output
  DebateOutput,
  DebateHistoryEntry,
  DebateOutcomeObservation,
  
  // Configuration
  DebateConfig,
  DebateThresholds,
  DEFAULT_DEBATE_THRESHOLDS,
  LLMConfig,
  DEFAULT_LLM_CONFIG,
} from './models';

// Agent Evaluators
export { SEOEvaluator } from './seo_evaluator';
export { RiskEvaluator } from './risk_evaluator';
export { BrandEvaluator } from './brand_evaluator';

// Analysis and Aggregation
export { ConflictAnalyzer } from './conflict_analyzer';
export { VoteAggregator } from './vote_aggregator';
export { DecisionExplainer } from './decision_explainer';

// Main Orchestrator
export { DebateOrchestrator } from './debate_orchestrator';
export { DebateOrchestrator as default } from './debate_orchestrator';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { DebateOrchestrator } from './debate_orchestrator';
import { SEOAction } from '../autonomous_agent/models';
import { RiskClassification } from '../autonomous_agent_v1_1/models';
import { DebateInput, DebateOutput, DebateDecision } from './models';

/**
 * Quick debate function - runs debate and returns decision
 */
export async function quickDebate(
  projectId: string,
  action: SEOAction,
  riskClassification: RiskClassification,
  projectName: string,
  projectDomain: string
): Promise<DebateOutput> {
  const orchestrator = new DebateOrchestrator(projectId);
  const input = DebateOrchestrator.createInput(
    projectId,
    action,
    riskClassification,
    projectName,
    projectDomain
  );
  return orchestrator.debate(input);
}

/**
 * Check if action should be executed (APPROVE only)
 */
export async function shouldExecute(
  projectId: string,
  action: SEOAction,
  riskClassification: RiskClassification,
  projectName: string,
  projectDomain: string
): Promise<boolean> {
  const result = await quickDebate(projectId, action, riskClassification, projectName, projectDomain);
  return result.decision.decision === DebateDecision.APPROVE;
}

/**
 * Get decision with explanation
 */
export async function getDecision(
  projectId: string,
  action: SEOAction,
  riskClassification: RiskClassification,
  projectName: string,
  projectDomain: string
): Promise<{
  decision: DebateDecision;
  confidence: number;
  reasoning: string[];
  shouldExecute: boolean;
}> {
  const result = await quickDebate(projectId, action, riskClassification, projectName, projectDomain);
  return {
    decision: result.decision.decision,
    confidence: result.decision.confidence,
    reasoning: result.decision.reasoning,
    shouldExecute: result.decision.decision === DebateDecision.APPROVE,
  };
}
