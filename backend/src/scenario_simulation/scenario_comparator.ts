/**
 * Scenario Comparator v1.5
 * 
 * Compares and ranks simulation results across scenarios.
 * 
 * Comparison Dimensions:
 * - Expected traffic/ranking gains
 * - Risk exposure
 * - Brand impact
 * - Effort required
 * - ROI estimation
 * 
 * Design Principles:
 * - Multi-criteria decision analysis
 * - Transparent trade-off explanation
 * - Customizable weighting
 */

import {
  Scenario,
  ScenarioType,
  SimulationResult,
  ScenarioComparison,
  ScenarioRanking,
  TradeOffAnalysis,
  ComparisonMatrix,
  SimulationScores,
  TimeHorizon,
} from './models';

// ============================================================================
// DEFAULT COMPARISON WEIGHTS
// ============================================================================

export interface ComparisonWeights {
  expectedGain: number;
  riskScore: number;
  brandImpact: number;
  effortScore: number;
  confidence: number;
}

export const DEFAULT_COMPARISON_WEIGHTS: ComparisonWeights = {
  expectedGain: 0.35,
  riskScore: 0.25,
  brandImpact: 0.15,
  effortScore: 0.15,
  confidence: 0.10,
};

// Conservative weights (prioritize safety)
export const CONSERVATIVE_WEIGHTS: ComparisonWeights = {
  expectedGain: 0.20,
  riskScore: 0.40,
  brandImpact: 0.20,
  effortScore: 0.10,
  confidence: 0.10,
};

// Aggressive weights (prioritize gains)
export const AGGRESSIVE_WEIGHTS: ComparisonWeights = {
  expectedGain: 0.50,
  riskScore: 0.15,
  brandImpact: 0.10,
  effortScore: 0.15,
  confidence: 0.10,
};

// ============================================================================
// SCENARIO COMPARATOR
// ============================================================================

export class ScenarioComparator {
  private weights: ComparisonWeights;
  private logger: Console;
  
  constructor(weights: ComparisonWeights = DEFAULT_COMPARISON_WEIGHTS) {
    this.weights = weights;
    this.logger = console;
  }
  
  /**
   * Set comparison weights
   */
  setWeights(weights: Partial<ComparisonWeights>): void {
    this.weights = { ...this.weights, ...weights };
    this.normalizeWeights();
  }
  
