/**
 * Portfolio Aggregator v1.7
 * 
 * Collects and aggregates per-project metrics from v1.0–v1.6 components.
 * Normalizes metrics across projects for cross-project comparison.
 * 
 * Design Principles:
 * - Collect data from all relevant subsystems
 * - Handle missing data gracefully
 * - Normalize to comparable scales
 * - Maintain data provenance
 */

import {
  ProjectMetrics,
  TrafficMetrics,
  ROIMetrics,
  RiskMetrics,
  CostMetrics,
  ProjectionMetrics,
  ProjectionRange,
  NormalizedProjectMetrics,
  NormalizationMethod,
  PortfolioOptimizationConfig,
  DEFAULT_PORTFOLIO_CONFIG,
} from './models';

// ============================================================================
// DATA SOURCE INTERFACES
// ============================================================================

/**
 * Interface for traffic data source (v0.6 Monitoring)
 */
export interface TrafficDataSource {
  projectId: string;
  currentMonthlyTraffic: number;
  previousMonthlyTraffic: number;
  organicTraffic: number;
  totalTraffic: number;
  topKeywords: Array<{ keyword: string; position: number; volume: number }>;
  averagePosition: number;
  collectedAt: string;
}

/**
 * Interface for ROI data source (v1.6 Cost Optimization)
 */
export interface ROIDataSource {
  projectId: string;
  actionROIScores: Array<{ actionId: string; roi: number; success: boolean }>;
  totalValueGenerated: number;
  totalCostIncurred: number;
  collectedAt: string;
}

/**
 * Interface for risk data source (v1.2 / v1.4)
 */
export interface RiskDataSource {
  projectId: string;
  overallRiskScore: number;
  penaltyRisk: number;
  rankingVolatility: number;
  technicalIssues: Array<{ severity: string; count: number }>;
  brandViolations: Array<{ type: string; count: number }>;
  brandComplianceScore: number;
  collectedAt: string;
}

/**
 * Interface for cost data source (v1.6)
 */
export interface CostDataSource {
  projectId: string;
  tokenUsage: number;
  computeCost: number;
  effortHours: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * Interface for projection data source (v1.5 Scenario Simulation)
 */
export interface ProjectionDataSource {
  projectId: string;
  trafficForecast30d: ProjectionRange;
  trafficForecast60d: ProjectionRange;
  trafficForecast90d: ProjectionRange;
  confidenceScore: number;
  bestScenarioId?: string;
  worstScenarioId?: string;
  collectedAt: string;
}

/**
 * Raw data input for aggregation
 */
export interface RawProjectData {
  projectId: string;
  projectName: string;
  domain: string;
  trafficData?: TrafficDataSource;
  roiData?: ROIDataSource;
  riskData?: RiskDataSource;
  costData?: CostDataSource;
  projectionData?: ProjectionDataSource;
}

// ============================================================================
// PORTFOLIO AGGREGATOR
// ============================================================================

/**
 * Aggregates project metrics from multiple data sources
 */
export class PortfolioAggregator {
  private config: PortfolioOptimizationConfig;
  private logger: Console;
  
  constructor(config: Partial<PortfolioOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_PORTFOLIO_CONFIG, ...config };
    this.logger = console;
  }
  
  // ==========================================================================
  // MAIN AGGREGATION
  // ==========================================================================
  
