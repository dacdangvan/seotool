/**
 * Scenario Simulation v1.5 - Models & Types
 * 
 * Defines all types for what-if analysis and impact simulation.
 * 
 * Key Concepts:
 * - Scenario: A potential future state based on actions taken
 * - Impact: Quantified effect on SEO metrics
 * - Simulation: Projection of outcomes over time horizons
 * - Recommendation: Ranked suggestion with trade-off explanation
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';

// ============================================================================
// TIME HORIZONS
// ============================================================================

export type TimeHorizon = 30 | 60 | 90;

export const TIME_HORIZONS: TimeHorizon[] = [30, 60, 90];

// ============================================================================
// SCENARIO TYPES
// ============================================================================

export enum ScenarioType {
  /** Do nothing - baseline for comparison */
  BASELINE = 'baseline',
  
  /** Execute proposed action as-is */
  PROPOSED = 'proposed',
  
  /** Execute with reduced scope (fewer pages, limited changes) */
  REDUCED_SCOPE = 'reduced_scope',
  
  /** Delay execution by specified period */
  DELAYED = 'delayed',
  
  /** Phased rollout (gradual execution) */
  PHASED = 'phased',
  
  /** Combined with other pending actions */
  COMBINED = 'combined',
  
  /** Custom variant */
  CUSTOM = 'custom',
}

/**
 * A scenario represents a potential future state
 */
export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: ScenarioType;
  
  /** Actions included in this scenario */
  actions: ScenarioAction[];
  
  /** Modifications to original actions */
  modifications: ScenarioModification[];
  
  /** When scenario was created */
  createdAt: string;
  
  /** Scenario-specific parameters */
  parameters: ScenarioParameters;
}

export interface ScenarioAction {
  /** Reference to original action */
  actionId: string;
  action: SEOAction;
  
  /** Whether action is included in this scenario */
  included: boolean;
  
  /** Execution timing (days from now) */
  executionDelay: number;
  
  /** Scope modifier (0.0 - 1.0, where 1.0 = full scope) */
  scopeModifier: number;
}

export interface ScenarioModification {
  type: 'delay' | 'reduce_scope' | 'exclude' | 'combine';
  targetActionId: string;
  originalValue: unknown;
  modifiedValue: unknown;
  reason: string;
}

export interface ScenarioParameters {
  /** Delay in days for delayed scenarios */
  delayDays?: number;
  
  /** Scope percentage (0-100) for reduced scope */
  scopePercentage?: number;
  
  /** Phase count for phased rollout */
  phaseCount?: number;
  
  /** Days between phases */
  daysBetweenPhases?: number;
  
  /** Custom parameters */
  custom?: Record<string, unknown>;
}

// ============================================================================
// IMPACT METRICS
// ============================================================================

/**
 * Confidence interval for projections
 */
export interface ConfidenceInterval {
  low: number;
  mid: number;
  high: number;
  confidenceLevel: number; // e.g., 0.95 for 95% CI
}

/**
 * Traffic impact projection
 */
export interface TrafficImpact {
  /** Current baseline traffic */
  currentTraffic: number;
  
  /** Projected traffic at each horizon */
  projectedTraffic: Record<TimeHorizon, ConfidenceInterval>;
  
  /** Percentage change from baseline */
  percentageChange: Record<TimeHorizon, ConfidenceInterval>;
  
  /** Traffic sources breakdown */
  sourceBreakdown: {
    organic: ConfidenceInterval;
    direct: ConfidenceInterval;
    referral: ConfidenceInterval;
  };
}

/**
 * Keyword ranking impact
 */
export interface RankingImpact {
  /** Keywords affected */
  keywordsAffected: number;
  
  /** Average position change */
  avgPositionChange: Record<TimeHorizon, ConfidenceInterval>;
  
  /** Keywords expected to improve */
  keywordsImproving: Record<TimeHorizon, number>;
  
  /** Keywords expected to decline */
  keywordsDeclining: Record<TimeHorizon, number>;
  
  /** Top keyword projections */
  topKeywordProjections: KeywordProjection[];
}

export interface KeywordProjection {
  keyword: string;
  currentPosition: number;
  projectedPosition: Record<TimeHorizon, ConfidenceInterval>;
  searchVolume: number;
  difficulty: number;
}

/**
 * Risk exposure assessment
 */
export interface RiskImpact {
  /** Overall risk score (0-1) */
  overallRiskScore: number;
  
  /** Risk by category */
  categoryRisks: CategoryRisk[];
  
  /** Potential negative outcomes */
  potentialDownsides: PotentialOutcome[];
  
  /** Risk mitigation factors */
  mitigationFactors: string[];
}