  /**
   * Normalize weights to sum to 1.0
   */
  private normalizeWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (sum !== 1.0 && sum > 0) {
      for (const key of Object.keys(this.weights) as Array<keyof ComparisonWeights>) {
        this.weights[key] /= sum;
      }
    }
  }
  
  /**
   * Compare multiple scenarios
   */
  compareScenarios(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>
  ): ScenarioComparison {
    this.logger.log(`[Comparator] Comparing ${scenarios.length} scenarios`);
    
    const rankings = this.calculateRankings(scenarios, results);
    const tradeOffs = this.analyzeTradeOffs(scenarios, results);
    const comparisonMatrix = this.buildComparisonMatrix(scenarios, results);
    
    return {
      id: `comparison_${Date.now()}`,
      projectId: scenarios[0]?.projectId || '',
      comparedAt: new Date().toISOString(),
      scenarioIds: scenarios.map(s => s.id),
      rankings,
      tradeOffs,
      comparisonMatrix,
    };
  }
  
  /**
   * Calculate rankings for all scenarios
   */
  private calculateRankings(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>
  ): ScenarioRanking[] {
    const rankings: ScenarioRanking[] = [];
    
    for (const scenario of scenarios) {
      const result = results.get(scenario.id);
      if (!result) {
        this.logger.warn(`[Comparator] No result for scenario ${scenario.id}`);
        continue;
      }
      
      const scores = this.calculateScenarioScores(scenario, result);
      const compositeScore = this.calculateCompositeScore(scores);
      
      rankings.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        rank: 0, // Will be set after sorting
        compositeScore,
        metricRanks: {
          expectedGain: 0, // Will be calculated
          riskScore: 0,
          confidenceScore: 0,
          effortScore: 0,
        },
        strengths: this.identifyStrengths(scores),
        weaknesses: this.identifyWeaknesses(scores),
      });
    }
    
    // Sort by composite score (descending) and assign ranks
    rankings.sort((a, b) => b.compositeScore - a.compositeScore);
    rankings.forEach((r, i) => r.rank = i + 1);
    
    // Calculate metric ranks
    this.calculateMetricRanks(rankings, scenarios, results);
    
    return rankings;
  }
  
  /**
   * Calculate metric-specific ranks
   */
  private calculateMetricRanks(
    rankings: ScenarioRanking[],
    scenarios: Scenario[],
    results: Map<string, SimulationResult>
  ): void {
    // Sort and rank by each metric
    const byGain = [...rankings].sort((a, b) => {
      const rA = results.get(a.scenarioId);
      const rB = results.get(b.scenarioId);
      const gainA = rA?.trafficImpact.percentageChange[90]?.mid || 0;
      const gainB = rB?.trafficImpact.percentageChange[90]?.mid || 0;
      return gainB - gainA;
    });
    byGain.forEach((r, i) => r.metricRanks.expectedGain = i + 1);
    
    const byRisk = [...rankings].sort((a, b) => {
      const rA = results.get(a.scenarioId);
      const rB = results.get(b.scenarioId);
      return (rA?.riskImpact.overallRiskScore || 0) - (rB?.riskImpact.overallRiskScore || 0);
    });
    byRisk.forEach((r, i) => r.metricRanks.riskScore = i + 1);
    
    const byConfidence = [...rankings].sort((a, b) => {
      const rA = results.get(a.scenarioId);
      const rB = results.get(b.scenarioId);
      return (rB?.overallConfidence || 0) - (rA?.overallConfidence || 0);
    });
    byConfidence.forEach((r, i) => r.metricRanks.confidenceScore = i + 1);
    
    const byEffort = [...rankings].sort((a, b) => {
      const rA = results.get(a.scenarioId);
      const rB = results.get(b.scenarioId);
      return (rA?.effortEstimate.hoursRequired || 0) - (rB?.effortEstimate.hoursRequired || 0);
    });
    byEffort.forEach((r, i) => r.metricRanks.effortScore = i + 1);
  }
  
  /**
   * Calculate scores for a scenario
   */
  private calculateScenarioScores(
    scenario: Scenario,
    result: SimulationResult
  ): SimulationScores {
    // Expected gain from traffic impact
    const trafficGain = this.calculateTrafficGainScore(result);
    
    // Risk score (inverted - lower risk = higher score)
    const riskScore = result.riskImpact.overallRiskScore * 100;
    
    // Confidence score
    const confidenceScore = result.overallConfidence * 100;
    
    // Effort score (inverted - lower effort = higher score)
    const effortScore = this.calculateEffortScore(result);
    
    // Composite score
    const compositeScore = this.calculateCompositeScore({
      expectedGain: trafficGain,
      riskScore,
      confidenceScore,
      effortScore,
      compositeScore: 0, // Placeholder
      estimatedROI: 0, // Placeholder
    });
    
    // Estimated ROI
    const estimatedROI = this.calculateROI(trafficGain, effortScore);
    
    return {
      expectedGain: trafficGain,
      riskScore,
      confidenceScore,
      effortScore,
      compositeScore,
      estimatedROI,
    };
  }
  
  /**
   * Calculate traffic gain score
   */
  private calculateTrafficGainScore(result: SimulationResult): number {
    const horizon: TimeHorizon = 90; // Use 90-day projection
    const trafficChange = result.trafficImpact.percentageChange[horizon]?.mid || 0;
    
    // Convert percentage change to 0-100 score
    // +20% or more = 100, 0% = 50, -20% or less = 0
    const score = Math.max(0, Math.min(100, 50 + (trafficChange * 2.5)));
    return score;
  }
  
  /**
   * Calculate effort score (lower effort = higher score)
   */
  private calculateEffortScore(result: SimulationResult): number {
    const hours = result.effortEstimate.hoursRequired;
    
    // Map hours to 0-100 score
    // 0-5 hours = 90-100, 5-20 hours = 60-90, 20-50 hours = 30-60, 50+ hours = 0-30
    if (hours <= 5) return 90 + ((5 - hours) * 2);
    if (hours <= 20) return 60 + ((20 - hours) / 15 * 30);
    if (hours <= 50) return 30 + ((50 - hours) / 30 * 30);
    return Math.max(0, 30 - (hours - 50) * 0.5);
  }
  
  /**
   * Calculate composite score using weights
   */
  private calculateCompositeScore(scores: SimulationScores): number {
    // Invert risk and effort (lower is better for these)
    const adjustedRisk = 100 - scores.riskScore;
    
    return (
      scores.expectedGain * this.weights.expectedGain +
      adjustedRisk * this.weights.riskScore +
      scores.confidenceScore * this.weights.confidence +
      scores.effortScore * this.weights.effortScore
      // Brand impact would be added here with this.weights.brandImpact
    );
  }
  
  /**
   * Calculate estimated ROI
   */
  private calculateROI(gainScore: number, effortScore: number): number {
    if (effortScore === 0) return 0;
    return (gainScore / (100 - effortScore + 1)) * 100;
  }
  
  /**
   * Identify strengths
   */
  private identifyStrengths(scores: SimulationScores): string[] {
    const strengths: string[] = [];
    
    if (scores.expectedGain > 70) {
      strengths.push('High expected gain');
    }
    if (scores.riskScore < 30) {
      strengths.push('Low risk exposure');
    }
    if (scores.confidenceScore > 80) {
      strengths.push('High confidence in projections');
    }
    if (scores.effortScore > 80) {
      strengths.push('Low implementation effort');
    }
    if (scores.estimatedROI > 150) {
      strengths.push('Excellent ROI potential');
    }
    
    return strengths.length > 0 ? strengths : ['Balanced approach'];
  }
  
  /**
   * Identify weaknesses
   */
  private identifyWeaknesses(scores: SimulationScores): string[] {
    const weaknesses: string[] = [];
    
    if (scores.expectedGain < 40) {
      weaknesses.push('Limited expected gain');
    }
    if (scores.riskScore > 60) {
      weaknesses.push('High risk exposure');
    }
    if (scores.confidenceScore < 50) {
      weaknesses.push('Low confidence - more data needed');
    }
    if (scores.effortScore < 40) {
      weaknesses.push('High implementation effort');
    }
    if (scores.estimatedROI < 50) {
      weaknesses.push('Low ROI potential');
    }
    
    return weaknesses;
  }
  
  /**
   * Analyze trade-offs between scenarios
   */
  private analyzeTradeOffs(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>
  ): TradeOffAnalysis[] {
    const tradeOffs: TradeOffAnalysis[] = [];
    
    // Compare each pair of scenarios
    for (let i = 0; i < scenarios.length; i++) {
      for (let j = i + 1; j < scenarios.length; j++) {
        const scenarioA = scenarios[i];
        const scenarioB = scenarios[j];
        const resultA = results.get(scenarioA.id);
        const resultB = results.get(scenarioB.id);
        
        if (!resultA || !resultB) continue;
        
        const tradeOff = this.compareTwo(scenarioA, scenarioB, resultA, resultB);
        tradeOffs.push(tradeOff);
      }
    }
    
    return tradeOffs;
  }
  
  /**
   * Compare two scenarios for trade-offs
   */
  private compareTwo(
    scenarioA: Scenario,
    scenarioB: Scenario,
    resultA: SimulationResult,
    resultB: SimulationResult
  ): TradeOffAnalysis {
    const gainDiff = (resultA.trafficImpact.percentageChange[90]?.mid || 0) -
                     (resultB.trafficImpact.percentageChange[90]?.mid || 0);
    const riskDiff = resultA.riskImpact.overallRiskScore - resultB.riskImpact.overallRiskScore;
    
    // Build advantages lists
    const aAdvantages: string[] = [];
    const bAdvantages: string[] = [];
    
    if (gainDiff > 2) aAdvantages.push(`Higher expected gain (+${gainDiff.toFixed(1)}%)`);
    else if (gainDiff < -2) bAdvantages.push(`Higher expected gain (+${Math.abs(gainDiff).toFixed(1)}%)`);
    
    if (riskDiff < -0.05) aAdvantages.push(`Lower risk exposure`);
    else if (riskDiff > 0.05) bAdvantages.push(`Lower risk exposure`);
    
    if (resultA.effortEstimate.hoursRequired < resultB.effortEstimate.hoursRequired) {
      aAdvantages.push('Lower implementation effort');
    } else if (resultB.effortEstimate.hoursRequired < resultA.effortEstimate.hoursRequired) {
      bAdvantages.push('Lower implementation effort');
    }
    
    // Determine recommendation
    let recommendation: 'prefer_a' | 'prefer_b' | 'equivalent';
    if (aAdvantages.length > bAdvantages.length + 1) {
      recommendation = 'prefer_a';
    } else if (bAdvantages.length > aAdvantages.length + 1) {
      recommendation = 'prefer_b';
    } else {
      recommendation = 'equivalent';
    }
    
    // Build explanation
    let explanation: string;
    if (recommendation === 'prefer_a') {
      explanation = `${scenarioA.name} is preferred due to: ${aAdvantages.join(', ')}`;
    } else if (recommendation === 'prefer_b') {
      explanation = `${scenarioB.name} is preferred due to: ${bAdvantages.join(', ')}`;
    } else {
      explanation = 'Both scenarios have comparable trade-offs - decision depends on priorities';
    }
    
    return {
      scenarioA: scenarioA.id,
      scenarioB: scenarioB.id,
      aAdvantages,
      bAdvantages,
      recommendation,
      explanation,
    };
  }
  
  /**
   * Build comparison matrix
   */
  private buildComparisonMatrix(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>
  ): ComparisonMatrix {
    const metrics = ['Traffic Change', 'Risk Score', 'Effort Hours', 'Confidence'];
    const scenarioIds = scenarios.map(s => s.id);
    
    const values: number[][] = scenarios.map(s => {
      const result = results.get(s.id);
      return [
        result?.trafficImpact.percentageChange[90]?.mid || 0,
        (result?.riskImpact.overallRiskScore || 0) * 100,
        result?.effortEstimate.hoursRequired || 0,
        (result?.overallConfidence || 0) * 100,
      ];
    });
    
    // Normalize values (0-1 scale)
    const normalizedValues: number[][] = [];
    for (let metricIdx = 0; metricIdx < metrics.length; metricIdx++) {
      const metricValues = values.map(v => v[metricIdx]);
      const min = Math.min(...metricValues);
      const max = Math.max(...metricValues);
      const range = max - min || 1;
      
      values.forEach((_, scenarioIdx) => {
        if (!normalizedValues[scenarioIdx]) normalizedValues[scenarioIdx] = [];
        normalizedValues[scenarioIdx][metricIdx] = (values[scenarioIdx][metricIdx] - min) / range;
      });
    }
    
    return {
      metrics,
      scenarios: scenarioIds,
      values,
      normalizedValues,
    };
  }
  
  /**
   * Find best scenario in a dimension
   */
  private findBestInDimension(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>,
    getValue: (r: SimulationResult) => number,
    higherIsBetter: boolean
  ): string | null {
    let bestId: string | null = null;
    let bestValue = higherIsBetter ? -Infinity : Infinity;
    
    for (const scenario of scenarios) {
      const result = results.get(scenario.id);
      if (!result) continue;
      
      const value = getValue(result);
      if (higherIsBetter ? value > bestValue : value < bestValue) {
        bestValue = value;
        bestId = scenario.id;
      }
    }
    
    return bestId;
  }
  
  /**
   * Determine winner
   */
  private determineWinner(rankings: ScenarioRanking[]): ScenarioRanking | null {
    if (rankings.length === 0) return null;
    
    const winner = rankings[0]; // Already sorted by composite score
    
    // Check if winner has significant margin
    if (rankings.length > 1 && winner.compositeScore - rankings[1].compositeScore < 5) {
      // Close call - could be either
      return winner; // Still return winner, but note in explanation
    }
    
    return winner;
  }
  
  /**
   * Explain why winner was chosen
   */
  private explainWinner(winner: ScenarioRanking, allRankings: ScenarioRanking[]): string {
    const margin = allRankings.length > 1 
      ? winner.compositeScore - allRankings[1].compositeScore 
      : 100;
    
    let explanation = `${winner.scenarioName} ranked #1 with composite score ${winner.compositeScore.toFixed(1)}`;
    
    if (margin < 5) {
      explanation += ` (close margin of ${margin.toFixed(1)} points - consider reviewing trade-offs)`;
    } else if (margin > 20) {
      explanation += ` (clear winner with ${margin.toFixed(1)} point margin)`;
    }
    
    if (winner.strengths.length > 0) {
      explanation += `. Key strengths: ${winner.strengths.slice(0, 2).join(', ')}`;
    }
    
    return explanation;
  }
  
  /**
   * Identify warnings (utility method, not used in comparison return)
   */
  getWarnings(
    rankings: ScenarioRanking[],
    results: Map<string, SimulationResult>,
    scenarios: Scenario[]
  ): string[] {
    const warnings: string[] = [];
    
    // Check if top scenario has high risk
    const topResult = results.get(rankings[0]?.scenarioId || '');
    if (topResult && topResult.riskImpact.overallRiskScore > 0.6) {
      warnings.push('Recommended scenario has elevated risk - consider risk mitigation');
    }
    
    // Check if all scenarios have low confidence
    const allLowConfidence = Array.from(results.values()).every(r => r.overallConfidence < 0.5);
    if (allLowConfidence) {
      warnings.push('All scenarios have low confidence - gather more data before deciding');
    }
    
    // Check if baseline is winner
    const topScenario = scenarios.find(s => s.id === rankings[0]?.scenarioId);
    if (topScenario?.type === ScenarioType.BASELINE) {
      warnings.push('Baseline (do nothing) ranked highest - proposed actions may not be worthwhile');
    }
    
    // Check for close race
    if (rankings.length > 1 && rankings[0].compositeScore - rankings[1].compositeScore < 3) {
      warnings.push('Top scenarios are very close - decision may depend on specific priorities');
    }
    
    return warnings;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createScenarioComparator(
  weights?: Partial<ComparisonWeights>
): ScenarioComparator {
  const finalWeights = weights 
    ? { ...DEFAULT_COMPARISON_WEIGHTS, ...weights }
    : DEFAULT_COMPARISON_WEIGHTS;
  return new ScenarioComparator(finalWeights);
}

export function createConservativeComparator(): ScenarioComparator {
  return new ScenarioComparator(CONSERVATIVE_WEIGHTS);
}

export function createAggressiveComparator(): ScenarioComparator {
  return new ScenarioComparator(AGGRESSIVE_WEIGHTS);
}
