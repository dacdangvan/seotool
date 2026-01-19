/**
 * Value Estimator v1.6
 * 
 * Estimates expected value for SEO actions across multiple dimensions.
 * 
 * Value Dimensions:
 * - Traffic: Organic traffic uplift
 * - Ranking: Keyword position improvement
 * - Risk Reduction: Decreased risk exposure
 * - Brand: Brand consistency improvement
 * 
 * Data Sources:
 * - Scenario Simulation (v1.5) for projections
 * - Monitoring & Forecast (v0.6) for trends
 * - Historical action outcomes
 * 
 * Design Principles:
 * - Conservative estimates by default
 * - Transparent assumptions
 * - Time-weighted value (sooner = more valuable)
 */

import {
  ValueCategory,
  TrafficValue,
  RankingValue,
  RiskReductionValue,
  BrandValue,
  ActionValueBreakdown,
  ValueAssumption,
  CostOptimizationConfig,
  DEFAULT_COST_OPTIMIZATION_CONFIG,
} from './models';

// ============================================================================
// VALUE PROFILES PER ACTION TYPE
// ============================================================================

interface ActionValueProfile {
  // Traffic impact
  trafficUpliftPercent: { low: number; mid: number; high: number };
  timeToRealize: number;        // Days until value realized
  sustainabilityMonths: number; // How long the value lasts
  
  // Ranking impact
  avgPositionImprovement: number;
  keywordsAffected: number;
  
  // Risk reduction
  riskReductionPercent: number;
  issuesResolved: number;
  
  // Brand impact
  brandScoreIncrease: number;
  consistencyImprovement: number;
}

