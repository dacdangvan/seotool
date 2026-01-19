/**
 * Portfolio Optimization v1.7 - Models & Types
 * 
 * Type definitions for multi-domain / multi-project SEO portfolio optimization.
 * 
 * Design Principles:
 * - Never optimize a project in isolation
 * - Always show trade-offs between projects
 * - Deterministic allocation
 * - Explainable decisions
 * - Respect project-level guardrails
 * 
 * Key Concepts:
 * - Project: A single SEO domain/site with its own metrics
 * - Portfolio: Collection of projects under shared constraints
 * - Allocation: Budget/resource distribution across projects
 * - Classification: Project bucketing by growth potential & risk
 */

import { ROIStrategy, BudgetConstraintType } from '../cost_optimization/models';
import { TimeHorizon } from '../scenario_simulation/models';

// ============================================================================
// PROJECT METRICS (Aggregated from v1.0–v1.6)
// ============================================================================

/**
 * Aggregated project metrics from all previous versions
 */
export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  domain: string;
  collectedAt: string;
  
  // Traffic metrics (v0.6 Monitoring)
  traffic: TrafficMetrics;
  
  // ROI metrics (v1.6 Cost Optimization)
  roi: ROIMetrics;
  
  // Risk metrics (v1.2 / v1.4)
  risk: RiskMetrics;
  
  // Cost metrics (v1.6)
  cost: CostMetrics;
  
  // Scenario projections (v1.5)
  projections: ProjectionMetrics;
  
  // Overall health
  healthScore: number; // 0-100
  dataQuality: 'low' | 'medium' | 'high';
}

export interface TrafficMetrics {
  currentMonthlyTraffic: number;
  previousMonthlyTraffic: number;
  trafficTrend: 'growing' | 'stable' | 'declining';
  trafficGrowthRate: number; // % change
  organicShare: number; // % of total
  topKeywordsCount: number;
  averagePosition: number;
}

export interface ROIMetrics {
  averageActionROI: number;
  bestActionROI: number;
  portfolioROI: number; // Overall project ROI
  roiTrend: 'improving' | 'stable' | 'declining';
  actionSuccessRate: number; // % of actions that delivered expected value
  valuePerCostUnit: number;
}

export interface RiskMetrics {
  overallRiskScore: number; // 0-1
  penaltyRisk: number; // 0-1
  rankingVolatility: number; // 0-1
  technicalDebtScore: number; // 0-100
  brandComplianceScore: number; // 0-100
  riskTrend: 'increasing' | 'stable' | 'decreasing';
  criticalIssuesCount: number;
}

export interface CostMetrics {
  monthlyTokenUsage: number;
  monthlyComputeCost: number;
  monthlyEffortHours: number;
  totalMonthlyCost: number; // Normalized units
  costEfficiency: number; // Value per cost
  costTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface ProjectionMetrics {
  trafficForecast30d: ProjectionRange;
  trafficForecast60d: ProjectionRange;
  trafficForecast90d: ProjectionRange;
  confidenceScore: number; // 0-1
  bestCaseScenarioId?: string;
  worstCaseScenarioId?: string;
}

export interface ProjectionRange {
  low: number;
  mid: number;
  high: number;
}

// ============================================================================
// NORMALIZED METRICS (Cross-project comparable)
// ============================================================================

/**
 * Normalized metrics for cross-project comparison (0-100 scale)
 */
export interface NormalizedProjectMetrics {
  projectId: string;
  
  // Normalized scores (0-100)
  trafficScore: number;
  growthScore: number;
  roiScore: number;
  riskScore: number; // Lower is better
  efficiencyScore: number;
  stabilityScore: number;
  potentialScore: number;
  
  // Composite scores
  overallScore: number;
  investmentAttractivenessScore: number;
  
  // Percentile ranks within portfolio
  trafficRank: number;
  roiRank: number;
  riskRank: number;
  
  // Normalization metadata
  normalizedAt: string;
  normalizationMethod: NormalizationMethod;
}

export enum NormalizationMethod {
  MIN_MAX = 'min_max',         // Scale to 0-100 based on min/max
  Z_SCORE = 'z_score',         // Standard deviations from mean
  PERCENTILE = 'percentile',   // Rank-based percentile
}

// ============================================================================
// PROJECT CLASSIFICATION
// ============================================================================

/**
 * Project classification bucket
 */
export enum ProjectClassification {
  /** High ROI, high upside - increase investment */
  INVEST = 'invest',
  
