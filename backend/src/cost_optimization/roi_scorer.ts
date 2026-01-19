/**
 * ROI Scorer v1.6
 * 
 * Calculates ROI scores for SEO actions.
 * 
 * ROI Formula:
 *   ROI = Expected_Value / Total_Cost
 * 
 * Supports weighted ROI based on strategy:
 * - BALANCED: Equal weight to all factors
 * - TRAFFIC_FOCUSED: Prioritize traffic gains
 * - RISK_AVERSE: Minimize risk, accept lower returns
 * - BRAND_FIRST: Prioritize brand consistency
 * - QUICK_WINS: Low effort, fast results
 * - HIGH_IMPACT: Maximum value regardless of cost
 * 
 * Design Principles:
 * - Never recommend without ROI justification
 * - Transparent scoring breakdown
 * - Strategy-aware weighting
 */

import {
  ActionCostBreakdown,
  ActionValueBreakdown,
  ActionROIScore,
  ROIStrategy,
  ROIWeights,
  STRATEGY_WEIGHTS,
  ValueCategory,
  CostCategory,
} from './models';

// ============================================================================
// ROI TIER THRESHOLDS
// ============================================================================

const ROI_TIER_THRESHOLDS = {
  excellent: 2.0,  // ROI >= 2.0
  good: 1.2,       // ROI >= 1.2
  moderate: 0.8,   // ROI >= 0.8
  poor: 0,         // ROI < 0.8
};

// ============================================================================
// ROI SCORER
// ============================================================================

export class ROIScorer {
  private strategy: ROIStrategy;
  private weights: ROIWeights;
  private logger: Console;
  
  constructor(strategy: ROIStrategy = ROIStrategy.BALANCED) {
    this.strategy = strategy;
    this.weights = STRATEGY_WEIGHTS[strategy];
    this.logger = console;
  }
  
  /**
   * Set ROI strategy
   */
  setStrategy(strategy: ROIStrategy): void {
    this.strategy = strategy;
    this.weights = STRATEGY_WEIGHTS[strategy];
    this.logger.log(`[ROIScorer] Strategy set to: ${strategy}`);
  }
  
  /**
   * Set custom weights
   */
  setCustomWeights(weights: Partial<ROIWeights>): void {
    this.weights = { ...this.weights, ...weights };
    this.normalizeWeights();
    this.strategy = ROIStrategy.BALANCED; // Custom weights = balanced base
  }
  
