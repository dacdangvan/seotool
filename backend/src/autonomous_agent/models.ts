/**
 * Autonomous SEO Agent - Models
 * 
 * v1.0 - Type definitions for the meta-agent system
 * 
 * Following AI_SEO_TOOL_PROMPT_BOOK.md:
 * - Deterministic structures
 * - Explainable decisions
 * - Human-in-the-loop
 */

// ============================================================================
// GOAL TYPES
// ============================================================================

export enum SEOGoalType {
  INCREASE_ORGANIC_TRAFFIC = 'increase_organic_traffic',
  IMPROVE_KEYWORD_COVERAGE = 'improve_keyword_coverage',
  REDUCE_SEO_RISK = 'reduce_seo_risk',
  IMPROVE_CONTENT_QUALITY = 'improve_content_quality',
  FIX_TECHNICAL_ISSUES = 'fix_technical_issues',
  BOOST_ENTITY_AUTHORITY = 'boost_entity_authority',
}

export interface SEOGoal {
  id: string;
  projectId: string;
  type: SEOGoalType;
  description: string;
  targetMetric: string;
  targetValue: number;
  currentValue: number;
  deadline?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'achieved' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

export interface MeasurableObjective {
  goalId: string;
  metric: string;
  baseline: number;
  target: number;
  currentProgress: number;
  unit: string;
  trackingMethod: string;
}

// ============================================================================
// OBSERVATION TYPES
// ============================================================================

export enum AgentSource {
  KEYWORD_INTELLIGENCE = 'keyword_intelligence_v0.2',
  CONTENT_ENGINE = 'content_engine_v0.3',
  TECHNICAL_SEO = 'technical_seo_v0.4',
  ENTITY_LINKING = 'entity_linking_v0.5',
  MONITORING_ANALYTICS = 'monitoring_analytics_v0.6',
}

export interface AgentObservation {
  source: AgentSource;
  timestamp: string;
  summary: string;
  metrics: Record<string, number>;
  insights: string[];
  alerts: ObservationAlert[];
  rawData?: unknown;
}

export interface ObservationAlert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface AggregatedObservation {
  projectId: string;
  timestamp: string;
  observations: AgentObservation[];
  healthScore: number; // 0-100
  topIssues: string[];
  topOpportunities: string[];
}

// ============================================================================
// REASONING TYPES
// ============================================================================

export interface SEOGap {
  id: string;
  area: 'content' | 'technical' | 'keywords' | 'links' | 'authority';
  description: string;
  currentState: string;
  desiredState: string;
  impact: 'high' | 'medium' | 'low';
  evidence: string[];
  relatedGoals: string[];
}

export interface SEORisk {
  id: string;
  type: 'penalty' | 'ranking_drop' | 'traffic_loss' | 'technical_failure' | 'competitor';
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigationSuggestion: string;
  evidence: string[];
}

export interface SEOOpportunity {
  id: string;
  type: 'quick_win' | 'growth' | 'competitive' | 'emerging';
  description: string;
  potentialImpact: number; // estimated traffic/ranking improvement
  effort: 'high' | 'medium' | 'low';
  timeToResult: string; // e.g., "2-4 weeks"
  evidence: string[];
}

export interface ReasoningResult {
  projectId: string;
  timestamp: string;
  gaps: SEOGap[];
  risks: SEORisk[];
  opportunities: SEOOpportunity[];
  prioritizedProblems: PrioritizedProblem[];
  reasoning: ReasoningStep[];
}

export interface PrioritizedProblem {
  id: string;
  type: 'gap' | 'risk' | 'opportunity';
  referenceId: string;
  priority: number; // 1-10, higher is more urgent
  priorityScore: number; // calculated score
  impactScore: number;
  effortScore: number;
  riskScore: number;
  explanation: string;
}

export interface ReasoningStep {
  step: number;
  action: string;
  input: string;
  output: string;
  confidence: number; // 0-1
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export enum ActionType {
  // Content actions
  CREATE_CONTENT = 'create_content',
  UPDATE_CONTENT = 'update_content',
  OPTIMIZE_CONTENT = 'optimize_content',
  
  // Technical actions
  FIX_TECHNICAL_ISSUE = 'fix_technical_issue',
  IMPROVE_PAGE_SPEED = 'improve_page_speed',
  FIX_SCHEMA_MARKUP = 'fix_schema_markup',
  
  // Link actions
  ADD_INTERNAL_LINK = 'add_internal_link',
  OPTIMIZE_ANCHOR_TEXT = 'optimize_anchor_text',
  
  // Keyword actions
  TARGET_NEW_KEYWORD = 'target_new_keyword',
  IMPROVE_KEYWORD_RANKING = 'improve_keyword_ranking',
  
  // Monitoring actions
  SET_UP_ALERT = 'set_up_alert',
  INVESTIGATE_ANOMALY = 'investigate_anomaly',
}

export interface SEOAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  targetUrl?: string;
  targetKeyword?: string;
  
