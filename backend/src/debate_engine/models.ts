/**
 * Multi-Agent Debate System - Models
 * 
 * v1.2 - Type definitions for structured debate among agents
 * 
 * Key Principles:
 * - No free-form chat between agents
 * - Every argument must be explicit
 * - Deterministic output schema
 * - No execution without clear APPROVE
 * - Full explainability required
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import { RiskClassification, RiskLevel } from '../autonomous_agent_v1_1/models';

// ============================================================================
// AGENT TYPES
// ============================================================================

export enum AgentRole {
  SEO = 'seo',
  RISK = 'risk',
  BRAND = 'brand',
}

export interface AgentConfig {
  role: AgentRole;
  name: string;
  objective: string;
  metrics: string[];
  bias: string;
  enabled: boolean;
}

export const DEFAULT_AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  [AgentRole.SEO]: {
    role: AgentRole.SEO,
    name: 'SEO Growth Agent',
    objective: 'Maximize organic growth through strategic optimization',
    metrics: ['organic_traffic', 'keyword_rankings', 'search_visibility', 'click_through_rate'],
    bias: 'aggressive_optimization',
    enabled: true,
  },
  [AgentRole.RISK]: {
    role: AgentRole.RISK,
    name: 'Risk Control Agent',
    objective: 'Minimize SEO and platform risk while ensuring compliance',
    metrics: ['spam_signals', 'guideline_violations', 'penalty_risk', 'technical_stability'],
    bias: 'conservative_defensive',
    enabled: true,
  },
  [AgentRole.BRAND]: {
    role: AgentRole.BRAND,
    name: 'Brand Integrity Agent',
    objective: 'Protect brand voice, user experience, and trust',
    metrics: ['readability_score', 'tone_consistency', 'user_trust', 'brand_alignment'],
    bias: 'user_centric_non_promotional',
    enabled: true,
  },
};

// ============================================================================
// DEBATE INPUT
// ============================================================================

export interface DebateInput {
  id: string;
  projectId: string;
  action: SEOAction;
  riskClassification: RiskClassification;
  context: DebateContext;
  requestedAt: string;
}

export interface DebateContext {
  projectName: string;
  projectDomain: string;
  recentActions: SEOAction[];
  pageMetrics?: PageMetrics;
  brandGuidelines?: BrandGuidelines;
  // Extended risk context
  actionReversibility?: ActionReversibility;
  actionScope?: ActionScope;
  historicalOutcomes?: HistoricalOutcome[];
}

export type ActionReversibility = 'easy' | 'moderate' | 'difficult' | 'impossible';
export type ActionScope = 'single_element' | 'single_page' | 'multiple_pages' | 'site_wide';

export interface HistoricalOutcome {
  actionType: ActionType;
  success: boolean;
  executedAt: string;
  impactScore: number;
}

export interface PageMetrics {
  currentTraffic: number;
  currentRanking: number;
  bounceRate: number;
  avgTimeOnPage: number;
}

export interface BrandGuidelines {
  tone: string[];
  forbiddenTerms: string[];
  preferredTerms: string[];
  maxPromotionalDensity: number;
}

// ============================================================================
// AGENT EVALUATION
// ============================================================================

export enum AgentPosition {
  SUPPORT = 'support',
  OPPOSE = 'oppose',
  MODIFY = 'modify',
}

export interface AgentEvaluation {
  agentRole: AgentRole;
  agentName: string;
  position: AgentPosition;
  confidence: number; // 0-100
  reasoning: ReasoningPoint[];
  assessment: Assessment;
  modifications?: SuggestedModification[];
  evaluatedAt: string;
}

export interface ReasoningPoint {
  type: 'benefit' | 'risk' | 'concern' | 'observation';
  statement: string;
  evidence?: string;
  weight: 'high' | 'medium' | 'low';
}

export interface Assessment {
  overallScore: number; // -100 to +100 (negative = oppose, positive = support)
  benefitScore: number; // 0-100
  riskScore: number; // 0-100
  alignmentScore: number; // 0-100 (alignment with agent's objective)
  summary: string;
}

export interface SuggestedModification {
  aspect: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  priority: 'required' | 'recommended' | 'optional';
}

// ============================================================================
// CONFLICT ANALYSIS
// ============================================================================

export interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: Conflict[];
  consensusAreas: ConsensusArea[];
  overallAlignment: number; // 0-100
}

export interface Conflict {
  id: string;
  type: ConflictType;
  agentA: AgentRole;
  agentB: AgentRole;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  resolutionStrategy: string;
}

export enum ConflictType {
  SEO_VS_RISK = 'seo_vs_risk',
  SEO_VS_BRAND = 'seo_vs_brand',
  RISK_VS_BRAND = 'risk_vs_brand',
  POSITION_MISMATCH = 'position_mismatch',
  MODIFICATION_CONFLICT = 'modification_conflict',
}

export interface ConsensusArea {
  aspect: string;
  agentsAgreed: AgentRole[];
  consensusType: 'full' | 'partial';
}

// ============================================================================
// VOTING & WEIGHTS
// ============================================================================

export interface VotingWeights {
  projectId: string;
  baseWeights: Record<AgentRole, number>;
  actionTypeModifiers: Partial<Record<ActionType, Record<AgentRole, number>>>;
  riskLevelModifiers: Record<RiskLevel, Record<AgentRole, number>>;
  contentChangeModifier: number; // Increases Brand weight for content changes
}

export const DEFAULT_VOTING_WEIGHTS: Omit<VotingWeights, 'projectId'> = {
  baseWeights: {
    [AgentRole.SEO]: 0.35,
    [AgentRole.RISK]: 0.35,
    [AgentRole.BRAND]: 0.30,
  },
  actionTypeModifiers: {
    [ActionType.CREATE_CONTENT]: {
      [AgentRole.SEO]: 0.25,
      [AgentRole.RISK]: 0.35,
      [AgentRole.BRAND]: 0.40,
    },
    [ActionType.ADD_INTERNAL_LINK]: {
      [AgentRole.SEO]: 0.45,
      [AgentRole.RISK]: 0.35,
      [AgentRole.BRAND]: 0.20,
    },
    [ActionType.OPTIMIZE_CONTENT]: {
      [AgentRole.SEO]: 0.30,
      [AgentRole.RISK]: 0.30,
      [AgentRole.BRAND]: 0.40,
    },
  },
  riskLevelModifiers: {
    [RiskLevel.LOW]: {
      [AgentRole.SEO]: 0.40,
      [AgentRole.RISK]: 0.30,
      [AgentRole.BRAND]: 0.30,
    },
    [RiskLevel.MEDIUM]: {
      [AgentRole.SEO]: 0.30,
      [AgentRole.RISK]: 0.40,
      [AgentRole.BRAND]: 0.30,
    },
    [RiskLevel.HIGH]: {
      [AgentRole.SEO]: 0.20,
      [AgentRole.RISK]: 0.50,
      [AgentRole.BRAND]: 0.30,
    },
  },
  contentChangeModifier: 0.15, // Add to Brand weight for content-modifying actions
};

export interface VoteResult {
  agentRole: AgentRole;
  position: AgentPosition;
  confidence: number; // 0-100
  weight: number;
  rawScore: number; // 0-100 (position * confidence)
  weightedScore: number;
  scaledScore: number; // -100 to +100
  normalizedScore: number; // -1 to +1
}

export interface AggregatedVote {
  votes: VoteResult[];
  aggregateScore: number; // -100 to +100
  totalScore: number; // Alias for aggregateScore
  weightedAverage: number;
  effectiveWeights: Record<AgentRole, number>;
  modificationsRequired: boolean;
  consensusLevel: number; // 0-100
  unanimousSupport: boolean;
  unanimousOppose: boolean;
  majorityPosition: AgentPosition;
  calculatedAt: string;
}

// ============================================================================
// FINAL DECISION
// ============================================================================

export enum DebateDecision {
  APPROVE = 'approve',
  APPROVE_WITH_MODIFICATIONS = 'approve_with_modifications',
  REJECT = 'reject',
}

export interface DecisionExplanation {
  decision: DebateDecision;
  confidence: number; // 0-100
  primaryInfluencer: AgentRole;
  influenceBreakdown: Record<AgentRole, number>;
  reasoning: string[];
  keyFactors: KeyFactor[];
  modifications?: SuggestedModification[];
}

export interface KeyFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  source: AgentRole;
}

// ============================================================================
// DEBATE OUTPUT
// ============================================================================

export interface DebateOutput {
  id: string;
  inputId: string;
  projectId: string;
  actionId: string;
  
  // Agent evaluations
  evaluations: Record<AgentRole, AgentEvaluation>;
  
  // Conflict analysis
  conflictAnalysis: ConflictAnalysis;
  
  // Voting results
  aggregatedVote: AggregatedVote;
  
  // Final decision
  decision: DecisionExplanation;
  
  // Metadata
  debateStartedAt: string;
  debateCompletedAt: string;
  durationMs: number;
}

// ============================================================================
// DEBATE HISTORY
// ============================================================================

export interface DebateHistoryEntry {
  debateId: string;
  projectId: string;
  actionId: string;
  actionType: ActionType;
  decision: DebateDecision;
  primaryInfluencer: AgentRole;
  confidence: number;
  debatedAt: string;
  executionFollowed: boolean;
  outcomeObserved?: DebateOutcomeObservation;
}

export interface DebateOutcomeObservation {
  observedAt: string;
  actualImpact: 'positive' | 'negative' | 'neutral';
  metricsChange: Record<string, number>;
  lessonsLearned: string[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface DebateConfig {
  projectId: string;
  enabled: boolean;
  agentConfigs: Record<AgentRole, AgentConfig>;
  votingWeights: VotingWeights;
  thresholds: DebateThresholds;
  llmConfig?: LLMConfig;
}

export interface DebateThresholds {
  approvalThreshold: number; // Minimum score to APPROVE (default: 20)
  modificationThreshold: number; // Score range for APPROVE_WITH_MODIFICATIONS (default: -20 to 20)
  rejectionThreshold: number; // Score below which to REJECT (default: -20)
  minimumConfidence: number; // Minimum confidence required (default: 60)
  unanimityBonus: number; // Bonus/penalty for unanimous decisions (default: 10)
}

export const DEFAULT_DEBATE_THRESHOLDS: DebateThresholds = {
  approvalThreshold: 20,
  modificationThreshold: -20,
  rejectionThreshold: -20,
  minimumConfidence: 60,
  unanimityBonus: 10,
};

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  temperature: number;
  maxTokens: number;
  isolatedPrompts: boolean; // Each agent gets isolated prompt context
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.3, // Low temperature for deterministic reasoning
  maxTokens: 2000,
  isolatedPrompts: true,
};
