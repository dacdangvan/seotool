/**
 * Cost Optimization Models v1.6
 * 
 * Type definitions for cost-aware SEO action optimization.
 * 
 * Design Principles:
 * - All costs are relative units (not monetary)
 * - Fully explainable cost breakdowns
 * - Transparent ROI calculations
 * - Budget constraint support
 */

// ============================================================================
// COST DIMENSIONS
// ============================================================================

/**
 * Cost categories tracked by the system
 */
export enum CostCategory {
  TOKEN = 'token',           // LLM token usage
  COMPUTE = 'compute',       // Crawl, audit, embedding
  EFFORT = 'effort',         // Engineering / content effort
  RISK = 'risk',             // Expected downside cost
}

/**
 * Token cost breakdown for LLM operations
 */
export interface TokenCost {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;      // Relative cost units
  model: string;              // Model used (e.g., 'gpt-4', 'claude-3')
  operationType: TokenOperationType;
}

export enum TokenOperationType {
  CONTENT_GENERATION = 'content_generation',
  CONTENT_OPTIMIZATION = 'content_optimization',
  CONTENT_ANALYSIS = 'content_analysis',
  KEYWORD_RESEARCH = 'keyword_research',
  COMPETITOR_ANALYSIS = 'competitor_analysis',
  SCHEMA_GENERATION = 'schema_generation',
  META_GENERATION = 'meta_generation',
  SUMMARY_GENERATION = 'summary_generation',
}

/**
 * Compute cost breakdown
 */
export interface ComputeCost {
  crawlCost: number;          // Page crawling
  auditCost: number;          // Technical audits
  embeddingCost: number;      // Vector embeddings
  processingCost: number;     // Data processing
  storageCost: number;        // Storage operations
  totalCost: number;          // Sum of all compute costs
  estimatedDurationMs: number; // Expected execution time
}

/**
 * Effort cost breakdown (human effort)
 */