  /** Stable, predictable - maintain current allocation */
  MAINTAIN = 'maintain',
  
  /** Medium ROI, higher risk - proceed with caution */
  OPTIMIZE_CAUTIOUSLY = 'optimize_cautiously',
  
  /** Low ROI, low priority - minimal investment */
  OBSERVE = 'observe',
  
  /** Turnaround candidate - needs intervention */
  TURNAROUND = 'turnaround',
  
  /** Sunset candidate - consider winding down */
  SUNSET = 'sunset',
}

/**
 * Classification criteria thresholds
 */
export interface ClassificationCriteria {
  investThresholds: {
    minROI: number;
    minGrowthScore: number;
    maxRiskScore: number;
  };
  maintainThresholds: {
    minStabilityScore: number;
    minROI: number;
    maxRiskScore: number;
  };
  optimizeCautiouslyThresholds: {
    minROI: number;
    maxROI: number;
    minRiskScore: number;
  };
  observeThresholds: {
    maxROI: number;
    maxGrowthScore: number;
  };
  turnaroundThresholds: {
    minPotentialScore: number;
    maxCurrentScore: number;
  };
}

/**
 * Classification result for a project
 */
export interface ProjectClassificationResult {
  projectId: string;
  classification: ProjectClassification;
  confidence: number; // 0-1
  primaryFactors: ClassificationFactor[];
  secondaryFactors: ClassificationFactor[];
  alternativeClassifications: AlternativeClassification[];
  recommendation: string;
  classifiedAt: string;
}

export interface ClassificationFactor {
  factor: string;
  value: number;
  threshold: number;
  direction: 'above' | 'below' | 'within';
  weight: number;
  explanation: string;
}

export interface AlternativeClassification {
  classification: ProjectClassification;
  probability: number;
  condition: string; // What would make this classification valid
}

// ============================================================================
// PORTFOLIO CONSTRAINTS
// ============================================================================

/**
 * Global portfolio constraints
 */
export interface PortfolioConstraints {
  id: string;
  name: string;
  
  // Resource constraints
  totalTokenBudget: number;
  totalEffortHours: number;
  totalComputeBudget: number;
  
  // Risk constraints
  portfolioRiskTolerance: number; // 0-1
  maxProjectRisk: number; // Max risk allowed per project
  
  // Allocation constraints
  maxProjectAllocation: number; // Max % any project can get
  minProjectAllocation: number; // Min % any project must get
  maxProjectCount: number; // Max projects to actively invest in
  
  // Automation constraints
  maxAutomationLevel: number; // 0-1, how much automation allowed
  requireHumanApproval: boolean;
  
  // Time constraints
  planningHorizon: TimeHorizon;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  
  // Custom constraints
  customConstraints: CustomConstraint[];
}

export interface CustomConstraint {
  id: string;
  name: string;
  type: 'min' | 'max' | 'equal' | 'range';
  target: 'project' | 'portfolio' | 'classification';
  metric: string;
  value: number;
  value2?: number; // For range constraints
  priority: number;
  hardLimit: boolean;
}

/**
 * Default portfolio constraints by strategy
 */
export const DEFAULT_PORTFOLIO_CONSTRAINTS: Record<string, Partial<PortfolioConstraints>> = {
  conservative: {
    name: 'Conservative Portfolio',
    totalTokenBudget: 500000,
    totalEffortHours: 100,
    portfolioRiskTolerance: 0.3,
    maxProjectRisk: 0.4,
    maxProjectAllocation: 0.4,
    minProjectAllocation: 0.05,
    maxAutomationLevel: 0.5,
    requireHumanApproval: true,
    planningHorizon: 90,
    rebalanceFrequency: 'monthly',
  },
  balanced: {
    name: 'Balanced Portfolio',
    totalTokenBudget: 1000000,
    totalEffortHours: 200,
    portfolioRiskTolerance: 0.5,
    maxProjectRisk: 0.6,
    maxProjectAllocation: 0.5,
    minProjectAllocation: 0.03,
    maxAutomationLevel: 0.7,
    requireHumanApproval: true,
    planningHorizon: 60,
    rebalanceFrequency: 'weekly',
  },
  aggressive: {
    name: 'Aggressive Portfolio',
    totalTokenBudget: 2000000,
    totalEffortHours: 400,
    portfolioRiskTolerance: 0.7,
    maxProjectRisk: 0.8,
    maxProjectAllocation: 0.6,
    minProjectAllocation: 0.02,
    maxAutomationLevel: 0.9,
    requireHumanApproval: false,
    planningHorizon: 30,
    rebalanceFrequency: 'weekly',
  },
};

// ============================================================================
// ALLOCATION
// ============================================================================

/**
 * Resource allocation for a single project
 */
export interface ProjectAllocation {
  projectId: string;
  projectName: string;
  classification: ProjectClassification;
  
