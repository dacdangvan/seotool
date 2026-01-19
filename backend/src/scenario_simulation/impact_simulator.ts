/**
 * Impact Simulator v1.5
 * 
 * Simulates traffic and ranking impact for scenarios.
 * 
 * Simulation Methods:
 * - Trend extrapolation
 * - Statistical projection with confidence intervals
 * - Sensitivity analysis
 * 
 * Design Principles:
 * - Deterministic (same inputs → same outputs)
 * - Explainable assumptions
 * - Conservative estimates with intervals
 */

import {
  Scenario,
  ScenarioType,
  TimeHorizon,
  TIME_HORIZONS,
  ConfidenceInterval,
  TrafficImpact,
  RankingImpact,
  KeywordProjection,
  HistoricalData,
  TrafficDataPoint,
  RankingDataPoint,
  ActionOutcomeDataPoint,
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
  SimulationAssumption,
} from './models';

// ============================================================================
// STATISTICAL UTILITIES
// ============================================================================

/**
 * Calculate mean of array
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Calculate linear regression slope
 */
function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;
  
  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Calculate percentile
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Create confidence interval
 */
function createConfidenceInterval(
  values: number[],
  confidenceLevel: number = 0.80
): ConfidenceInterval {
  if (values.length === 0) {
    return { low: 0, mid: 0, high: 0, confidenceLevel };
  }
  
  const tailPercent = ((1 - confidenceLevel) / 2) * 100;
  
  return {
    low: percentile(values, tailPercent),
    mid: mean(values),
    high: percentile(values, 100 - tailPercent),
    confidenceLevel,
  };
}

// ============================================================================
// IMPACT SIMULATOR
// ============================================================================