  /**
   * Aggregate metrics for all projects
   */
  aggregatePortfolio(rawData: RawProjectData[]): ProjectMetrics[] {
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioAggregator] Aggregating ${rawData.length} projects`);
    }
    
    const projectMetrics: ProjectMetrics[] = [];
    
    for (const data of rawData) {
      try {
        const metrics = this.aggregateProject(data);
        projectMetrics.push(metrics);
      } catch (error) {
        this.logger.error(`[PortfolioAggregator] Error aggregating project ${data.projectId}:`, error);
        // Continue with other projects
      }
    }
    
    return projectMetrics;
  }
  
  /**
   * Aggregate metrics for a single project
   */
  aggregateProject(data: RawProjectData): ProjectMetrics {
    const traffic = this.aggregateTrafficMetrics(data.trafficData);
    const roi = this.aggregateROIMetrics(data.roiData);
    const risk = this.aggregateRiskMetrics(data.riskData);
    const cost = this.aggregateCostMetrics(data.costData);
    const projections = this.aggregateProjectionMetrics(data.projectionData);
    
    // Calculate overall health score
    const healthScore = this.calculateHealthScore(traffic, roi, risk, cost);
    
    // Determine data quality
    const dataQuality = this.assessDataQuality(data);
    
    return {
      projectId: data.projectId,
      projectName: data.projectName,
      domain: data.domain,
      collectedAt: new Date().toISOString(),
      traffic,
      roi,
      risk,
      cost,
      projections,
      healthScore,
      dataQuality,
    };
  }
  
  // ==========================================================================
  // METRIC AGGREGATION
  // ==========================================================================
  
  private aggregateTrafficMetrics(data?: TrafficDataSource): TrafficMetrics {
    if (!data) {
      return this.getDefaultTrafficMetrics();
    }
    
    const growthRate = data.previousMonthlyTraffic > 0
      ? ((data.currentMonthlyTraffic - data.previousMonthlyTraffic) / data.previousMonthlyTraffic) * 100
      : 0;
    
    let trend: 'growing' | 'stable' | 'declining';
    if (growthRate > 5) {
      trend = 'growing';
    } else if (growthRate < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
    
    const organicShare = data.totalTraffic > 0
      ? (data.organicTraffic / data.totalTraffic) * 100
      : 0;
    
    return {
      currentMonthlyTraffic: data.currentMonthlyTraffic,
      previousMonthlyTraffic: data.previousMonthlyTraffic,
      trafficTrend: trend,
      trafficGrowthRate: growthRate,
      organicShare,
      topKeywordsCount: data.topKeywords?.length || 0,
      averagePosition: data.averagePosition || 0,
    };
  }
  
  private aggregateROIMetrics(data?: ROIDataSource): ROIMetrics {
    if (!data) {
      return this.getDefaultROIMetrics();
    }
    
    const roiScores = data.actionROIScores.map(a => a.roi);
    const averageROI = roiScores.length > 0
      ? roiScores.reduce((a, b) => a + b, 0) / roiScores.length
      : 0;
    const bestROI = roiScores.length > 0 ? Math.max(...roiScores) : 0;
    
    const successfulActions = data.actionROIScores.filter(a => a.success).length;
    const successRate = data.actionROIScores.length > 0
      ? (successfulActions / data.actionROIScores.length) * 100
      : 0;
    
    const portfolioROI = data.totalCostIncurred > 0
      ? (data.totalValueGenerated / data.totalCostIncurred) * 100
      : 0;
    
    const valuePerCost = data.totalCostIncurred > 0
      ? data.totalValueGenerated / data.totalCostIncurred
      : 0;
    
    return {
      averageActionROI: averageROI,
      bestActionROI: bestROI,
      portfolioROI,
      roiTrend: 'stable', // Would need historical data to determine
      actionSuccessRate: successRate,
      valuePerCostUnit: valuePerCost,
    };
  }
  
  private aggregateRiskMetrics(data?: RiskDataSource): RiskMetrics {
    if (!data) {
      return this.getDefaultRiskMetrics();
    }
    
    // Count critical issues
    const criticalIssues = data.technicalIssues
      .filter(i => i.severity === 'critical')
      .reduce((sum, i) => sum + i.count, 0);
    
    // Calculate technical debt score (inverse of health)
    const technicalDebtScore = Math.min(100, criticalIssues * 10 + 
      data.technicalIssues.filter(i => i.severity === 'high').reduce((s, i) => s + i.count, 0) * 5);
    
    return {
      overallRiskScore: data.overallRiskScore,
      penaltyRisk: data.penaltyRisk,
      rankingVolatility: data.rankingVolatility,
      technicalDebtScore,
      brandComplianceScore: data.brandComplianceScore,
      riskTrend: 'stable', // Would need historical data
      criticalIssuesCount: criticalIssues,
    };
  }
  
  private aggregateCostMetrics(data?: CostDataSource): CostMetrics {
    if (!data) {
      return this.getDefaultCostMetrics();
    }
    
    const totalCost = data.tokenUsage * 0.01 + data.computeCost + data.effortHours * 50;
    
    return {
      monthlyTokenUsage: data.tokenUsage,
      monthlyComputeCost: data.computeCost,
      monthlyEffortHours: data.effortHours,
      totalMonthlyCost: totalCost,
      costEfficiency: 0, // Calculated later with value data
      costTrend: 'stable',
    };
  }
  
  private aggregateProjectionMetrics(data?: ProjectionDataSource): ProjectionMetrics {
    if (!data) {
      return this.getDefaultProjectionMetrics();
    }
    
    return {
      trafficForecast30d: data.trafficForecast30d,
      trafficForecast60d: data.trafficForecast60d,
      trafficForecast90d: data.trafficForecast90d,
      confidenceScore: data.confidenceScore,
      bestCaseScenarioId: data.bestScenarioId,
      worstCaseScenarioId: data.worstScenarioId,
    };
  }
  
  // ==========================================================================
  // DEFAULT METRICS (for missing data)
  // ==========================================================================
  
  private getDefaultTrafficMetrics(): TrafficMetrics {
    return {
      currentMonthlyTraffic: 0,
      previousMonthlyTraffic: 0,
      trafficTrend: 'stable',
      trafficGrowthRate: 0,
      organicShare: 0,
      topKeywordsCount: 0,
      averagePosition: 0,
    };
  }
  
  private getDefaultROIMetrics(): ROIMetrics {
    return {
      averageActionROI: 0,
      bestActionROI: 0,
      portfolioROI: 0,
      roiTrend: 'stable',
      actionSuccessRate: 0,
      valuePerCostUnit: 0,
    };
  }
  
  private getDefaultRiskMetrics(): RiskMetrics {
    return {
      overallRiskScore: 0.5,
      penaltyRisk: 0,
      rankingVolatility: 0,
      technicalDebtScore: 50,
      brandComplianceScore: 50,
      riskTrend: 'stable',
      criticalIssuesCount: 0,
    };
  }
  
  private getDefaultCostMetrics(): CostMetrics {
    return {
      monthlyTokenUsage: 0,
      monthlyComputeCost: 0,
      monthlyEffortHours: 0,
      totalMonthlyCost: 0,
      costEfficiency: 0,
      costTrend: 'stable',
    };
  }
  
  private getDefaultProjectionMetrics(): ProjectionMetrics {
    return {
      trafficForecast30d: { low: 0, mid: 0, high: 0 },
      trafficForecast60d: { low: 0, mid: 0, high: 0 },
      trafficForecast90d: { low: 0, mid: 0, high: 0 },
      confidenceScore: 0,
    };
  }
  
  // ==========================================================================
  // HEALTH SCORE CALCULATION
  // ==========================================================================
  
  private calculateHealthScore(
    traffic: TrafficMetrics,
    roi: ROIMetrics,
    risk: RiskMetrics,
    cost: CostMetrics
  ): number {
    // Weight factors
    const weights = {
      trafficGrowth: 0.25,
      roi: 0.25,
      riskInverse: 0.25,
      efficiency: 0.25,
    };
    
    // Normalize components to 0-100
    const trafficScore = this.normalizeGrowthRate(traffic.trafficGrowthRate);
    const roiScore = Math.min(100, Math.max(0, roi.portfolioROI));
    const riskScore = 100 - (risk.overallRiskScore * 100); // Invert so higher is better
    const efficiencyScore = Math.min(100, cost.costEfficiency * 10);
    
    const healthScore = 
      trafficScore * weights.trafficGrowth +
      roiScore * weights.roi +
      riskScore * weights.riskInverse +
      efficiencyScore * weights.efficiency;
    
    return Math.round(Math.max(0, Math.min(100, healthScore)));
  }
  
  private normalizeGrowthRate(rate: number): number {
    // Map growth rate to 0-100
    // -50% → 0, 0% → 50, +50% → 100
    return Math.max(0, Math.min(100, (rate + 50)));
  }
  
  // ==========================================================================
  // DATA QUALITY ASSESSMENT
  // ==========================================================================
  
  private assessDataQuality(data: RawProjectData): 'low' | 'medium' | 'high' {
    let score = 0;
    let total = 5;
    
    if (data.trafficData) score++;
    if (data.roiData) score++;
    if (data.riskData) score++;
    if (data.costData) score++;
    if (data.projectionData) score++;
    
    const ratio = score / total;
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'medium';
    return 'low';
  }
  
  // ==========================================================================
  // NORMALIZATION
  // ==========================================================================
  
  /**
   * Normalize metrics across all projects for comparison
   */
  normalizeMetrics(projects: ProjectMetrics[]): NormalizedProjectMetrics[] {
    if (projects.length === 0) return [];
    
    const method = this.config.normalizationMethod;
    
    // Extract raw values for normalization
    const trafficValues = projects.map(p => p.traffic.currentMonthlyTraffic);
    const growthValues = projects.map(p => p.traffic.trafficGrowthRate);
    const roiValues = projects.map(p => p.roi.portfolioROI);
    const riskValues = projects.map(p => p.risk.overallRiskScore);
    const efficiencyValues = projects.map(p => p.cost.costEfficiency);
    
    // Calculate stability (inverse of volatility)
    const stabilityValues = projects.map(p => 100 - p.risk.rankingVolatility * 100);
    
    // Calculate potential (projection growth)
    const potentialValues = projects.map(p => {
      const currentTraffic = p.traffic.currentMonthlyTraffic || 1;
      const projectedTraffic = p.projections.trafficForecast90d.mid || currentTraffic;
      return ((projectedTraffic - currentTraffic) / currentTraffic) * 100;
    });
    
    return projects.map((project, index) => {
      const trafficScore = this.normalize(trafficValues[index], trafficValues, method);
      const growthScore = this.normalize(growthValues[index], growthValues, method);
      const roiScore = this.normalize(roiValues[index], roiValues, method);
      const riskScore = this.normalize(riskValues[index], riskValues, method);
      const efficiencyScore = this.normalize(efficiencyValues[index], efficiencyValues, method);
      const stabilityScore = this.normalize(stabilityValues[index], stabilityValues, method);
      const potentialScore = this.normalize(potentialValues[index], potentialValues, method);
      
      // Calculate composite scores
      const overallScore = (trafficScore + growthScore + roiScore + (100 - riskScore) + efficiencyScore) / 5;
      const investmentAttractivenessScore = (roiScore * 0.4 + growthScore * 0.3 + (100 - riskScore) * 0.3);
      
      // Calculate ranks
      const trafficRank = this.calculateRank(trafficValues[index], trafficValues);
      const roiRank = this.calculateRank(roiValues[index], roiValues);
      const riskRank = this.calculateRank(riskValues[index], riskValues, true); // Lower is better
      
      return {
        projectId: project.projectId,
        trafficScore,
        growthScore,
        roiScore,
        riskScore,
        efficiencyScore,
        stabilityScore,
        potentialScore,
        overallScore,
        investmentAttractivenessScore,
        trafficRank,
        roiRank,
        riskRank,
        normalizedAt: new Date().toISOString(),
        normalizationMethod: method,
      };
    });
  }
  
  private normalize(value: number, allValues: number[], method: NormalizationMethod): number {
    switch (method) {
      case NormalizationMethod.MIN_MAX:
        return this.minMaxNormalize(value, allValues);
      case NormalizationMethod.Z_SCORE:
        return this.zScoreNormalize(value, allValues);
      case NormalizationMethod.PERCENTILE:
        return this.percentileNormalize(value, allValues);
      default:
        return this.minMaxNormalize(value, allValues);
    }
  }
  
  private minMaxNormalize(value: number, allValues: number[]): number {
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    if (max === min) return 50; // All values are the same
    return ((value - min) / (max - min)) * 100;
  }
  
  private zScoreNormalize(value: number, allValues: number[]): number {
    const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const variance = allValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / allValues.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 50;
    
    const zScore = (value - mean) / stdDev;
    // Convert z-score to 0-100 scale (assuming -3 to +3 range)
    return Math.max(0, Math.min(100, (zScore + 3) / 6 * 100));
  }
  
  private percentileNormalize(value: number, allValues: number[]): number {
    const sorted = [...allValues].sort((a, b) => a - b);
    const index = sorted.indexOf(value);
    return (index / (sorted.length - 1 || 1)) * 100;
  }
  
  private calculateRank(value: number, allValues: number[], lowerIsBetter: boolean = false): number {
    const sorted = [...allValues].sort((a, b) => lowerIsBetter ? a - b : b - a);
    return sorted.indexOf(value) + 1;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createPortfolioAggregator(
  config?: Partial<PortfolioOptimizationConfig>
): PortfolioAggregator {
  return new PortfolioAggregator(config);
}