const ACTION_VALUE_PROFILES: Record<string, ActionValueProfile> = {
  'create_content': {
    trafficUpliftPercent: { low: 5, mid: 15, high: 30 },
    timeToRealize: 60,
    sustainabilityMonths: 24,
    avgPositionImprovement: 0,  // New content starts from scratch
    keywordsAffected: 5,
    riskReductionPercent: 0,
    issuesResolved: 0,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'update_content': {
    trafficUpliftPercent: { low: 3, mid: 10, high: 20 },
    timeToRealize: 30,
    sustainabilityMonths: 12,
    avgPositionImprovement: 2,
    keywordsAffected: 3,
    riskReductionPercent: 5,
    issuesResolved: 0,
    brandScoreIncrease: 2,
    consistencyImprovement: 5,
  },
  'optimize_content': {
    trafficUpliftPercent: { low: 5, mid: 12, high: 25 },
    timeToRealize: 30,
    sustainabilityMonths: 12,
    avgPositionImprovement: 3,
    keywordsAffected: 2,
    riskReductionPercent: 0,
    issuesResolved: 0,
    brandScoreIncrease: 3,
    consistencyImprovement: 5,
  },
  'fix_technical_issue': {
    trafficUpliftPercent: { low: 2, mid: 8, high: 15 },
    timeToRealize: 14,
    sustainabilityMonths: 36,
    avgPositionImprovement: 1,
    keywordsAffected: 10,
    riskReductionPercent: 30,
    issuesResolved: 5,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'improve_page_speed': {
    trafficUpliftPercent: { low: 3, mid: 10, high: 18 },
    timeToRealize: 21,
    sustainabilityMonths: 24,
    avgPositionImprovement: 2,
    keywordsAffected: 20,
    riskReductionPercent: 20,
    issuesResolved: 1,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'fix_schema_markup': {
    trafficUpliftPercent: { low: 1, mid: 5, high: 12 },
    timeToRealize: 14,
    sustainabilityMonths: 24,
    avgPositionImprovement: 0,
    keywordsAffected: 5,
    riskReductionPercent: 15,
    issuesResolved: 3,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'add_internal_link': {
    trafficUpliftPercent: { low: 1, mid: 3, high: 8 },
    timeToRealize: 21,
    sustainabilityMonths: 18,
    avgPositionImprovement: 1,
    keywordsAffected: 2,
    riskReductionPercent: 0,
    issuesResolved: 0,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'optimize_anchor_text': {
    trafficUpliftPercent: { low: 1, mid: 4, high: 10 },
    timeToRealize: 30,
    sustainabilityMonths: 12,
    avgPositionImprovement: 2,
    keywordsAffected: 1,
    riskReductionPercent: -5,  // Could increase risk
    issuesResolved: 0,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'target_new_keyword': {
    trafficUpliftPercent: { low: 2, mid: 8, high: 20 },
    timeToRealize: 45,
    sustainabilityMonths: 18,
    avgPositionImprovement: 0,
    keywordsAffected: 1,
    riskReductionPercent: 0,
    issuesResolved: 0,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'improve_keyword_ranking': {
    trafficUpliftPercent: { low: 5, mid: 15, high: 30 },
    timeToRealize: 45,
    sustainabilityMonths: 12,
    avgPositionImprovement: 5,
    keywordsAffected: 1,
    riskReductionPercent: 0,
    issuesResolved: 0,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'competitor_analysis': {
    trafficUpliftPercent: { low: 0, mid: 0, high: 0 },
    timeToRealize: 0,
    sustainabilityMonths: 6,
    avgPositionImprovement: 0,
    keywordsAffected: 0,
    riskReductionPercent: 10,
    issuesResolved: 0,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'set_up_alert': {
    trafficUpliftPercent: { low: 0, mid: 0, high: 0 },
    timeToRealize: 0,
    sustainabilityMonths: 12,
    avgPositionImprovement: 0,
    keywordsAffected: 0,
    riskReductionPercent: 15,
    issuesResolved: 0,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
  'investigate_anomaly': {
    trafficUpliftPercent: { low: 0, mid: 5, high: 15 },
    timeToRealize: 7,
    sustainabilityMonths: 12,
    avgPositionImprovement: 0,
    keywordsAffected: 0,
    riskReductionPercent: 25,
    issuesResolved: 1,
    brandScoreIncrease: 0,
    consistencyImprovement: 0,
  },
};

const DEFAULT_VALUE_PROFILE: ActionValueProfile = {
  trafficUpliftPercent: { low: 1, mid: 5, high: 10 },
  timeToRealize: 30,
  sustainabilityMonths: 12,
  avgPositionImprovement: 1,
  keywordsAffected: 1,
  riskReductionPercent: 5,
  issuesResolved: 0,
  brandScoreIncrease: 1,
  consistencyImprovement: 2,
};

// ============================================================================
// SIMULATION DATA ADAPTER
// ============================================================================

/**
 * Simulation data from v1.5 Scenario Simulation
 */
export interface SimulationDataInput {
  trafficImpact?: {
    percentageChange: { [horizon: number]: { low: number; mid: number; high: number } };
    projectedTraffic: { [horizon: number]: { mid: number } };
  };
  rankingImpact?: {
    avgPositionChange: { [horizon: number]: { mid: number } };
    keywordsAffected: number;
  };
  riskImpact?: {
    overallRiskScore: number;
    categoryRisks: Array<{ score: number }>;
  };
  brandImpact?: {
    complianceScore: number;
    driftRisk: number;
  };
}

// ============================================================================
// VALUE ESTIMATOR
// ============================================================================

export interface SEOActionForValue {
  id: string;
  type: string;
  title: string;
  targetKeyword?: string;
  targetUrl?: string;
  expectedImpact?: {
    metric: string;
    estimatedChange: number;
    confidence: 'low' | 'medium' | 'high';
    timeToResult: string;
  };
}

export interface CurrentStateInput {
  monthlyTraffic: number;
  avgPosition: number;
  currentRiskScore: number;
  currentBrandScore: number;
  topKeywords?: Array<{
    keyword: string;
    position: number;
    searchVolume: number;
  }>;
}

export class ValueEstimator {
  private config: CostOptimizationConfig;
  private logger: Console;
  
  constructor(config: CostOptimizationConfig = DEFAULT_COST_OPTIMIZATION_CONFIG) {
    this.config = config;
    this.logger = console;
  }
  
  /**
   * Estimate complete value breakdown for an action
   */
  estimateActionValue(
    action: SEOActionForValue,
    currentState: CurrentStateInput,
    simulationData?: SimulationDataInput
  ): ActionValueBreakdown {
    const profile = ACTION_VALUE_PROFILES[action.type] || DEFAULT_VALUE_PROFILE;
    const assumptions: ValueAssumption[] = [];
    
    // Use simulation data if available, otherwise use profiles
    const useSimulation = simulationData && this.hasValidSimulationData(simulationData);
    const dataSourceQuality = useSimulation ? 'high' : 'medium';
    
    assumptions.push({
      id: `value-source-${action.id}`,
      category: ValueCategory.TRAFFIC,
      description: useSimulation 
        ? 'Value estimates derived from Scenario Simulation v1.5'
        : 'Value estimates based on action type profiles',
      value: dataSourceQuality === 'high' ? 1 : 0.7,
      basis: useSimulation ? 'Simulation data available' : 'Using default profiles',
      confidence: dataSourceQuality === 'high' ? 'high' : 'medium',
    });
    
    // Estimate traffic value
    const trafficValue = this.estimateTrafficValue(
      action, currentState, profile, simulationData, assumptions
    );
    
    // Estimate ranking value
    const rankingValue = this.estimateRankingValue(
      action, currentState, profile, simulationData, assumptions
    );
    
    // Estimate risk reduction value
    const riskReductionValue = this.estimateRiskReductionValue(
      action, currentState, profile, simulationData, assumptions
    );
    
    // Estimate brand value
    const brandValue = this.estimateBrandValue(
      action, currentState, profile, simulationData, assumptions
    );
    
    // Calculate value per category
    const valuePerCategory = this.calculateValuePerCategory(
      trafficValue, rankingValue, riskReductionValue, brandValue
    );
    
    // Calculate total normalized value
    const totalValue = this.calculateTotalValue(valuePerCategory);
    
    return {
      actionId: action.id,
      actionType: action.type,
      trafficValue,
      rankingValue,
      riskReductionValue,
      brandValue,
      totalValue,
      valuePerCategory,
      assumptions,
      estimatedAt: new Date().toISOString(),
      dataSourceQuality,
    };
  }
  
  /**
   * Check if simulation data is valid and usable
   */
  private hasValidSimulationData(data: SimulationDataInput): boolean {
    return !!(
      data.trafficImpact?.percentageChange?.[90] ||
      data.rankingImpact?.avgPositionChange?.[90] ||
      data.riskImpact?.overallRiskScore !== undefined
    );
  }
  
  /**
   * Estimate traffic value
   */
  private estimateTrafficValue(
    action: SEOActionForValue,
    currentState: CurrentStateInput,
    profile: ActionValueProfile,
    simulationData: SimulationDataInput | undefined,
    assumptions: ValueAssumption[]
  ): TrafficValue {
    let upliftPercent = profile.trafficUpliftPercent;
    let timeToRealize = profile.timeToRealize;
    
    // Override with simulation data if available
    if (simulationData?.trafficImpact?.percentageChange?.[90]) {
      const simChange = simulationData.trafficImpact.percentageChange[90];
      upliftPercent = {
        low: simChange.low,
        mid: simChange.mid,
        high: simChange.high,
      };
      
      assumptions.push({
        id: `traffic-sim-${action.id}`,
        category: ValueCategory.TRAFFIC,
        description: `Traffic uplift from simulation: ${simChange.mid.toFixed(1)}%`,
        value: simChange.mid,
        basis: 'Scenario Simulation v1.5 projection',
        confidence: 'high',
      });
    } else {
      assumptions.push({
        id: `traffic-profile-${action.id}`,
        category: ValueCategory.TRAFFIC,
        description: `Traffic uplift from profile: ${upliftPercent.mid}%`,
        value: upliftPercent.mid,
        basis: `Default for ${action.type}`,
        confidence: 'medium',
      });
    }
    
    // Override with action-specific expected impact
    if (action.expectedImpact?.metric === 'organic_traffic') {
      upliftPercent.mid = action.expectedImpact.estimatedChange;
      assumptions.push({
        id: `traffic-action-${action.id}`,
        category: ValueCategory.TRAFFIC,
        description: `Action-specific traffic estimate: ${action.expectedImpact.estimatedChange}%`,
        value: action.expectedImpact.estimatedChange,
        basis: 'Action definition',
        confidence: action.expectedImpact.confidence,
      });
    }
    
    const expectedVisitors = Math.round(currentState.monthlyTraffic * (upliftPercent.mid / 100));
    
    return {
      expectedVisitors,
      trafficUpliftPercent: upliftPercent.mid,
      confidenceInterval: upliftPercent,
      timeToRealize,
      sustainabilityMonths: profile.sustainabilityMonths,
    };
  }
  
  /**
   * Estimate ranking value
   */
  private estimateRankingValue(
    action: SEOActionForValue,
    currentState: CurrentStateInput,
    profile: ActionValueProfile,
    simulationData: SimulationDataInput | undefined,
    assumptions: ValueAssumption[]
  ): RankingValue {
    let avgPositionImprovement = profile.avgPositionImprovement;
    let keywordsAffected = profile.keywordsAffected;
    
    // Override with simulation data
    if (simulationData?.rankingImpact) {
      avgPositionImprovement = simulationData.rankingImpact.avgPositionChange[90]?.mid || avgPositionImprovement;
      keywordsAffected = simulationData.rankingImpact.keywordsAffected || keywordsAffected;
      
      assumptions.push({
        id: `ranking-sim-${action.id}`,
        category: ValueCategory.RANKING,
        description: `Position improvement from simulation: ${avgPositionImprovement.toFixed(1)} positions`,
        value: avgPositionImprovement,
        basis: 'Scenario Simulation v1.5 projection',
        confidence: 'high',
      });
    }
    
    // Build top keyword improvements
    const topKeywordImprovements: RankingValue['topKeywordImprovements'] = [];
    
    if (currentState.topKeywords && action.targetKeyword) {
      const targetKw = currentState.topKeywords.find(
        k => k.keyword.toLowerCase().includes(action.targetKeyword!.toLowerCase())
      );
      
      if (targetKw) {
        topKeywordImprovements.push({
          keyword: targetKw.keyword,
          currentPosition: targetKw.position,
          expectedPosition: Math.max(1, targetKw.position - avgPositionImprovement),
          searchVolume: targetKw.searchVolume,
        });
      }
    }
    
    // Estimate click increase based on position improvement
    // CTR curve: position 1 ~30%, position 2 ~15%, position 3 ~10%, etc.
    const currentCTR = this.estimateCTR(currentState.avgPosition);
    const newPosition = Math.max(1, currentState.avgPosition - avgPositionImprovement);
    const newCTR = this.estimateCTR(newPosition);
    const estimatedClickIncrease = ((newCTR - currentCTR) / currentCTR) * 100;
    
    assumptions.push({
      id: `ranking-ctr-${action.id}`,
      category: ValueCategory.RANKING,
      description: `Estimated click increase: ${estimatedClickIncrease.toFixed(1)}% (position ${currentState.avgPosition.toFixed(1)} → ${newPosition.toFixed(1)})`,
      value: estimatedClickIncrease,
      basis: 'CTR curve model',
      confidence: 'medium',
    });
    
    return {
      keywordsAffected,
      avgPositionImprovement,
      topKeywordImprovements,
      estimatedClickIncrease: Math.max(0, estimatedClickIncrease),
    };
  }
  
  /**
   * Estimate CTR based on position
   */
  private estimateCTR(position: number): number {
    // Simplified CTR curve
    if (position <= 1) return 0.30;
    if (position <= 2) return 0.15;
    if (position <= 3) return 0.10;
    if (position <= 4) return 0.07;
    if (position <= 5) return 0.05;
    if (position <= 10) return 0.02;
    return 0.01;
  }
  
  /**
   * Estimate risk reduction value
   */
  private estimateRiskReductionValue(
    action: SEOActionForValue,
    currentState: CurrentStateInput,
    profile: ActionValueProfile,
    simulationData: SimulationDataInput | undefined,
    assumptions: ValueAssumption[]
  ): RiskReductionValue {
    let riskReductionPercent = profile.riskReductionPercent;
    
    // Override with simulation data
    if (simulationData?.riskImpact) {
      // Calculate risk reduction from simulation
      const currentRisk = currentState.currentRiskScore;
      const projectedRisk = simulationData.riskImpact.overallRiskScore;
      riskReductionPercent = ((currentRisk - projectedRisk) / currentRisk) * 100;
      
      assumptions.push({
        id: `risk-sim-${action.id}`,
        category: ValueCategory.RISK_REDUCTION,
        description: `Risk reduction from simulation: ${riskReductionPercent.toFixed(1)}%`,
        value: riskReductionPercent,
        basis: 'Scenario Simulation v1.5 risk analysis',
        confidence: 'high',
      });
    } else {
      assumptions.push({
        id: `risk-profile-${action.id}`,
        category: ValueCategory.RISK_REDUCTION,
        description: `Risk reduction from profile: ${riskReductionPercent}%`,
        value: riskReductionPercent,
        basis: `Default for ${action.type}`,
        confidence: 'medium',
      });
    }
    
    const projectedRiskScore = Math.max(0, currentState.currentRiskScore * (1 - riskReductionPercent / 100));
    const absoluteReduction = currentState.currentRiskScore - projectedRiskScore;
    
    // Check for penalty prevention
    const penaltyPrevention = action.type === 'fix_technical_issue' || 
                              action.type === 'investigate_anomaly' ||
                              (riskReductionPercent > 20 && currentState.currentRiskScore > 0.5);
    
    return {
      currentRiskScore: currentState.currentRiskScore,
      projectedRiskScore,
      riskReduction: absoluteReduction,
      riskReductionPercent: Math.max(0, riskReductionPercent),
      issuesResolved: profile.issuesResolved,
      penaltyPrevention,
    };
  }
  
  /**
   * Estimate brand value
   */
  private estimateBrandValue(
    action: SEOActionForValue,
    currentState: CurrentStateInput,
    profile: ActionValueProfile,
    simulationData: SimulationDataInput | undefined,
    assumptions: ValueAssumption[]
  ): BrandValue {
    let consistencyImprovement = profile.consistencyImprovement;
    let brandScoreIncrease = profile.brandScoreIncrease;
    
    // Override with simulation data
    if (simulationData?.brandImpact) {
      const simBrand = simulationData.brandImpact;
      
      // Higher compliance = more improvement
      if (simBrand.complianceScore > currentState.currentBrandScore) {
        brandScoreIncrease = (simBrand.complianceScore - currentState.currentBrandScore) / 10;
        consistencyImprovement = (1 - simBrand.driftRisk) * 10;
      }
      
      assumptions.push({
        id: `brand-sim-${action.id}`,
        category: ValueCategory.BRAND,
        description: `Brand impact from simulation: compliance ${simBrand.complianceScore.toFixed(0)}%, drift risk ${(simBrand.driftRisk * 100).toFixed(0)}%`,
        value: brandScoreIncrease,
        basis: 'Scenario Simulation v1.5 brand analysis',
        confidence: 'high',
      });
    }
    
    // Content actions typically have brand impact
    const isContentAction = ['create_content', 'update_content', 'optimize_content'].includes(action.type);
    const violationsResolved = isContentAction ? 1 : 0;
    
    // Reputation protection: higher for technical fixes and risk-reducing actions
    const reputationProtection = profile.riskReductionPercent > 0 ? 0.5 : 0.1;
    
    return {
      consistencyImprovement,
      violationsResolved,
      brandScoreIncrease,
      reputationProtection,
    };
  }
  
  /**
   * Calculate value per category
   */
  private calculateValuePerCategory(
    trafficValue: TrafficValue,
    rankingValue: RankingValue,
    riskReductionValue: RiskReductionValue,
    brandValue: BrandValue
  ): Record<ValueCategory, number> {
    const params = this.config.valueParams;
    
    // Traffic value: visitors × value per visitor × sustainability factor
    const trafficScore = trafficValue.expectedVisitors * params.trafficValuePerVisitor * 
                         (trafficValue.sustainabilityMonths / 12);
    
    // Ranking value: position improvement × keywords × multiplier
    const rankingScore = rankingValue.avgPositionImprovement * 
                         rankingValue.keywordsAffected * 
                         params.positionValueMultiplier;
    
    // Risk reduction value: reduction × base value
    const riskReductionScore = riskReductionValue.riskReductionPercent * 
                               params.riskReductionValue / 100 +
                               (riskReductionValue.penaltyPrevention ? 20 : 0);
    
    // Brand value: consistency improvement + score increase
    const brandScore = brandValue.consistencyImprovement * params.brandConsistencyValue +
                       brandValue.brandScoreIncrease * 5;
    
    return {
      [ValueCategory.TRAFFIC]: Math.max(0, trafficScore),
      [ValueCategory.RANKING]: Math.max(0, rankingScore),
      [ValueCategory.RISK_REDUCTION]: Math.max(0, riskReductionScore),
      [ValueCategory.BRAND]: Math.max(0, brandScore),
      [ValueCategory.TECHNICAL]: 0, // Included in risk reduction
    };
  }
  
  /**
   * Calculate total normalized value (0-100 scale)
   */
  private calculateTotalValue(valuePerCategory: Record<ValueCategory, number>): number {
    const rawTotal = Object.values(valuePerCategory).reduce((sum, v) => sum + v, 0);
    // Normalize to 0-100 scale (assuming max raw value ~200)
    return Math.min(100, (rawTotal / 2));
  }
  
  /**
   * Estimate values for multiple actions
   */
  estimateMultipleActions(
    actions: SEOActionForValue[],
    currentState: CurrentStateInput,
    simulationDataMap?: Map<string, SimulationDataInput>
  ): Map<string, ActionValueBreakdown> {
    const results = new Map<string, ActionValueBreakdown>();
    
    for (const action of actions) {
      const simulationData = simulationDataMap?.get(action.id);
      results.set(action.id, this.estimateActionValue(action, currentState, simulationData));
    }
    
    return results;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createValueEstimator(
  config?: Partial<CostOptimizationConfig>
): ValueEstimator {
  const fullConfig = { ...DEFAULT_COST_OPTIMIZATION_CONFIG, ...config };
  return new ValueEstimator(fullConfig);
}