export interface EffortCost {
  engineeringHours: number;   // Developer time
  contentHours: number;       // Content writer time
  reviewHours: number;        // QA/review time
  coordinationHours: number;  // Management overhead
  totalHours: number;         // Total human hours
  skillsRequired: string[];   // Required expertise
  complexity: 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Risk cost breakdown
 */
export interface RiskCost {
  rankingRiskCost: number;    // Cost of potential ranking drop
  trafficRiskCost: number;    // Cost of potential traffic loss
  penaltyRiskCost: number;    // Cost of potential penalty
  brandRiskCost: number;      // Cost of brand damage
  technicalRiskCost: number;  // Cost of technical issues
  totalRiskCost: number;      // Weighted sum of risks
  riskProbability: number;    // Overall probability of negative outcome
  expectedLoss: number;       // totalRiskCost * riskProbability
}

/**
 * Complete cost breakdown for an action
 */
export interface ActionCostBreakdown {
  actionId: string;
  actionType: string;
  tokenCost: TokenCost;
  computeCost: ComputeCost;
  effortCost: EffortCost;
  riskCost: RiskCost;
  totalCost: number;          // Normalized total cost (0-100 scale)
  costPerCategory: Record<CostCategory, number>;
  assumptions: CostAssumption[];
  estimatedAt: string;
}

/**
 * Cost estimation assumption
 */
export interface CostAssumption {
  id: string;
  category: CostCategory;
  description: string;
  value: number;
  basis: string;              // How the value was derived
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// VALUE DIMENSIONS
// ============================================================================

/**
 * Value categories tracked by the system
 */
export enum ValueCategory {
  TRAFFIC = 'traffic',         // Organic traffic uplift
  RANKING = 'ranking',         // Keyword ranking improvement
  RISK_REDUCTION = 'risk_reduction',  // Reduced risk exposure
  BRAND = 'brand',             // Brand consistency improvement
  TECHNICAL = 'technical',     // Technical health improvement
}

/**
 * Traffic value estimation
 */
export interface TrafficValue {
  expectedVisitors: number;    // Additional monthly visitors
  trafficUpliftPercent: number;
  confidenceInterval: {
    low: number;
    mid: number;
    high: number;
  };
  timeToRealize: number;       // Days until value realized
  sustainabilityMonths: number; // How long the value lasts
}

/**
 * Ranking value estimation
 */
export interface RankingValue {
  keywordsAffected: number;
  avgPositionImprovement: number;
  topKeywordImprovements: Array<{
    keyword: string;
    currentPosition: number;
    expectedPosition: number;
    searchVolume: number;
  }>;
  estimatedClickIncrease: number;
}

/**
 * Risk reduction value
 */
export interface RiskReductionValue {
  currentRiskScore: number;
  projectedRiskScore: number;
  riskReduction: number;       // Absolute reduction
  riskReductionPercent: number;
  issuesResolved: number;
  penaltyPrevention: boolean;
}

/**
 * Brand value estimation
 */
export interface BrandValue {
  consistencyImprovement: number;
  violationsResolved: number;
  brandScoreIncrease: number;
  reputationProtection: number; // 0-1 scale
}

/**
 * Complete value breakdown for an action
 */
export interface ActionValueBreakdown {
  actionId: string;
  actionType: string;
  trafficValue: TrafficValue;
  rankingValue: RankingValue;
  riskReductionValue: RiskReductionValue;
  brandValue: BrandValue;
  totalValue: number;          // Normalized total value (0-100 scale)
  valuePerCategory: Record<ValueCategory, number>;
  assumptions: ValueAssumption[];
  estimatedAt: string;
  dataSourceQuality: 'low' | 'medium' | 'high';
}

/**
 * Value estimation assumption
 */
export interface ValueAssumption {
  id: string;
  category: ValueCategory;
  description: string;
  value: number;
  basis: string;
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// ROI SCORING
// ============================================================================

/**
 * ROI optimization strategy
 */
export enum ROIStrategy {
  BALANCED = 'balanced',           // Equal weight to all factors
  TRAFFIC_FOCUSED = 'traffic_focused', // Prioritize traffic gains
  RISK_AVERSE = 'risk_averse',     // Minimize risk, accept lower returns
  BRAND_FIRST = 'brand_first',     // Prioritize brand consistency
  QUICK_WINS = 'quick_wins',       // Low effort, fast results
  HIGH_IMPACT = 'high_impact',     // Maximum value regardless of cost
}

/**
 * Strategy weights for ROI calculation
 */
export interface ROIWeights {
  traffic: number;
  ranking: number;
  riskReduction: number;
  brand: number;
  costSensitivity: number;      // How much to penalize high costs
}

/**
 * Default weights per strategy
 */
export const STRATEGY_WEIGHTS: Record<ROIStrategy, ROIWeights> = {
  [ROIStrategy.BALANCED]: {
    traffic: 0.30,
    ranking: 0.25,
    riskReduction: 0.20,
    brand: 0.15,
    costSensitivity: 0.10,
  },
  [ROIStrategy.TRAFFIC_FOCUSED]: {
    traffic: 0.50,
    ranking: 0.25,
    riskReduction: 0.10,
    brand: 0.05,
    costSensitivity: 0.10,
  },
  [ROIStrategy.RISK_AVERSE]: {
    traffic: 0.15,
    ranking: 0.15,
    riskReduction: 0.45,
    brand: 0.15,
    costSensitivity: 0.10,
  },
  [ROIStrategy.BRAND_FIRST]: {
    traffic: 0.15,
    ranking: 0.15,
    riskReduction: 0.15,
    brand: 0.45,
    costSensitivity: 0.10,
  },
  [ROIStrategy.QUICK_WINS]: {
    traffic: 0.25,
    ranking: 0.20,
    riskReduction: 0.15,
    brand: 0.10,
    costSensitivity: 0.30,
  },
  [ROIStrategy.HIGH_IMPACT]: {
    traffic: 0.40,
    ranking: 0.30,
    riskReduction: 0.15,
    brand: 0.10,
    costSensitivity: 0.05,
  },
};

/**
 * ROI score for an action
 */
export interface ActionROIScore {
  actionId: string;
  actionType: string;
  rawROI: number;              // Value / Cost (unbounded)
  normalizedROI: number;       // 0-100 scale
  weightedROI: number;         // After applying strategy weights
  valueScore: number;          // Normalized value (0-100)
  costScore: number;           // Normalized cost (0-100, lower is better)
  efficiency: number;          // Value per unit cost
  rank: number;                // Rank among all actions
  tier: 'excellent' | 'good' | 'moderate' | 'poor';
  reasoning: string[];         // Why this ROI score
  strategy: ROIStrategy;
  breakdown: {
    trafficContribution: number;
    rankingContribution: number;
    riskReductionContribution: number;
    brandContribution: number;
  };
}

// ============================================================================
// BUDGET CONSTRAINTS
// ============================================================================

/**
 * Budget constraint definition
 */
export interface BudgetConstraint {
  id: string;
  name: string;
  type: BudgetConstraintType;
  maxValue: number;
  currentUsage: number;
  priority: number;            // Higher = more important to respect
  hardLimit: boolean;          // Can't exceed vs. soft penalty
}

export enum BudgetConstraintType {
  TOKEN_BUDGET = 'token_budget',
  COMPUTE_BUDGET = 'compute_budget',
  EFFORT_HOURS = 'effort_hours',
  RISK_TOLERANCE = 'risk_tolerance',
  TOTAL_COST = 'total_cost',
  ACTION_COUNT = 'action_count',
}

/**
 * Budget profile with all constraints
 */
export interface BudgetProfile {
  id: string;
  name: string;
  constraints: BudgetConstraint[];
  strategy: ROIStrategy;
  minROIThreshold: number;     // Minimum ROI to consider action
  createdAt: string;
  updatedAt: string;
}

/**
 * Default budget profiles
 */
export const DEFAULT_BUDGET_PROFILES: Record<string, Partial<BudgetProfile>> = {
  conservative: {
    name: 'Conservative',
    strategy: ROIStrategy.RISK_AVERSE,
    minROIThreshold: 1.5,
    constraints: [
      { id: 'token', name: 'Token Budget', type: BudgetConstraintType.TOKEN_BUDGET, maxValue: 100000, currentUsage: 0, priority: 2, hardLimit: true },
      { id: 'effort', name: 'Effort Hours', type: BudgetConstraintType.EFFORT_HOURS, maxValue: 20, currentUsage: 0, priority: 1, hardLimit: true },
      { id: 'risk', name: 'Risk Tolerance', type: BudgetConstraintType.RISK_TOLERANCE, maxValue: 0.3, currentUsage: 0, priority: 3, hardLimit: true },
    ],
  },
  moderate: {
    name: 'Moderate',
    strategy: ROIStrategy.BALANCED,
    minROIThreshold: 1.0,
    constraints: [
      { id: 'token', name: 'Token Budget', type: BudgetConstraintType.TOKEN_BUDGET, maxValue: 250000, currentUsage: 0, priority: 2, hardLimit: true },
      { id: 'effort', name: 'Effort Hours', type: BudgetConstraintType.EFFORT_HOURS, maxValue: 40, currentUsage: 0, priority: 1, hardLimit: true },
      { id: 'risk', name: 'Risk Tolerance', type: BudgetConstraintType.RISK_TOLERANCE, maxValue: 0.5, currentUsage: 0, priority: 2, hardLimit: false },
    ],
  },
  aggressive: {
    name: 'Aggressive',
    strategy: ROIStrategy.HIGH_IMPACT,
    minROIThreshold: 0.5,
    constraints: [
      { id: 'token', name: 'Token Budget', type: BudgetConstraintType.TOKEN_BUDGET, maxValue: 500000, currentUsage: 0, priority: 1, hardLimit: false },
      { id: 'effort', name: 'Effort Hours', type: BudgetConstraintType.EFFORT_HOURS, maxValue: 80, currentUsage: 0, priority: 1, hardLimit: true },
      { id: 'risk', name: 'Risk Tolerance', type: BudgetConstraintType.RISK_TOLERANCE, maxValue: 0.7, currentUsage: 0, priority: 1, hardLimit: false },
    ],
  },
};

// ============================================================================
// OPTIMIZED ACTION PLAN
// ============================================================================

/**
 * Action selection decision
 */
export interface ActionSelectionDecision {
  actionId: string;
  selected: boolean;
  reason: string;
  alternativeConsidered?: string;
  roiScore: number;
  costImpact: number;
  valueImpact: number;
  constraintsAffected: string[];
}

/**
 * Optimized action plan under budget constraints
 */
export interface OptimizedActionPlan {
  id: string;
  projectId: string;
  createdAt: string;
  budgetProfile: BudgetProfile;
  selectedActions: ActionSelectionDecision[];
  rejectedActions: ActionSelectionDecision[];
  totalCost: ActionCostBreakdown;
  totalValue: ActionValueBreakdown;
  planROI: number;
  constraintUtilization: Record<string, {
    used: number;
    max: number;
    percent: number;
  }>;
  optimizationMethod: 'greedy' | 'knapsack' | 'rule_based';
  executionOrder: string[];    // Recommended order of execution
  summary: string;
  warnings: string[];
}

// ============================================================================
// FEEDBACK & LEARNING
// ============================================================================

/**
 * Cost feedback after action execution
 */
export interface CostFeedbackRecord {
  id: string;
  actionId: string;
  actionType: string;
  projectId: string;
  executedAt: string;
  
