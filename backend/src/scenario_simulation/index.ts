/**
 * Scenario Simulation v1.5 - Module Index
 * 
 * What-if Analysis System for SEO Actions
 * 
 * Purpose: Evaluate potential outcomes of SEO actions before execution
 * 
 * Components:
 * - ScenarioBuilder: Generate scenarios from proposed actions
 * - ImpactSimulator: Simulate traffic/ranking impact
 * - RiskSimulator: Simulate risk exposure
 * - BrandImpactSimulator: Simulate brand consistency impact
 * - ScenarioComparator: Compare and rank scenarios
 * - RecommendationExplainer: Generate recommendations with explanations
 * 
 * Design Principles:
 * - Deterministic simulation (same inputs = same outputs)
 * - Explainable assumptions
 * - No side effects on production data
 * - Bounded time horizon (≤ 90 days)
 */

// ============================================================================
// MODELS
// ============================================================================

export {
  // Time horizons
  TimeHorizon,
  TIME_HORIZONS,
  
  // Scenario types
  ScenarioType,
  Scenario,
  ScenarioAction,
  ScenarioModification,
  ScenarioParameters,
  
  // Impact metrics
  ConfidenceInterval,
  TrafficImpact,
  RankingImpact,
  KeywordProjection,
  RiskImpact,
  CategoryRisk,
  RiskCategory,
  PotentialOutcome,
  BrandImpact,
  BrandViolationRisk,
  
  // Simulation results
  SimulationResult,
  EffortEstimate,
  SimulationScores,
  SimulationAssumption,
  DataSourceReference,
  
  // Comparison
  ScenarioComparison,
  ScenarioRanking,
  TradeOffAnalysis,
  ComparisonMatrix,
  
  // Recommendations
  SimulationRecommendation,
  RecommendedScenario,
  NotRecommendedScenario,
  ExpectedOutcome,
  
  // Historical data
  HistoricalData,
  TrafficDataPoint,
  RankingDataPoint,
  ContentScoreDataPoint,
  TechnicalHealthDataPoint,
  BrandScoreDataPoint,
  ActionOutcomeDataPoint,
  
  // Configuration
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
} from './models';

// ============================================================================
// BUILDERS
// ============================================================================

export {
  ScenarioBuilder,
  createScenarioBuilder,
} from './scenario_builder';

// ============================================================================
// SIMULATORS
// ============================================================================

export {
  ImpactSimulator,
  createImpactSimulator,
} from './impact_simulator';

export {
  RiskSimulator,
  createRiskSimulator,
} from './risk_simulator';

export {
  BrandImpactSimulator,
  createBrandImpactSimulator,
} from './brand_simulator';

// ============================================================================
// COMPARISON & RECOMMENDATION
// ============================================================================

export {
  ScenarioComparator,
  ComparisonWeights,
  DEFAULT_COMPARISON_WEIGHTS,
  CONSERVATIVE_WEIGHTS,
  AGGRESSIVE_WEIGHTS,
  createScenarioComparator,
  createConservativeComparator,
  createAggressiveComparator,
} from './scenario_comparator';

export {
  RecommendationExplainer,
  createRecommendationExplainer,
} from './recommendation_explainer';

// ============================================================================
// SIMULATION ENGINE (ORCHESTRATOR)
// ============================================================================

import { SEOAction } from '../autonomous_agent/models';
import { BrandStyleProfile } from '../brand_guardrail/models';

import {
  Scenario,
  ScenarioType,
  SimulationResult,
  HistoricalData,
  ScenarioComparison,
  SimulationRecommendation,
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
} from './models';
import { ScenarioBuilder } from './scenario_builder';
import { ImpactSimulator } from './impact_simulator';
import { RiskSimulator } from './risk_simulator';
import { BrandImpactSimulator } from './brand_simulator';
import { ScenarioComparator, ComparisonWeights, DEFAULT_COMPARISON_WEIGHTS } from './scenario_comparator';
import { RecommendationExplainer } from './recommendation_explainer';

/**
 * Main orchestrator for scenario simulation
 */
export class ScenarioSimulationEngine {
  private scenarioBuilder: ScenarioBuilder;
  private impactSimulator: ImpactSimulator;
  private riskSimulator: RiskSimulator;
  private brandSimulator: BrandImpactSimulator;
  private comparator: ScenarioComparator;
  private explainer: RecommendationExplainer;
  private logger: Console;
  
  constructor(
    config: Partial<SimulationConfig> = {},
    comparisonWeights: ComparisonWeights = DEFAULT_COMPARISON_WEIGHTS,
    brandProfile?: BrandStyleProfile
  ) {
    const fullConfig = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    
    this.scenarioBuilder = new ScenarioBuilder();
    this.impactSimulator = new ImpactSimulator(fullConfig);
    this.riskSimulator = new RiskSimulator(fullConfig);
    this.brandSimulator = new BrandImpactSimulator(fullConfig);
    this.comparator = new ScenarioComparator(comparisonWeights);
    this.explainer = new RecommendationExplainer();
    this.logger = console;
    
    if (brandProfile) {
      this.brandSimulator.setBrandProfile(brandProfile);
    }
  }
  