export interface CategoryRisk {
  category: RiskCategory;
  score: number;
  probability: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export enum RiskCategory {
  RANKING_DROP = 'ranking_drop',
  TRAFFIC_LOSS = 'traffic_loss',
  PENALTY_RISK = 'penalty_risk',
  BRAND_DAMAGE = 'brand_damage',
  TECHNICAL_FAILURE = 'technical_failure',
  CONTENT_QUALITY = 'content_quality',
  OVER_OPTIMIZATION = 'over_optimization',
}

export interface PotentialOutcome {
  description: string;
  probability: number;
  severity: 'low' | 'medium' | 'high';
  recoveryTime: number; // days
}

/**
 * Brand consistency impact
 */
export interface BrandImpact {
  /** Current brand compliance score */
  currentBrandScore: number;
  
  /** Projected brand score */
  projectedBrandScore: Record<TimeHorizon, ConfidenceInterval>;
  
  /** Brand drift risk */
  driftRisk: number;
  
  /** Potential brand violations */
  potentialViolations: BrandViolationRisk[];
  
  /** Brand consistency trend */
  consistencyTrend: 'improving' | 'stable' | 'declining';
}

export interface BrandViolationRisk {
  type: string;
  probability: number;
  severity: 'blocking' | 'warning' | 'info';
  affectedContent: string[];
}

// ============================================================================
// SIMULATION RESULTS
// ============================================================================

/**
 * Complete simulation result for a scenario
 */
export interface SimulationResult {
  id: string;
  scenarioId: string;
  projectId: string;
  
  /** When simulation was run */
  simulatedAt: string;
  
  /** Simulation duration */
  durationMs: number;
  
  /** Impact projections */
  trafficImpact: TrafficImpact;
  rankingImpact: RankingImpact;
  riskImpact: RiskImpact;
  brandImpact: BrandImpact;
  
  /** Effort estimation */
  effortEstimate: EffortEstimate;
  
  /** Overall scores for comparison */
  scores: SimulationScores;
  
  /** Assumptions made during simulation */
  assumptions: SimulationAssumption[];
  
  /** Data sources used */
  dataSources: DataSourceReference[];
  
  /** Confidence in overall result */
  overallConfidence: number;
}

export interface EffortEstimate {
  /** Developer/SEO hours required */
  hoursRequired: number;
  
  /** Complexity rating */
  complexity: 'low' | 'medium' | 'high';
  
  /** Dependencies on other work */
  dependencies: string[];
  
  /** Reversibility */
  reversible: boolean;
  reversibilityEffort: 'easy' | 'moderate' | 'difficult';
}

export interface SimulationScores {
  /** Expected gain score (0-100) */
  expectedGain: number;
  
  /** Risk score (0-100, higher = riskier) */
  riskScore: number;
  
  /** Confidence score (0-100) */
  confidenceScore: number;
  
  /** Effort score (0-100, higher = more effort) */
  effortScore: number;
  
  /** Composite score for ranking */
  compositeScore: number;
  
  /** ROI estimate */
  estimatedROI: number;
}

export interface SimulationAssumption {
  id: string;
  category: 'traffic' | 'ranking' | 'risk' | 'brand' | 'general';
  description: string;
  basis: string;
  sensitivity: 'low' | 'medium' | 'high';
}

export interface DataSourceReference {
  source: string;
  dataType: string;
  dateRange: { start: string; end: string };
  recordCount: number;
  reliability: number;
}

// ============================================================================
// SCENARIO COMPARISON
// ============================================================================

/**
 * Comparison between multiple scenarios
 */
export interface ScenarioComparison {
  id: string;
  projectId: string;
  comparedAt: string;
  
  /** Scenarios being compared */
  scenarioIds: string[];
  
  /** Comparison results */
  rankings: ScenarioRanking[];
  
  /** Trade-off analysis */
  tradeOffs: TradeOffAnalysis[];
  
  /** Comparison matrix */
  comparisonMatrix: ComparisonMatrix;
}

export interface ScenarioRanking {
  scenarioId: string;
  scenarioName: string;
  rank: number;
  compositeScore: number;
  
  /** Rank by individual metric */
  metricRanks: {
    expectedGain: number;
    riskScore: number;
    confidenceScore: number;
    effortScore: number;
  };
  
  /** Strengths of this scenario */
  strengths: string[];
  
  /** Weaknesses of this scenario */
  weaknesses: string[];
}

export interface TradeOffAnalysis {
  scenarioA: string;
  scenarioB: string;
  
  /** What A gains over B */
  aAdvantages: string[];
  
  /** What B gains over A */
  bAdvantages: string[];
  
  /** Net recommendation */
  recommendation: 'prefer_a' | 'prefer_b' | 'equivalent';
  
  /** Explanation */
  explanation: string;
}

export interface ComparisonMatrix {
  metrics: string[];
  scenarios: string[];
  values: number[][];
  normalizedValues: number[][];
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

/**
 * Final recommendation from simulation
 */
export interface SimulationRecommendation {
  id: string;
  projectId: string;
  generatedAt: string;
  
  /** Best scenario recommendation */
  bestScenario: RecommendedScenario;
  
  /** Safe alternative (lower risk) */
  safeAlternative: RecommendedScenario | null;
  