  // Estimated vs actual
  estimatedCost: ActionCostBreakdown;
  actualCost: Partial<ActionCostBreakdown>;
  
  // Cost accuracy
  tokenAccuracy: number;       // actual / estimated
  computeAccuracy: number;
  effortAccuracy: number;
  overallAccuracy: number;
  
  // Value accuracy
  estimatedValue: ActionValueBreakdown;
  actualValue: Partial<ActionValueBreakdown>;
  valueAccuracy: number;
  
  // Derived
  estimatedROI: number;
  actualROI: number;
  roiAccuracy: number;
  
  // Learning signals
  adjustmentFactor: number;    // Multiplier for future estimates
  notes: string;
}

/**
 * Aggregated cost heuristics from feedback
 */
export interface CostHeuristics {
  actionType: string;
  sampleSize: number;
  lastUpdated: string;
  
  // Token heuristics
  avgPromptTokens: number;
  avgCompletionTokens: number;
  tokenStdDev: number;
  
  // Effort heuristics
  avgEffortHours: number;
  effortStdDev: number;
  
  // Value heuristics
  avgValueRealized: number;
  valueRealizationRate: number; // % of estimated value actually achieved
  
  // Accuracy tracking
  overallAccuracyTrend: number[]; // Last N accuracy scores
  adjustmentMultiplier: number;   // Current adjustment factor
  
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Cost optimization configuration
 */
export interface CostOptimizationConfig {
  // Token costs (relative units per 1K tokens)
  tokenCostRates: Record<string, number>;
  