  // Budget allocation
  tokenBudget: number;
  tokenBudgetPercent: number;
  effortHours: number;
  effortHoursPercent: number;
  computeBudget: number;
  computeBudgetPercent: number;
  totalAllocation: number; // Weighted total
  totalAllocationPercent: number;
  
  // Automation level
  automationLevel: number; // 0-1
  allowedActionTypes: string[];
  restrictedActionTypes: string[];
  
  // Risk budget
  riskBudget: number;
  maxActionRisk: number;
  
  // Constraints
  requiresApproval: boolean;
  approvalThreshold: number; // Cost above which approval needed
  
  // Rationale
  allocationRationale: string[];
  tradeOffsAccepted: string[];
}

/**
 * Complete portfolio allocation
 */
export interface PortfolioAllocation {
  id: string;
  portfolioId: string;
  
  // Allocations
  projectAllocations: ProjectAllocation[];
  
  // Summary
  allocatedProjects: number;
  totalTokensAllocated: number;
  totalEffortAllocated: number;
  unallocatedTokens: number;
  unallocatedEffort: number;
  
  // Classification distribution
  classificationDistribution: Record<ProjectClassification, number>;
  
  // Optimization metadata
  optimizationMethod: AllocationMethod;
  optimizationScore: number;
  iterations: number;
  constraints: PortfolioConstraints;
  
  // Timestamps
  allocatedAt: string;
  validUntil: string;
}

export enum AllocationMethod {
  RULE_BASED = 'rule_based',     // Simple rule-based allocation
  GREEDY = 'greedy',             // Greedy optimization
  PROPORTIONAL = 'proportional', // Proportional to scores
  CONSTRAINED = 'constrained',   // Constraint satisfaction
}

// ============================================================================
// PORTFOLIO SIMULATION
// ============================================================================

/**
 * Portfolio-level simulation scenario
 */
export interface PortfolioScenario {
  id: string;
  name: string;
  description: string;
  type: PortfolioScenarioType;
  
  // Allocation changes
  allocationChanges: AllocationChange[];
  
  // Parameters
  parameters: PortfolioScenarioParameters;
  
  createdAt: string;
}

export enum PortfolioScenarioType {
  BASELINE = 'baseline',           // Current allocation
  REBALANCE = 'rebalance',         // Optimized rebalancing
  INCREASE_BUDGET = 'increase_budget',
  DECREASE_BUDGET = 'decrease_budget',
  SHIFT_TO_PROJECT = 'shift_to_project',
  REDUCE_RISK = 'reduce_risk',
  MAXIMIZE_GROWTH = 'maximize_growth',
  CUSTOM = 'custom',
}

export interface AllocationChange {
  projectId: string;
  previousAllocation: number;
  newAllocation: number;
  changePercent: number;
  reason: string;
}

export interface PortfolioScenarioParameters {
  budgetChange?: number;           // % change in total budget
  targetProjectId?: string;        // For shift scenarios
  riskReduction?: number;          // Target risk reduction
  growthTarget?: number;           // Target growth increase
  custom?: Record<string, unknown>;
}

/**
 * Portfolio simulation result
 */
export interface PortfolioSimulationResult {
  id: string;
  scenarioId: string;
  
  // Projected outcomes
  projectedPortfolioROI: number;
  projectedTotalTraffic: ProjectionRange;
  projectedPortfolioRisk: number;
  
