/**
 * Dashboard Types
 * 
 * v0.7 - Type definitions for Manager Dashboard
 */

// =============================================================================
// KPI TYPES
// =============================================================================

export interface KPIMetric {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TrafficKPI extends KPIMetric {
  period: string;
}

export interface KeywordCoverageKPI {
  top3: number;
  top3Change: number;
  top10: number;
  top10Change: number;
  totalTracked: number;
}

export interface ContentPerformanceKPI {
  totalPages: number;
  highPerforming: number;
  needsOptimization: number;
  newContent: number;
}

export interface KPIOverviewData {
  organicTraffic: TrafficKPI;
  keywordCoverage: KeywordCoverageKPI;
  contentPerformance: ContentPerformanceKPI;
  healthScore: number;
  healthScoreChange: number;
  lastUpdated: string;
}

// =============================================================================
// HEALTH & RISK TYPES
// =============================================================================

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface HealthItem {
  name: string;
  status: HealthStatus;
  score: number;
  issues: number;
  description: string;
}

export interface RiskAlert {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric: string;
  detectedAt: string;
  impact: string;
}

export interface SEOHealthData {
  overall: {
    score: number;
    status: HealthStatus;
  };
  technical: HealthItem;
  content: HealthItem;
  authority: HealthItem;
  monitoring: HealthItem;
  activeAlerts: RiskAlert[];
}

// =============================================================================
// FORECAST TYPES
// =============================================================================

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface ForecastData {
  current: number;
  forecast30d: ForecastPoint;
  forecast60d: ForecastPoint;
  forecast90d: ForecastPoint;
  dailyForecast: ForecastPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  confidence: number;
  lastUpdated: string;
}

// =============================================================================
// RECOMMENDATION TYPES
// =============================================================================

export type ImpactLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'high' | 'medium' | 'low';
export type RiskLevel = 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  risk: RiskLevel;
  category: 'technical' | 'content' | 'authority' | 'monitoring';
  estimatedTrafficGain?: number;
  priority: number;
}

export interface RecommendationData {
  topRecommendations: Recommendation[];
  totalOpportunities: number;
  potentialTrafficGain: number;
  generatedAt: string;
}

// =============================================================================
// COPILOT TYPES
// =============================================================================

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CopilotSuggestion {
  text: string;
  category: 'traffic' | 'ranking' | 'content' | 'general';
}

// =============================================================================
// DASHBOARD AGGREGATE
// =============================================================================

export interface DashboardData {
  kpiOverview: KPIOverviewData;
  seoHealth: SEOHealthData;
  forecast: ForecastData;
  recommendations: RecommendationData;
}