  // Compute costs (relative units)
  computeCostRates: {
    crawlPerPage: number;
    auditPerPage: number;
    embeddingPerPage: number;
    processingPerMB: number;
  };
  
  // Effort costs (hours multipliers)
  effortMultipliers: {
    engineering: number;
    content: number;
    review: number;
    coordination: number;
  };
  
  // Risk cost weights
  riskCostWeights: {
    ranking: number;
    traffic: number;
    penalty: number;
    brand: number;
    technical: number;
  };
  
  // Value estimation parameters
  valueParams: {
    trafficValuePerVisitor: number;
    positionValueMultiplier: number;
    riskReductionValue: number;
    brandConsistencyValue: number;
  };
  
  // Optimization settings
  optimization: {
    method: 'greedy' | 'knapsack' | 'rule_based';
    maxIterations: number;
    convergenceThreshold: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_COST_OPTIMIZATION_CONFIG: CostOptimizationConfig = {
  tokenCostRates: {
    'gpt-4': 3.0,
    'gpt-4-turbo': 1.0,
    'gpt-3.5-turbo': 0.2,
    'claude-3-opus': 2.5,
    'claude-3-sonnet': 0.8,
    'claude-3-haiku': 0.1,
    'default': 1.0,
  },
  computeCostRates: {
    crawlPerPage: 0.1,
    auditPerPage: 0.5,
    embeddingPerPage: 0.2,
    processingPerMB: 0.05,
  },
  effortMultipliers: {
    engineering: 1.5,
    content: 1.0,
    review: 0.5,
    coordination: 0.3,
  },
  riskCostWeights: {
    ranking: 1.0,
    traffic: 1.2,
    penalty: 2.0,
    brand: 0.8,
    technical: 0.6,
  },
  valueParams: {
    trafficValuePerVisitor: 0.1,
    positionValueMultiplier: 2.0,
    riskReductionValue: 10.0,
    brandConsistencyValue: 5.0,
  },
  optimization: {
    method: 'greedy',
    maxIterations: 1000,
    convergenceThreshold: 0.001,
  },
};

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Cost optimization report for dashboard
 */
export interface CostOptimizationReport {
  id: string;
  projectId: string;
  generatedAt: string;
  
  // Summary metrics
  totalActionsEvaluated: number;
  actionsSelected: number;
  actionsRejected: number;
  
  // Cost summary
  totalEstimatedCost: number;
  costByCategory: Record<CostCategory, number>;
  budgetUtilization: number;
  
  // Value summary
  totalExpectedValue: number;
  valueByCategory: Record<ValueCategory, number>;
  
  // ROI summary
  portfolioROI: number;
  avgActionROI: number;
  roiDistribution: {
    excellent: number;
    good: number;
    moderate: number;
    poor: number;
  };
  
  // Top actions
  topActionsByROI: Array<{
    actionId: string;
    title: string;
    roi: number;
    reason: string;
  }>;
  
  // Rejected actions
  rejectedActions: Array<{
    actionId: string;
    title: string;
    reason: string;
  }>;
  
  // Recommendations
  recommendations: string[];
  warnings: string[];
}
