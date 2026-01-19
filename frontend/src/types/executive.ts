/**
 * Executive Dashboard Types v1.8
 * 
 * Type definitions for Board-level SEO Dashboard.
 * Language is intentionally business-oriented, avoiding technical SEO jargon.
 */

// =============================================================================
// EXECUTIVE OVERVIEW TYPES
// =============================================================================

export interface ExecutiveOverviewData {
  /** Total SEO investment in relative units (normalized for board comparison) */
  totalInvestment: {
    current: number;
    previousPeriod: number;
    changePercent: number;
    unit: string;
  };
  
  /** Portfolio-level ROI */
  portfolioROI: {
    current: number;
    previousPeriod: number;
    changePercent: number;
    industryBenchmark?: number;
  };
  
  /** Year-over-Year trend */
  yoyTrend: {
    trafficGrowth: number;
    revenueContribution: number;
    costEfficiency: number;
  };
  
  /** Quarter-over-Quarter trend */
  qoqTrend: {
    trafficGrowth: number;
    revenueContribution: number;
    costEfficiency: number;
  };
  
  /** High-level confidence indicator (0-100) */
  confidenceScore: number;
  confidenceLevel: 'high' | 'moderate' | 'low';
  confidenceFactors: string[];
  
  /** Summary period */
  periodStart: string;
  periodEnd: string;
  lastUpdated: string;
}

// =============================================================================
// PORTFOLIO PERFORMANCE TYPES
// =============================================================================

export type ProjectClassification = 
  | 'growth_driver'      // High ROI, high growth (INVEST)
  | 'stable_contributor' // Stable ROI, low volatility (MAINTAIN)
  | 'cautious_optimize'  // Needs careful attention (OPTIMIZE_CAUTIOUSLY)
  | 'under_observation'  // Low performance, being monitored (OBSERVE)
  | 'turnaround'         // High potential, poor current state (TURNAROUND)
  | 'sunset_candidate';  // Consider phase-out (SUNSET)

export interface ProjectPerformance {
  projectId: string;
  projectName: string;
  domain: string;
  
  classification: ProjectClassification;
  classificationConfidence: number;
  
  /** Performance metrics (normalized 0-100) */
  performanceScore: number;
  roiScore: number;
  riskScore: number;
  growthScore: number;
  
  /** Allocation from portfolio optimization */
  allocationPercent: number;
  allocationChange: number; // vs previous period
  
  /** Key insight for executives */
  executiveSummary: string;
  
  /** Traffic trend (last 90 days) */
  trafficTrend: number[];
}

export interface PortfolioPerformanceData {
  /** Summary by classification */
  classificationSummary: {
    classification: ProjectClassification;
    label: string;
    projectCount: number;
    totalAllocation: number;
    averageROI: number;
    color: string;
  }[];
  
  /** Individual project performance */
  projects: ProjectPerformance[];
  
  /** Allocation totals */
  totalProjects: number;
  totalAllocationUsed: number;
  
  /** Portfolio health indicators */
  diversificationScore: number; // 0-100, higher = better diversified
  concentrationRisk: number; // 0-100, higher = more concentrated
}

// =============================================================================
// RISK & GOVERNANCE TYPES
// =============================================================================

export type RiskCategory = 
  | 'algorithm_dependency'
  | 'content_risk'
  | 'brand_risk'
  | 'technical_risk'
  | 'competitive_risk';

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

export interface RiskExposure {
  category: RiskCategory;
  label: string;
  level: RiskLevel;
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'degrading';
  description: string;
  mitigationStatus: string;
}

export interface GuardrailStatus {
  name: string;
  status: 'active' | 'warning' | 'breached';
  compliance: number; // 0-100
  lastChecked: string;
  description: string;
}

export interface SystemicRisk {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  affectedProjects: number;
  potentialImpact: string;
  recommendedAction: string;
}

export interface RiskRadarData {
  /** Overall portfolio risk score */
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  
  /** Risk breakdown by category */
  riskExposures: RiskExposure[];
  
  /** Guardrail statuses */
  guardrails: GuardrailStatus[];
  
  /** Systemic risks (board-level attention) */
  systemicRisks: SystemicRisk[];
  
  /** Risk trend (last 12 weeks) */
  riskTrend: { week: string; score: number }[];
}

// =============================================================================
// SCENARIO & STRATEGIC TYPES
// =============================================================================

export interface BoardScenario {
  id: string;
  name: string;
  description: string;
  type: 'budget_increase' | 'budget_decrease' | 'reduce_automation' | 'pause_risky' | 'aggressive_growth' | 'conservative';
  
  /** Simulated outcomes */
  projectedROI: number;
  roiChange: number;
  projectedRisk: number;
  riskDelta: number;
  
  /** Confidence in projection */
  confidenceRange: {
    low: number;
    mid: number;
    high: number;
  };
  
  /** Trade-offs */
  tradeoffs: string[];
  
  /** Recommendation */
  recommendation: 'recommended' | 'neutral' | 'not_recommended';
  rationale: string;
}

export interface ScenarioSummaryData {
  /** Current baseline */
  baseline: {
    roi: number;
    risk: number;
    confidence: number;
  };
  
  /** Available scenarios */
  scenarios: BoardScenario[];
  
  /** Best scenario recommendation */
  recommendedScenario?: string;
  recommendationRationale?: string;
}

// =============================================================================
// AUTOMATION TRANSPARENCY TYPES
// =============================================================================

export interface AutomationMetrics {
  /** Work distribution */
  aiWorkPercent: number;
  humanWorkPercent: number;
  
  /** Breakdown by task type */
  taskBreakdown: {
    taskType: string;
    aiPercent: number;
    humanPercent: number;
    totalTasks: number;
  }[];
  
  /** Auto-execution stats (low-risk only) */
  autoExecuted: {
    total: number;
    successful: number;
    rolledBack: number;
    period: string;
  };
  
  /** Trust indicators */
  trustScore: number; // 0-100
  controlIndicators: {
    name: string;
    status: 'enabled' | 'limited' | 'disabled';
    description: string;
  }[];
  
  /** Rollback incidents */
  rollbackIncidents: {
    date: string;
    reason: string;
    impact: string;
    resolved: boolean;
  }[];
}

// =============================================================================
// EXECUTIVE SUMMARY TYPES
// =============================================================================

export interface KeyInsight {
  id: string;
  category: 'opportunity' | 'risk' | 'achievement' | 'attention';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface StrategicRecommendation {
  id: string;
  priority: number;
  title: string;
  description: string;
  expectedOutcome: string;
  timeframe: string;
  requiredDecision?: string;
}

export interface ExecutiveSummaryData {
  /** One-page narrative */
  narrativeSummary: string;
  
  /** Key insights (3-5 max) */
  keyInsights: KeyInsight[];
  
  /** Strategic recommendations */
  recommendations: StrategicRecommendation[];
  
  /** Period covered */
  periodCovered: string;
  
  /** Generated timestamp */
  generatedAt: string;
  
  /** Data freshness */
  dataFreshness: 'real-time' | 'daily' | 'weekly';
}

// =============================================================================
// COMBINED EXECUTIVE DASHBOARD
// =============================================================================

export interface ExecutiveDashboardData {
  overview: ExecutiveOverviewData;
  portfolio: PortfolioPerformanceData;
  risk: RiskRadarData;
  scenarios: ScenarioSummaryData;
  automation: AutomationMetrics;
  summary: ExecutiveSummaryData;
  
  /** Dashboard metadata */
  meta: {
    portfolioId: string;
    portfolioName: string;
    generatedAt: string;
    dataVersion: string;
  };
}