  // Per-project projections
  projectProjections: ProjectSimulationProjection[];
  
  // Comparison to baseline
  roiChangeFromBaseline: number;
  trafficChangeFromBaseline: number;
  riskChangeFromBaseline: number;
  
  // Trade-offs
  tradeOffs: PortfolioTradeOff[];
  
  // Confidence
  overallConfidence: number;
  assumptions: SimulationAssumption[];
  
  simulatedAt: string;
}

export interface ProjectSimulationProjection {
  projectId: string;
  currentAllocation: number;
  scenarioAllocation: number;
  projectedROI: number;
  projectedTrafficChange: number;
  projectedRiskChange: number;
  impactSummary: string;
}

export interface PortfolioTradeOff {
  description: string;
  benefitProject?: string;
  costProject?: string;
  benefitMetric: string;
  costMetric: string;
  netImpact: 'positive' | 'negative' | 'neutral';
  magnitude: 'small' | 'medium' | 'large';
}

export interface SimulationAssumption {
  id: string;
  description: string;
  sensitivity: 'low' | 'medium' | 'high';
  basis: string;
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

/**
 * Portfolio-level recommendation
 */
export interface PortfolioRecommendation {
  id: string;
  portfolioId: string;
  
  // Summary
  summary: string;
  
  // Project-specific recommendations
  projectRecommendations: ProjectRecommendation[];
  
  // Portfolio-level insights
  portfolioInsights: PortfolioInsight[];
  
  // Prioritized actions
  prioritizedActions: PortfolioAction[];
  
  // Expected outcomes
  expectedOutcomes: ExpectedOutcome[];
  
  // Risk warnings
  riskWarnings: RiskWarning[];
  
  // Metadata
  generatedAt: string;
  validUntil: string;
  confidence: number;
}

export interface ProjectRecommendation {
  projectId: string;
  projectName: string;
  classification: ProjectClassification;
  
  // Action
  recommendedAction: RecommendedAction;
  
  // Rationale
  rationale: string[];
  
  // Expected impact
  expectedImpact: string;
  
  // Priority
  priority: number; // 1-10
  
  // Alternatives
  alternatives: AlternativeRecommendation[];
}

export enum RecommendedAction {
  INCREASE_INVESTMENT = 'increase_investment',
  MAINTAIN_INVESTMENT = 'maintain_investment',
  REDUCE_INVESTMENT = 'reduce_investment',
  INCREASE_AUTOMATION = 'increase_automation',
  REDUCE_AUTOMATION = 'reduce_automation',
  PAUSE_RISKY_ACTIONS = 'pause_risky_actions',
  ACCELERATE_GROWTH = 'accelerate_growth',
  FOCUS_ON_STABILITY = 'focus_on_stability',
  INITIATE_TURNAROUND = 'initiate_turnaround',
  CONSIDER_SUNSET = 'consider_sunset',
}

export interface AlternativeRecommendation {
  action: RecommendedAction;
  condition: string;
  tradeOff: string;
}

export interface PortfolioInsight {
  type: 'opportunity' | 'risk' | 'efficiency' | 'rebalance';
  title: string;
  description: string;
  affectedProjects: string[];
  suggestedAction: string;
  impact: 'high' | 'medium' | 'low';
}

export interface PortfolioAction {
  id: string;
  action: string;
  targetProjectId?: string;
  priority: number;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
  deadline?: string;
}

export interface ExpectedOutcome {
  metric: string;
  currentValue: number;
  projectedValue: number;
  changePercent: number;
  timeframe: string;
  confidence: number;
}

export interface RiskWarning {
  type: 'concentration' | 'under_investment' | 'over_automation' | 'high_risk' | 'budget_constraint';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affectedProjects: string[];
  suggestedMitigation: string;
}

// ============================================================================
// PORTFOLIO STATE & HISTORY
// ============================================================================

/**
 * Complete portfolio state
 */
export interface PortfolioState {
  id: string;
  name: string;
  organizationId: string;
  
  // Projects
  projects: ProjectMetrics[];
  normalizedMetrics: NormalizedProjectMetrics[];
  classifications: ProjectClassificationResult[];
  