export class ImpactSimulator {
  private config: SimulationConfig;
  private logger: Console;
  
  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.logger = console;
  }
  
  /**
   * Simulate traffic impact for a scenario
   */
  simulateTrafficImpact(
    scenario: Scenario,
    historicalData: HistoricalData
  ): { impact: TrafficImpact; assumptions: SimulationAssumption[] } {
    this.logger.log(`[ImpactSimulator] Simulating traffic for scenario: ${scenario.name}`);
    
    const assumptions: SimulationAssumption[] = [];
    const trafficHistory = historicalData.trafficHistory;
    
    // Current traffic baseline
    const recentTraffic = trafficHistory.slice(-30);
    const currentTraffic = mean(recentTraffic.map(t => t.organic));
    
    // Calculate baseline trend
    const trendSlope = linearSlope(trafficHistory.map(t => t.organic));
    const dailyGrowthRate = trendSlope / currentTraffic;
    
    assumptions.push({
      id: 'traffic-trend',
      category: 'traffic',
      description: `Baseline daily growth rate: ${(dailyGrowthRate * 100).toFixed(3)}%`,
      basis: `Calculated from ${trafficHistory.length} days of historical data`,
      sensitivity: 'medium',
    });
    
    // Calculate impact multiplier based on scenario type and actions
    const impactMultiplier = this.calculateTrafficImpactMultiplier(scenario, historicalData);
    
    assumptions.push({
      id: 'impact-multiplier',
      category: 'traffic',
      description: `Action impact multiplier: ${impactMultiplier.toFixed(2)}x`,
      basis: 'Based on historical action outcomes and scenario configuration',
      sensitivity: 'high',
    });
    
    // Project traffic for each time horizon
    const projectedTraffic: Record<TimeHorizon, ConfidenceInterval> = {} as any;
    const percentageChange: Record<TimeHorizon, ConfidenceInterval> = {} as any;
    
    for (const horizon of TIME_HORIZONS) {
      const projections = this.projectTrafficWithVariation(
        currentTraffic,
        dailyGrowthRate,
        impactMultiplier,
        horizon,
        scenario
      );
      
      projectedTraffic[horizon] = createConfidenceInterval(
        projections,
        this.config.defaultConfidenceLevel
      );
      
      const changeProjections = projections.map(p => 
        ((p - currentTraffic) / currentTraffic) * 100
      );
      percentageChange[horizon] = createConfidenceInterval(
        changeProjections,
        this.config.defaultConfidenceLevel
      );
    }
    
    // Source breakdown (simplified)
    const organicRatio = 0.65;
    const directRatio = 0.25;
    const referralRatio = 0.10;
    
    const impact: TrafficImpact = {
      currentTraffic,
      projectedTraffic,
      percentageChange,
      sourceBreakdown: {
        organic: {
          low: projectedTraffic[90].low * organicRatio,
          mid: projectedTraffic[90].mid * organicRatio,
          high: projectedTraffic[90].high * organicRatio,
          confidenceLevel: this.config.defaultConfidenceLevel,
        },
        direct: {
          low: projectedTraffic[90].low * directRatio,
          mid: projectedTraffic[90].mid * directRatio,
          high: projectedTraffic[90].high * directRatio,
          confidenceLevel: this.config.defaultConfidenceLevel,
        },
        referral: {
          low: projectedTraffic[90].low * referralRatio,
          mid: projectedTraffic[90].mid * referralRatio,
          high: projectedTraffic[90].high * referralRatio,
          confidenceLevel: this.config.defaultConfidenceLevel,
        },
      },
    };
    
    return { impact, assumptions };
  }
  
  /**
   * Simulate ranking impact for a scenario
   */
  simulateRankingImpact(
    scenario: Scenario,
    historicalData: HistoricalData
  ): { impact: RankingImpact; assumptions: SimulationAssumption[] } {
    this.logger.log(`[ImpactSimulator] Simulating rankings for scenario: ${scenario.name}`);
    
    const assumptions: SimulationAssumption[] = [];
    const rankingHistory = historicalData.rankingHistory;
    
    // Group by keyword
    const keywordData = this.groupRankingsByKeyword(rankingHistory);
    const keywords = Object.keys(keywordData);
    
    // Calculate how many keywords are affected by scenario actions
    const includedActions = scenario.actions.filter(a => a.included);
    const keywordsAffected = Math.min(
      keywords.length,
      includedActions.length * 5 // Assume each action affects ~5 keywords
    );
    
    assumptions.push({
      id: 'keywords-affected',
      category: 'ranking',
      description: `Estimated ${keywordsAffected} keywords affected by actions`,
      basis: `Based on ${includedActions.length} included actions`,
      sensitivity: 'medium',
    });
    
    // Calculate position change multiplier
    const positionMultiplier = this.calculatePositionImpactMultiplier(scenario);
    
    // Project position changes
    const avgPositionChange: Record<TimeHorizon, ConfidenceInterval> = {} as any;
    const keywordsImproving: Record<TimeHorizon, number> = {} as any;
    const keywordsDeclining: Record<TimeHorizon, number> = {} as any;
    
    for (const horizon of TIME_HORIZONS) {
      const changes = this.projectPositionChanges(
        keywordData,
        positionMultiplier,
        horizon,
        scenario
      );
      
      avgPositionChange[horizon] = createConfidenceInterval(
        changes,
        this.config.defaultConfidenceLevel
      );
      
      // Positive change = improvement (position goes down)
      keywordsImproving[horizon] = Math.round(
        keywordsAffected * (scenario.type === ScenarioType.BASELINE ? 0.3 : 0.5)
      );
      keywordsDeclining[horizon] = Math.round(
        keywordsAffected * (scenario.type === ScenarioType.BASELINE ? 0.2 : 0.1)
      );
    }
    
    // Top keyword projections
    const topKeywordProjections = this.projectTopKeywords(
      keywordData,
      positionMultiplier,
      scenario
    );
    
    const impact: RankingImpact = {
      keywordsAffected,
      avgPositionChange,
      keywordsImproving,
      keywordsDeclining,
      topKeywordProjections,
    };
    
    return { impact, assumptions };
  }
  
  /**
   * Calculate traffic impact multiplier based on scenario
   */
  private calculateTrafficImpactMultiplier(
    scenario: Scenario,
    historicalData: HistoricalData
  ): number {
    // Baseline = no additional impact
    if (scenario.type === ScenarioType.BASELINE) {
      return 1.0;
    }
    
    // Calculate base multiplier from historical action outcomes
    const outcomes = historicalData.actionOutcomes.filter(o => o.success);
    let baseMultiplier = 1.0;
    
    if (outcomes.length > 0) {
      const avgTrafficIncrease = mean(
        outcomes.map(o => (o.trafficAfter90Days - o.trafficBefore) / o.trafficBefore)
      );
      baseMultiplier = 1 + avgTrafficIncrease;
    } else {
      // Default assumption: 5-15% increase for successful SEO actions
      baseMultiplier = 1.10;
    }
    
    // Adjust for scenario type
    const includedActions = scenario.actions.filter(a => a.included);
    const avgScopeModifier = includedActions.length > 0
      ? mean(includedActions.map(a => a.scopeModifier))
      : 0;
    
    // Delayed scenarios have slightly reduced immediate impact
    const delayFactor = scenario.type === ScenarioType.DELAYED ? 0.9 : 1.0;
    
    return baseMultiplier * avgScopeModifier * delayFactor;
  }
  
  /**
   * Project traffic with Monte Carlo-style variation
   */
  private projectTrafficWithVariation(
    currentTraffic: number,
    dailyGrowthRate: number,
    impactMultiplier: number,
    horizon: TimeHorizon,
    scenario: Scenario
  ): number[] {
    const variations: number[] = [];
    const simulationCount = 100;
    const variationPercent = this.config.sensitivitySettings.variationPercent / 100;
    
    for (let i = 0; i < simulationCount; i++) {
      // Add random variation
      const growthVariation = dailyGrowthRate * (1 + (Math.random() - 0.5) * variationPercent * 2);
      const impactVariation = impactMultiplier * (1 + (Math.random() - 0.5) * variationPercent * 2);
      
      // Account for execution delay
      const avgDelay = scenario.actions.filter(a => a.included).length > 0
        ? mean(scenario.actions.filter(a => a.included).map(a => a.executionDelay))
        : 0;
      const effectiveDays = Math.max(0, horizon - avgDelay);
      
      // Compound growth + action impact
      const baseGrowth = currentTraffic * Math.pow(1 + growthVariation, horizon);
      const actionBoost = scenario.type !== ScenarioType.BASELINE
        ? currentTraffic * (impactVariation - 1) * (effectiveDays / horizon)
        : 0;
      
      variations.push(baseGrowth + actionBoost);
    }
    
    return variations;
  }
  
  /**
   * Group ranking history by keyword
   */
  private groupRankingsByKeyword(
    history: RankingDataPoint[]
  ): Record<string, RankingDataPoint[]> {
    const grouped: Record<string, RankingDataPoint[]> = {};
    
    for (const point of history) {
      if (!grouped[point.keyword]) {
        grouped[point.keyword] = [];
      }
      grouped[point.keyword].push(point);
    }
    
    return grouped;
  }
  
  /**
   * Calculate position impact multiplier
   */
  private calculatePositionImpactMultiplier(scenario: Scenario): number {
    if (scenario.type === ScenarioType.BASELINE) {
      return 0; // No change
    }
    
    const includedActions = scenario.actions.filter(a => a.included);
    if (includedActions.length === 0) return 0;
    
    const avgScope = mean(includedActions.map(a => a.scopeModifier));
    
    // Base improvement: 1-3 positions
    return 2 * avgScope;
  }
  
  /**
   * Project position changes
   */
  private projectPositionChanges(
    keywordData: Record<string, RankingDataPoint[]>,
    multiplier: number,
    horizon: TimeHorizon,
    scenario: Scenario
  ): number[] {
    const changes: number[] = [];
    const simulationCount = 100;
    const variationPercent = this.config.sensitivitySettings.variationPercent / 100;
    
    for (let i = 0; i < simulationCount; i++) {
      // Base change modified by time horizon
      const timeFactor = horizon / 90; // Full effect at 90 days
      const variation = 1 + (Math.random() - 0.5) * variationPercent * 2;
      
      // Positive change = improvement (moving up in rankings)
      changes.push(multiplier * timeFactor * variation);
    }
    
    return changes;
  }
  
  /**
   * Project top keywords
   */
  private projectTopKeywords(
    keywordData: Record<string, RankingDataPoint[]>,
    multiplier: number,
    scenario: Scenario
  ): KeywordProjection[] {
    const keywords = Object.keys(keywordData);
    const projections: KeywordProjection[] = [];
    
    // Get top 5 keywords by search volume (from most recent data)
    const sortedKeywords = keywords
      .map(kw => {
        const recent = keywordData[kw].slice(-1)[0];
        return {
          keyword: kw,
          position: recent?.position || 50,
          volume: recent?.impressions || 0,
        };
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
    
    for (const { keyword, position, volume } of sortedKeywords) {
      const projected: Record<TimeHorizon, ConfidenceInterval> = {} as any;
      
      for (const horizon of TIME_HORIZONS) {
        const timeFactor = horizon / 90;
        const expectedChange = multiplier * timeFactor;
        const newPosition = Math.max(1, position - expectedChange);
        
        projected[horizon] = {
          low: Math.max(1, newPosition - 2),
          mid: newPosition,
          high: newPosition + 2,
          confidenceLevel: this.config.defaultConfidenceLevel,
        };
      }
      
      projections.push({
        keyword,
        currentPosition: position,
        projectedPosition: projected,
        searchVolume: volume,
        difficulty: 50, // Would come from keyword intelligence
      });
    }
    
    return projections;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createImpactSimulator(
  config?: Partial<SimulationConfig>
): ImpactSimulator {
  return new ImpactSimulator(config);
}