  /**
   * Set brand profile for simulations
   */
  setBrandProfile(profile: BrandStyleProfile): void {
    this.brandSimulator.setBrandProfile(profile);
  }
  
  /**
   * Set comparison weights
   */
  setComparisonWeights(weights: Partial<ComparisonWeights>): void {
    this.comparator.setWeights(weights);
  }
  
  /**
   * Run full simulation pipeline
   * 
   * 1. Build scenarios from proposed actions
   * 2. Simulate impact for each scenario
   * 3. Compare scenarios
   * 4. Generate recommendation
   */
  async runSimulation(
    projectId: string,
    proposedActions: SEOAction[],
    historicalData: HistoricalData
  ): Promise<{
    scenarios: Scenario[];
    results: Map<string, SimulationResult>;
    comparison: ScenarioComparison;
    recommendation: SimulationRecommendation;
  }> {
    this.logger.log(`[Engine] Starting simulation for project ${projectId}`);
    const startTime = Date.now();
    
    // Step 1: Build scenarios
    this.logger.log('[Engine] Step 1: Building scenarios');
    const scenarios = this.scenarioBuilder.buildScenarios(projectId, proposedActions);
    this.logger.log(`[Engine] Generated ${scenarios.length} scenarios`);
    
    // Step 2: Simulate each scenario
    this.logger.log('[Engine] Step 2: Simulating impacts');
    const results = new Map<string, SimulationResult>();
    
    for (const scenario of scenarios) {
      const result = this.simulateScenario(scenario, historicalData);
      results.set(scenario.id, result);
    }
    
    // Step 3: Compare scenarios
    this.logger.log('[Engine] Step 3: Comparing scenarios');
    const comparison = this.comparator.compareScenarios(scenarios, results);
    
    // Step 4: Generate recommendation
    this.logger.log('[Engine] Step 4: Generating recommendation');
    const recommendation = this.explainer.generateRecommendation(
      scenarios,
      results,
      comparison
    );
    
    const duration = Date.now() - startTime;
    this.logger.log(`[Engine] Simulation complete in ${duration}ms`);
    
    return {
      scenarios,
      results,
      comparison,
      recommendation,
    };
  }
  
  /**
   * Simulate a single scenario
   */
  simulateScenario(
    scenario: Scenario,
    historicalData: HistoricalData
  ): SimulationResult {
    const startTime = Date.now();
    
    // Run all simulators
    const { impact: trafficImpact, assumptions: trafficAssumptions } = 
      this.impactSimulator.simulateTrafficImpact(scenario, historicalData);
    
    const { impact: rankingImpact, assumptions: rankingAssumptions } = 
      this.impactSimulator.simulateRankingImpact(scenario, historicalData);
    
    const { impact: riskImpact, assumptions: riskAssumptions } = 
      this.riskSimulator.simulateRiskImpact(scenario, historicalData);
    
    const { impact: brandImpact, assumptions: brandAssumptions } = 
      this.brandSimulator.simulateBrandImpact(scenario, historicalData);
    
    // Combine assumptions
    const assumptions = [
      ...trafficAssumptions,
      ...rankingAssumptions,
      ...riskAssumptions,
      ...brandAssumptions,
    ];
    
    // Create full traffic impact with ranking
    const fullTrafficImpact = {
      ...trafficImpact,
      rankingImpact,
    };
    
    // Calculate effort estimate
    const effortEstimate = this.estimateEffort(scenario);
    
    // Calculate overall scores
    const scores = this.calculateScores(
      trafficImpact,
      riskImpact,
      brandImpact,
      effortEstimate
    );
    
    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      trafficImpact,
      riskImpact,
      assumptions
    );
    
    const duration = Date.now() - startTime;
    