  // Impact & Effort
  expectedImpact: {
    metric: string;
    estimatedChange: number;
    confidence: 'high' | 'medium' | 'low';
    timeToResult: string;
  };
  requiredEffort: {
    level: 'high' | 'medium' | 'low';
    estimatedHours: number;
    requiredSkills: string[];
  };
  riskLevel: 'high' | 'medium' | 'low';
  
  // Evidence & Reasoning
  evidence: ActionEvidence[];
  reasoning: string;
  
  // Dependencies
  dependsOn: string[]; // action IDs
  blockedBy: string[]; // action IDs
  
  // Metadata
  priority: number;
  category: 'content' | 'technical' | 'links' | 'keywords' | 'monitoring';
  relatedGoalIds: string[];
  relatedProblemIds: string[];
}

export interface ActionEvidence {
  source: AgentSource;
  type: 'metric' | 'alert' | 'insight' | 'comparison';
  description: string;
  data?: Record<string, unknown>;
}

export interface ActionPlan {
  id: string;
  projectId: string;
  createdAt: string;
  validUntil: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  
  // Goals this plan addresses
  goalIds: string[];
  
  // Prioritized actions
  actions: SEOAction[];
  
  // Summary
  summary: {
    totalActions: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    estimatedTotalHours: number;
    expectedOverallImpact: string;
  };
  
  // Approval
  approvalStatus: ApprovalStatus;
  
  // Execution tracking
  executionStatus?: ExecutionStatus;
}

export interface ApprovalStatus {
  status: 'pending' | 'approved' | 'rejected' | 'partial';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  comments?: string;
  approvedActionIds: string[];
  rejectedActionIds: string[];
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

export interface ExecutionStatus {
  planId: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'failed' | 'paused';
  actionStatuses: ActionExecutionStatus[];
  errors: ExecutionError[];
}

export interface ActionExecutionStatus {
  actionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  agentTaskId?: string; // ID of task dispatched to specific agent
  result?: ActionResult;
  error?: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  outputData?: Record<string, unknown>;
  metricsAffected?: Record<string, number>;
}

export interface ExecutionError {
  actionId: string;
  timestamp: string;
  errorType: string;
  message: string;
  recoverable: boolean;
  suggestedFix?: string;
}

// ============================================================================
// MEMORY TYPES
// ============================================================================

export interface MemoryEntry {
  id: string;
  projectId: string;
  timestamp: string;
  type: 'action' | 'outcome' | 'approval' | 'rejection' | 'learning';
  
  // What happened
  actionId?: string;
  planId?: string;
  description: string;
  
  // Context
  context: {
    goalType?: SEOGoalType;
    actionType?: ActionType;
    targetMetric?: string;
  };
  
  // Outcome
  outcome?: {
    success: boolean;
    metricsBefore: Record<string, number>;
    metricsAfter: Record<string, number>;
    timeToEffect: number; // days
  };
  
  // Learnings
  learnings?: string[];
  tags: string[];
}

export interface LearningRule {
  id: string;
  createdAt: string;
  updatedAt: string;
  
  // Condition
  condition: {
    goalType?: SEOGoalType;
    actionType?: ActionType;
    contextPattern?: string;
  };
  
  // Adjustment
  adjustment: {
    type: 'priority_boost' | 'priority_reduce' | 'avoid' | 'prefer';
    value: number;
    reason: string;
  };
  
  // Evidence
  evidenceCount: number;
  successRate: number;
  lastApplied?: string;
}

// ============================================================================
// SAFETY TYPES
// ============================================================================

export interface SafetyCheck {
  passed: boolean;
  checks: SafetyCheckItem[];
  blockedActions: string[];
  warnings: string[];
}

export interface SafetyCheckItem {
  name: string;
  description: string;
  passed: boolean;
  severity: 'blocker' | 'warning' | 'info';
  details?: string;
}

export enum SafetyRule {
  NO_DESTRUCTIVE_ACTIONS = 'no_destructive_actions',
  NO_EXTERNAL_LINKS = 'no_external_links',
  REQUIRE_HUMAN_APPROVAL = 'require_human_approval',
  EXPLAIN_REASONING = 'explain_reasoning',
  RATE_LIMIT_EXECUTION = 'rate_limit_execution',
  VALIDATE_TARGET_EXISTS = 'validate_target_exists',
}

// ============================================================================
// AGENT STATE
// ============================================================================

export interface AutonomousAgentState {
  projectId: string;
  lastObservationAt?: string;
  lastReasoningAt?: string;
  lastPlanAt?: string;
  lastExecutionAt?: string;
  currentPlanId?: string;
  healthScore: number;
  status: 'idle' | 'observing' | 'reasoning' | 'planning' | 'awaiting_approval' | 'executing';
}

// ============================================================================
// API TYPES
// ============================================================================

export interface AgentRunRequest {
  projectId: string;
  goals?: SEOGoal[];
  forceRefresh?: boolean;
  dryRun?: boolean;
}

export interface AgentRunResponse {
  success: boolean;
  state: AutonomousAgentState;
  observation?: AggregatedObservation;
  reasoning?: ReasoningResult;
  plan?: ActionPlan;
  errors?: string[];
}