  /** Not recommended scenarios with reasons */
  notRecommended: NotRecommendedScenario[];
  
  /** Overall summary */
  summary: string;
  
  /** Key trade-offs explained */
  keyTradeOffs: string[];
  
  /** Conditions that would change recommendation */
  sensitivityNotes: string[];
  
  /** Suggested next steps */
  nextSteps: string[];
}

export interface RecommendedScenario {
  scenarioId: string;
  scenarioName: string;
  scenarioType: ScenarioType;
  
  /** Why recommended */
  reasons: string[];
  
  /** Expected outcomes */
  expectedOutcomes: ExpectedOutcome[];
  
  /** Key risks to monitor */
  keyRisks: string[];
  
  /** Confidence level */
  confidence: number;
  
  /** Recommended execution timing */
  suggestedTiming: string;
}

export interface NotRecommendedScenario {
  scenarioId: string;
  scenarioName: string;
  reasons: string[];
  conditionsToReconsider: string[];
}

export interface ExpectedOutcome {
  metric: string;
  currentValue: number;
  projectedValue: ConfidenceInterval;
  timeHorizon: TimeHorizon;
  unit: string;
}

// ============================================================================
// HISTORICAL DATA INTERFACES
// ============================================================================

/**
 * Historical data for simulation input
 */
export interface HistoricalData {
  projectId: string;
  dateRange: { start: string; end: string };
  
  /** Traffic history */
  trafficHistory: TrafficDataPoint[];
  
  /** Ranking history */
  rankingHistory: RankingDataPoint[];
  
  /** Content scores */
  contentScores: ContentScoreDataPoint[];
  
  /** Technical health */
  technicalHealth: TechnicalHealthDataPoint[];
  
  /** Brand compliance history */
  brandScores: BrandScoreDataPoint[];
  
  /** Past action outcomes */
  actionOutcomes: ActionOutcomeDataPoint[];
}

export interface TrafficDataPoint {
  date: string;
  organic: number;
  total: number;
  sessions: number;
  pageviews: number;
}

export interface RankingDataPoint {
  date: string;
  keyword: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface ContentScoreDataPoint {
  date: string;
  url: string;
  qualityScore: number;
  readabilityScore: number;
  seoScore: number;
}

export interface TechnicalHealthDataPoint {
  date: string;
  overallScore: number;
  issueCount: number;
  criticalIssues: number;
  pageSpeedScore: number;
}

export interface BrandScoreDataPoint {
  date: string;
  complianceScore: number;
  violationCount: number;
  driftScore: number;
}

export interface ActionOutcomeDataPoint {
  actionId: string;
  actionType: ActionType;
  executedAt: string;
  trafficBefore: number;
  trafficAfter30Days: number;
  trafficAfter60Days: number;
  trafficAfter90Days: number;
  success: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface SimulationConfig {
  projectId: string;
  
  /** Default confidence level for intervals */
  defaultConfidenceLevel: number;
  
  /** Weight factors for composite score */
  scoreWeights: {
    expectedGain: number;
    riskScore: number;
    confidenceScore: number;
    effortScore: number;
  };
  
  /** Minimum data points required for simulation */
  minDataPoints: number;
  
  /** Whether to include baseline automatically */
  alwaysIncludeBaseline: boolean;
  
  /** Maximum scenarios to generate */
  maxScenarios: number;
  
  /** Sensitivity analysis settings */
  sensitivitySettings: {
    enabled: boolean;
    variationPercent: number;
  };
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  projectId: '',
  defaultConfidenceLevel: 0.80,
  scoreWeights: {
    expectedGain: 0.35,
    riskScore: 0.25,
    confidenceScore: 0.20,
    effortScore: 0.20,
  },
  minDataPoints: 30,
  alwaysIncludeBaseline: true,
  maxScenarios: 5,
  sensitivitySettings: {
    enabled: true,
    variationPercent: 20,
  },
};

// ============================================================================
// SIMULATION REQUEST/RESPONSE
// ============================================================================

export interface SimulationRequest {
  projectId: string;
  
  /** Actions to simulate */
  actions: SEOAction[];
  
  /** Specific scenarios to generate (optional) */
  requestedScenarios?: ScenarioType[];
  
  /** Historical data (if not fetched internally) */
  historicalData?: HistoricalData;
  
  /** Configuration overrides */
  config?: Partial<SimulationConfig>;
}

export interface SimulationResponse {
  requestId: string;
  projectId: string;
  
  /** Generated scenarios */
  scenarios: Scenario[];
  
  /** Simulation results for each scenario */
  results: SimulationResult[];
  
  /** Comparison analysis */
  comparison: ScenarioComparison;
  
  /** Final recommendation */
  recommendation: SimulationRecommendation;
  
  /** Processing metadata */
  metadata: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    scenariosGenerated: number;
    dataPointsAnalyzed: number;
  };
}

// ============================================================================
// VERSION
// ============================================================================

export const SCENARIO_SIMULATION_VERSION = '1.5.0';