  // Current allocation
  currentAllocation: PortfolioAllocation;
  
  // Constraints
  constraints: PortfolioConstraints;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastOptimizedAt: string;
}

/**
 * Portfolio history entry for tracking changes
 */
export interface PortfolioHistoryEntry {
  id: string;
  portfolioId: string;
  timestamp: string;
  
  // Snapshot
  allocation: PortfolioAllocation;
  
  // Changes from previous
  changes: AllocationChange[];
  
  // Trigger
  trigger: 'scheduled' | 'manual' | 'threshold' | 'event';
  triggerReason: string;
  
  // Outcomes (filled in after time passes)
  actualOutcomes?: ActualOutcome[];
}

export interface ActualOutcome {
  metric: string;
  projectedValue: number;
  actualValue: number;
  deviation: number;
  deviationPercent: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Portfolio optimization configuration
 */
export interface PortfolioOptimizationConfig {
  // Normalization
  normalizationMethod: NormalizationMethod;
  
  // Classification
  classificationCriteria: ClassificationCriteria;
  
  // Optimization
  defaultAllocationMethod: AllocationMethod;
  maxOptimizationIterations: number;
  convergenceThreshold: number;
  
  // Simulation
  simulationIterations: number;
  confidenceLevel: number;
  
  // Rebalancing
  rebalanceThreshold: number; // Min change to trigger rebalance
  maxRebalanceFrequency: number; // Min days between rebalances
  
  // Logging
  enableDetailedLogging: boolean;
}

export const DEFAULT_PORTFOLIO_CONFIG: PortfolioOptimizationConfig = {
  normalizationMethod: NormalizationMethod.MIN_MAX,
  classificationCriteria: {
    investThresholds: {
      minROI: 70,
      minGrowthScore: 60,
      maxRiskScore: 40,
    },
    maintainThresholds: {
      minStabilityScore: 70,
      minROI: 50,
      maxRiskScore: 50,
    },
    optimizeCautiouslyThresholds: {
      minROI: 40,
      maxROI: 70,
      minRiskScore: 40,
    },
    observeThresholds: {
      maxROI: 40,
      maxGrowthScore: 40,
    },
    turnaroundThresholds: {
      minPotentialScore: 60,
      maxCurrentScore: 40,
    },
  },
  defaultAllocationMethod: AllocationMethod.CONSTRAINED,
  maxOptimizationIterations: 100,
  convergenceThreshold: 0.001,
  simulationIterations: 1000,
  confidenceLevel: 0.95,
  rebalanceThreshold: 0.05,
  maxRebalanceFrequency: 7,
  enableDetailedLogging: true,
};

// ============================================================================
// INPUT/OUTPUT SCHEMAS
// ============================================================================

/**
 * Input for portfolio optimization
 */
export interface PortfolioOptimizationInput {
  portfolioId: string;
  projects: ProjectMetrics[];
  constraints: PortfolioConstraints;
  strategy: PortfolioStrategy;
  currentAllocation?: PortfolioAllocation;
}

export enum PortfolioStrategy {
  MAXIMIZE_ROI = 'maximize_roi',
  MINIMIZE_RISK = 'minimize_risk',
  BALANCED_GROWTH = 'balanced_growth',
  AGGRESSIVE_GROWTH = 'aggressive_growth',
  CAPITAL_PRESERVATION = 'capital_preservation',
}

/**
 * Output from portfolio optimization
 */
export interface PortfolioOptimizationOutput {
  portfolioId: string;
  
  // Results
  normalizedMetrics: NormalizedProjectMetrics[];
  classifications: ProjectClassificationResult[];
  recommendedAllocation: PortfolioAllocation;
  simulationResults: PortfolioSimulationResult[];
  recommendation: PortfolioRecommendation;
  
  // Comparison
  comparisonToCurrentAllocation?: AllocationComparison;
  
  // Metadata
  optimizedAt: string;
  executionTimeMs: number;
  warnings: string[];
}

export interface AllocationComparison {
  currentTotalROI: number;
  projectedTotalROI: number;
  roiImprovement: number;
  currentRisk: number;
  projectedRisk: number;
  riskChange: number;
  significantChanges: AllocationChange[];
  tradeOffs: string[];
}