    return {
      id: `result_${scenario.id}_${Date.now()}`,
      scenarioId: scenario.id,
      projectId: scenario.projectId,
      simulatedAt: new Date().toISOString(),
      durationMs: duration,
      trafficImpact: fullTrafficImpact,
      rankingImpact,
      riskImpact,
      brandImpact,
      effortEstimate,
      scores,
      assumptions,
      dataSources: this.getDataSources(historicalData),
      overallConfidence,
    };
  }
  
  /**
   * Estimate effort for a scenario
   */
  private estimateEffort(scenario: Scenario): SimulationResult['effortEstimate'] {
    const includedActions = scenario.actions.filter(a => a.included);
    
    // Base hours per action type
    let totalHours = 0;
    for (const action of includedActions) {
      const baseHours = this.getBaseHoursForAction(action.action.type.toString());
      totalHours += baseHours * action.scopeModifier;
    }
    
    // Complexity based on action count
    const complexity = totalHours < 10 ? 'low' : totalHours < 40 ? 'medium' : 'high';
    
    // Check reversibility
    const reversible = includedActions.every(a => 
      !a.action.type.toString().includes('DELETE') &&
      !a.action.type.toString().includes('REDIRECT')
    );
    
    return {
      hoursRequired: Math.round(totalHours),
      complexity,
      dependencies: [],
      reversible,
      reversibilityEffort: reversible ? 'easy' : 'difficult',
    };
  }
  
  /**
   * Get base hours for action type
   */
  private getBaseHoursForAction(actionType: string): number {
    const hours: Record<string, number> = {
      'create_content': 8,
      'update_content': 4,
      'optimize_content': 3,
      'fix_technical_issue': 4,
      'improve_page_speed': 6,
      'fix_schema_markup': 2,
      'add_internal_link': 1,
      'optimize_anchor_text': 1,
      'target_new_keyword': 2,
      'improve_keyword_ranking': 3,
      'set_up_alert': 1,
      'investigate_anomaly': 2,
    };
    return hours[actionType] || 3;
  }
  
  /**
   * Calculate simulation scores
   */
  private calculateScores(
    trafficImpact: SimulationResult['trafficImpact'],
    riskImpact: SimulationResult['riskImpact'],
    brandImpact: SimulationResult['brandImpact'],
    effortEstimate: SimulationResult['effortEstimate']
  ): SimulationResult['scores'] {
    // Expected gain from traffic
    const trafficChange = trafficImpact.percentageChange[90]?.mid || 0;
    const expectedGain = Math.max(0, Math.min(100, 50 + trafficChange * 2.5));
    
    // Risk score (0-100)
    const riskScore = riskImpact.overallRiskScore * 100;
    
    // Confidence score
    const confidenceScore = (trafficImpact.projectedTraffic[90]?.confidenceLevel || 0.5) * 100;
    
    // Effort score (lower hours = higher score)
    const effortScore = Math.max(0, 100 - effortEstimate.hoursRequired * 2);
    
    // Composite score
    const compositeScore = (
      expectedGain * 0.35 +
      (100 - riskScore) * 0.25 +
      confidenceScore * 0.20 +
      effortScore * 0.20
    );
    
    // ROI estimate
    const estimatedROI = effortScore > 0 ? (expectedGain / (100 - effortScore + 1)) * 100 : 0;
    
    return {
      expectedGain,
      riskScore,
      confidenceScore,
      effortScore,
      compositeScore,
      estimatedROI,
    };
  }
  
  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    trafficImpact: SimulationResult['trafficImpact'],
    riskImpact: SimulationResult['riskImpact'],
    assumptions: SimulationResult['assumptions']
  ): number {
    // Base confidence from traffic projection
    const trafficConfidence = trafficImpact.projectedTraffic[90]?.confidenceLevel || 0.5;
    
    // Reduce confidence for high sensitivity assumptions
    const highSensitivity = assumptions.filter(a => a.sensitivity === 'high').length;
    const sensitivityPenalty = highSensitivity * 0.05;
    
    // Reduce confidence for many risk factors
    const riskPenalty = riskImpact.categoryRisks.length * 0.02;
    
    return Math.max(0.2, Math.min(0.95, trafficConfidence - sensitivityPenalty - riskPenalty));
  }
  
  /**
   * Get data sources used
   */
  private getDataSources(historicalData: HistoricalData): SimulationResult['dataSources'] {
    return [
      {
        source: 'Traffic History',
        dataType: 'time_series',
        dateRange: historicalData.dateRange,
        recordCount: historicalData.trafficHistory.length,
        reliability: 0.9,
      },
      {
        source: 'Ranking History',
        dataType: 'time_series',
        dateRange: historicalData.dateRange,
        recordCount: historicalData.rankingHistory.length,
        reliability: 0.85,
      },
      {
        source: 'Brand Scores',
        dataType: 'time_series',
        dateRange: historicalData.dateRange,
        recordCount: historicalData.brandScores.length,
        reliability: 0.8,
      },
    ];
  }
  
  /**
   * Explain a specific scenario
   */
  explainScenario(scenario: Scenario, result: SimulationResult): string {
    return this.explainer.explainScenario(scenario, result);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createScenarioSimulationEngine(
  config?: Partial<SimulationConfig>,
  comparisonWeights?: ComparisonWeights,
  brandProfile?: BrandStyleProfile
): ScenarioSimulationEngine {
  return new ScenarioSimulationEngine(config, comparisonWeights, brandProfile);
}