  /**
   * Normalize weights to sum to 1.0
   */
  private normalizeWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (sum !== 1.0 && sum > 0) {
      for (const key of Object.keys(this.weights) as Array<keyof ROIWeights>) {
        this.weights[key] /= sum;
      }
    }
  }
  
  /**
   * Calculate ROI score for a single action
   */
  calculateROI(
    costBreakdown: ActionCostBreakdown,
    valueBreakdown: ActionValueBreakdown
  ): ActionROIScore {
    // Calculate raw ROI
    const totalCost = Math.max(0.1, costBreakdown.totalCost); // Avoid division by zero
    const totalValue = valueBreakdown.totalValue;
    const rawROI = totalValue / totalCost;
    
    // Calculate weighted value based on strategy
    const weightedValue = this.calculateWeightedValue(valueBreakdown);
    
    // Calculate cost penalty based on cost sensitivity
    const costPenalty = this.calculateCostPenalty(costBreakdown);
    
    // Calculate weighted ROI
    const weightedROI = (weightedValue - costPenalty) / totalCost;
    
    // Normalize to 0-100 scale
    const normalizedROI = this.normalizeROI(rawROI);
    
    // Calculate efficiency
    const efficiency = totalValue > 0 && totalCost > 0 ? totalValue / totalCost : 0;
    
    // Determine tier
    const tier = this.determineTier(rawROI);
    
    // Build reasoning
    const reasoning = this.buildReasoning(
      costBreakdown, valueBreakdown, rawROI, weightedROI, tier
    );
    
    // Calculate breakdown contributions
    const breakdown = this.calculateContributionBreakdown(valueBreakdown);
    
    return {
      actionId: costBreakdown.actionId,
      actionType: costBreakdown.actionType,
      rawROI,
      normalizedROI,
      weightedROI,
      valueScore: totalValue,
      costScore: totalCost,
      efficiency,
      rank: 0, // Will be set when ranking multiple actions
      tier,
      reasoning,
      strategy: this.strategy,
      breakdown,
    };
  }
  
  /**
   * Calculate weighted value based on strategy
   */
  private calculateWeightedValue(value: ActionValueBreakdown): number {
    const trafficValue = value.valuePerCategory[ValueCategory.TRAFFIC] || 0;
    const rankingValue = value.valuePerCategory[ValueCategory.RANKING] || 0;
    const riskReductionValue = value.valuePerCategory[ValueCategory.RISK_REDUCTION] || 0;
    const brandValue = value.valuePerCategory[ValueCategory.BRAND] || 0;
    
    return (
      trafficValue * this.weights.traffic +
      rankingValue * this.weights.ranking +
      riskReductionValue * this.weights.riskReduction +
      brandValue * this.weights.brand
    ) * 4; // Scale factor to match total value range
  }
  
  /**
   * Calculate cost penalty based on cost sensitivity
   */
  private calculateCostPenalty(cost: ActionCostBreakdown): number {
    // Higher cost sensitivity = larger penalty for high costs
    const costSensitivity = this.weights.costSensitivity;
    
    // Penalize high effort and high risk more
    const effortPenalty = cost.effortCost.totalHours * 0.5 * costSensitivity;
    const riskPenalty = cost.riskCost.expectedLoss * costSensitivity;
    
    return effortPenalty + riskPenalty;
  }
  
  /**
   * Normalize ROI to 0-100 scale
   */
  private normalizeROI(rawROI: number): number {
    // Sigmoid-like normalization
    // ROI of 1.0 maps to ~50, ROI of 2.0 maps to ~75, ROI of 4.0 maps to ~90
    const normalized = 100 * (1 - Math.exp(-rawROI / 2));
    return Math.max(0, Math.min(100, normalized));
  }
  
  /**
   * Determine ROI tier
   */
  private determineTier(rawROI: number): ActionROIScore['tier'] {
    if (rawROI >= ROI_TIER_THRESHOLDS.excellent) return 'excellent';
    if (rawROI >= ROI_TIER_THRESHOLDS.good) return 'good';
    if (rawROI >= ROI_TIER_THRESHOLDS.moderate) return 'moderate';
    return 'poor';
  }
  
  /**
   * Build reasoning for the ROI score
   */
  private buildReasoning(
    cost: ActionCostBreakdown,
    value: ActionValueBreakdown,
    rawROI: number,
    weightedROI: number,
    tier: ActionROIScore['tier']
  ): string[] {
    const reasoning: string[] = [];
    
    // Overall ROI reason
    reasoning.push(
      `ROI: ${rawROI.toFixed(2)} (${tier}) - Value ${value.totalValue.toFixed(1)} / Cost ${cost.totalCost.toFixed(1)}`
    );
    
    // Strategy impact
    if (weightedROI !== rawROI) {
      const strategyImpact = ((weightedROI - rawROI) / rawROI) * 100;
      const direction = strategyImpact > 0 ? 'boosted' : 'reduced';
      reasoning.push(
        `${this.strategy} strategy ${direction} weighted ROI by ${Math.abs(strategyImpact).toFixed(0)}%`
      );
    }
    
    // Value highlights
    const valueBreakdown = Object.entries(value.valuePerCategory)
      .filter(([_, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    
    if (valueBreakdown.length > 0) {
      const topValue = valueBreakdown[0];
      reasoning.push(`Primary value from ${topValue[0]}: ${topValue[1].toFixed(1)} units`);
    }
    
    // Cost highlights
    const costBreakdown = Object.entries(cost.costPerCategory)
      .filter(([_, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    
    if (costBreakdown.length > 0) {
      const topCost = costBreakdown[0];
      reasoning.push(`Primary cost from ${topCost[0]}: ${topCost[1].toFixed(1)} units`);
    }
    
    // Effort warning
    if (cost.effortCost.totalHours > 10) {
      reasoning.push(`High effort: ${cost.effortCost.totalHours.toFixed(1)} hours required`);
    }
    
    // Risk warning
    if (cost.riskCost.riskProbability > 0.3) {
      reasoning.push(`Risk warning: ${(cost.riskCost.riskProbability * 100).toFixed(0)}% probability of negative outcome`);
    }
    
    // Quick win indicator
    if (cost.effortCost.totalHours < 3 && rawROI > 1.5) {
      reasoning.push('Quick win: Low effort with good returns');
    }
    
    return reasoning;
  }
  
  /**
   * Calculate contribution breakdown by value category
   */
  private calculateContributionBreakdown(value: ActionValueBreakdown): ActionROIScore['breakdown'] {
    const total = Object.values(value.valuePerCategory).reduce((sum, v) => sum + v, 0) || 1;
    
    return {
      trafficContribution: (value.valuePerCategory[ValueCategory.TRAFFIC] || 0) / total,
      rankingContribution: (value.valuePerCategory[ValueCategory.RANKING] || 0) / total,
      riskReductionContribution: (value.valuePerCategory[ValueCategory.RISK_REDUCTION] || 0) / total,
      brandContribution: (value.valuePerCategory[ValueCategory.BRAND] || 0) / total,
    };
  }
  
  /**
   * Calculate and rank ROI for multiple actions
   */
  calculateMultipleROI(
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>
  ): ActionROIScore[] {
    const scores: ActionROIScore[] = [];
    
    for (const [actionId, costBreakdown] of costs) {
      const valueBreakdown = values.get(actionId);
      if (!valueBreakdown) {
        this.logger.warn(`[ROIScorer] No value breakdown for action ${actionId}`);
        continue;
      }
      
      scores.push(this.calculateROI(costBreakdown, valueBreakdown));
    }
    
    // Sort by weighted ROI (descending) and assign ranks
    scores.sort((a, b) => b.weightedROI - a.weightedROI);
    scores.forEach((score, index) => {
      score.rank = index + 1;
    });
    
    return scores;
  }
  
  /**
   * Get ROI statistics for a set of scores
   */
  getROIStatistics(scores: ActionROIScore[]): {
    avgROI: number;
    medianROI: number;
    tierDistribution: Record<ActionROIScore['tier'], number>;
    topPerformer: ActionROIScore | null;
    bottomPerformer: ActionROIScore | null;
  } {
    if (scores.length === 0) {
      return {
        avgROI: 0,
        medianROI: 0,
        tierDistribution: { excellent: 0, good: 0, moderate: 0, poor: 0 },
        topPerformer: null,
        bottomPerformer: null,
      };
    }
    
    const sortedROIs = [...scores].sort((a, b) => a.rawROI - b.rawROI);
    const avgROI = scores.reduce((sum, s) => sum + s.rawROI, 0) / scores.length;
    const medianROI = sortedROIs[Math.floor(sortedROIs.length / 2)].rawROI;
    
    const tierDistribution = {
      excellent: scores.filter(s => s.tier === 'excellent').length,
      good: scores.filter(s => s.tier === 'good').length,
      moderate: scores.filter(s => s.tier === 'moderate').length,
      poor: scores.filter(s => s.tier === 'poor').length,
    };
    
    return {
      avgROI,
      medianROI,
      tierDistribution,
      topPerformer: sortedROIs[sortedROIs.length - 1],
      bottomPerformer: sortedROIs[0],
    };
  }
  
  /**
   * Filter actions by minimum ROI threshold
   */
  filterByMinROI(scores: ActionROIScore[], minROI: number): ActionROIScore[] {
    return scores.filter(s => s.rawROI >= minROI);
  }
  
  /**
   * Get actions by tier
   */
  getActionsByTier(
    scores: ActionROIScore[],
    tier: ActionROIScore['tier']
  ): ActionROIScore[] {
    return scores.filter(s => s.tier === tier);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createROIScorer(strategy?: ROIStrategy): ROIScorer {
  return new ROIScorer(strategy);
}

export function createTrafficFocusedScorer(): ROIScorer {
  return new ROIScorer(ROIStrategy.TRAFFIC_FOCUSED);
}

export function createRiskAverseScorer(): ROIScorer {
  return new ROIScorer(ROIStrategy.RISK_AVERSE);
}

export function createBrandFirstScorer(): ROIScorer {
  return new ROIScorer(ROIStrategy.BRAND_FIRST);
}

export function createQuickWinsScorer(): ROIScorer {
  return new ROIScorer(ROIStrategy.QUICK_WINS);
}

export function createHighImpactScorer(): ROIScorer {
  return new ROIScorer(ROIStrategy.HIGH_IMPACT);
}
