/**
 * Portfolio Optimization v1.7 - Module Index
 * 
 * Multi-domain / Multi-project SEO Portfolio Optimization
 * 
 * Purpose: Maximize total SEO ROI under shared resource constraints
 * 
 * Components:
 * - PortfolioAggregator: Collect and normalize per-project metrics
 * - ProjectClassifier: Classify projects by potential and risk
 * - PortfolioOptimizer: Optimize allocation across projects
 * - PortfolioSimulator: Simulate portfolio outcomes
 * - RecommendationEngine: Generate portfolio-level recommendations
 * 
 * Design Principles:
 * - Never optimize a project in isolation
 * - Always show trade-offs between projects
 * - Deterministic allocation
 * - Explainable decisions
 * - Respect project-level guardrails
 * - No forced execution
 */

// ============================================================================
// MODELS
// ============================================================================

export {
  // Project metrics
  ProjectMetrics,
  TrafficMetrics,
  ROIMetrics,
  RiskMetrics,
  CostMetrics,
  ProjectionMetrics,
  ProjectionRange,
  
  // Normalized metrics
  NormalizedProjectMetrics,
  NormalizationMethod,
  
  // Classification
  ProjectClassification,
  ProjectClassificationResult,
  ClassificationFactor,
  AlternativeClassification,
  ClassificationCriteria,
  
  // Constraints
  PortfolioConstraints,
  CustomConstraint,
  DEFAULT_PORTFOLIO_CONSTRAINTS,
  
  // Allocation
  PortfolioAllocation,
  ProjectAllocation,
  AllocationMethod,
  
  // Scenarios
  PortfolioScenario,
  PortfolioScenarioType,
  AllocationChange,
  PortfolioScenarioParameters,
  
  // Simulation results
  PortfolioSimulationResult,
  ProjectSimulationProjection,
  PortfolioTradeOff,
  SimulationAssumption,
  
  // Recommendations
  PortfolioRecommendation,
  ProjectRecommendation,
  RecommendedAction,
  AlternativeRecommendation,
  PortfolioInsight,
  PortfolioAction,
  ExpectedOutcome,
  RiskWarning,
  
  // State
  PortfolioState,
  PortfolioHistoryEntry,
  ActualOutcome,
  
  // Configuration
  PortfolioOptimizationConfig,
  DEFAULT_PORTFOLIO_CONFIG,
  PortfolioStrategy,
  
  // Input/Output
  PortfolioOptimizationInput,
  PortfolioOptimizationOutput,
  AllocationComparison,
} from './models';

// ============================================================================
// AGGREGATOR
// ============================================================================

export {
  PortfolioAggregator,
  TrafficDataSource,
  ROIDataSource,
  RiskDataSource,
  CostDataSource,
  ProjectionDataSource,
  RawProjectData,
  createPortfolioAggregator,
} from './portfolio_aggregator';

// ============================================================================
// CLASSIFIER
// ============================================================================

export {
  ProjectClassifier,
  createProjectClassifier,
  createGrowthFocusedClassifier,
  createRiskAverseClassifier,
} from './project_classifier';

// ============================================================================
// OPTIMIZER
// ============================================================================

export {
  PortfolioOptimizer,
  createPortfolioOptimizer,
  createConservativeOptimizer,
  createAggressiveOptimizer,
} from './portfolio_optimizer';

// ============================================================================
// SIMULATOR
// ============================================================================

export {
  PortfolioSimulator,
  createPortfolioSimulator,
  createConservativeSimulator,
} from './portfolio_simulator';

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

export {
  RecommendationEngine,
  createRecommendationEngine,
  createConservativeRecommendationEngine,
} from './recommendation_engine';

// ============================================================================
// PORTFOLIO OPTIMIZATION ENGINE (ORCHESTRATOR)
// ============================================================================

import {
  ProjectMetrics,
  NormalizedProjectMetrics,
  ProjectClassificationResult,
  PortfolioConstraints,
  PortfolioAllocation,
  PortfolioScenario,
  PortfolioSimulationResult,
  PortfolioRecommendation,
  PortfolioOptimizationConfig,
  DEFAULT_PORTFOLIO_CONFIG,
  DEFAULT_PORTFOLIO_CONSTRAINTS,
  PortfolioStrategy,
  PortfolioOptimizationOutput,
  AllocationChange,
} from './models';

import { PortfolioAggregator, RawProjectData } from './portfolio_aggregator';
import { ProjectClassifier } from './project_classifier';
import { PortfolioOptimizer } from './portfolio_optimizer';
import { PortfolioSimulator } from './portfolio_simulator';
import { RecommendationEngine } from './recommendation_engine';

/**
 * Main orchestrator for portfolio optimization
 */
export class PortfolioOptimizationEngine {
  private aggregator: PortfolioAggregator;
  private classifier: ProjectClassifier;
  private optimizer: PortfolioOptimizer;
  private simulator: PortfolioSimulator;
  private recommendationEngine: RecommendationEngine;
  private config: PortfolioOptimizationConfig;
  private logger: Console;
  
  constructor(config: Partial<PortfolioOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_PORTFOLIO_CONFIG, ...config };
    this.aggregator = new PortfolioAggregator(this.config);
    this.classifier = new ProjectClassifier(this.config);
    this.optimizer = new PortfolioOptimizer(this.config);
    this.simulator = new PortfolioSimulator(this.config);
    this.recommendationEngine = new RecommendationEngine(this.config);
    this.logger = console;
  }
  
  // ==========================================================================
  // MAIN OPTIMIZATION PIPELINE
  // ==========================================================================
  
  /**
   * Run full portfolio optimization pipeline
   */
  async optimizePortfolio(
    portfolioId: string,
    rawProjectData: RawProjectData[],
    constraints: Partial<PortfolioConstraints> = {},
    strategy: PortfolioStrategy = PortfolioStrategy.BALANCED_GROWTH,
    currentAllocation?: PortfolioAllocation
  ): Promise<PortfolioOptimizationOutput> {
    const startTime = Date.now();
    const warnings: string[] = [];
    
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Starting optimization for portfolio ${portfolioId}`);
      this.logger.log(`[PortfolioOptimizationEngine] Projects: ${rawProjectData.length}, Strategy: ${strategy}`);
    }
    
    // 1. Aggregate metrics
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Step 1: Aggregating metrics`);
    }
    const projectMetrics = this.aggregator.aggregatePortfolio(rawProjectData);
    
    if (projectMetrics.length === 0) {
      throw new Error('No valid project metrics after aggregation');
    }
    
    if (projectMetrics.length < rawProjectData.length) {
      warnings.push(`${rawProjectData.length - projectMetrics.length} project(s) failed aggregation`);
    }
    
    // 2. Normalize metrics
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Step 2: Normalizing metrics`);
    }
    const normalizedMetrics = this.aggregator.normalizeMetrics(projectMetrics);
    
    // 3. Classify projects
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Step 3: Classifying projects`);
    }
    const classifications = this.classifier.classifyPortfolio(projectMetrics, normalizedMetrics);
    
    // Log classification distribution
    const classificationCounts = this.countClassifications(classifications);
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Classifications:`, classificationCounts);
    }
    
    // 4. Build full constraints
    const fullConstraints = this.buildConstraints(constraints, projectMetrics);
    
    // 5. Optimize allocation
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Step 4: Optimizing allocation`);
    }
    const recommendedAllocation = this.optimizer.optimizeAllocation(
      projectMetrics,
      normalizedMetrics,
      classifications,
      fullConstraints,
      strategy
    );
    
    // 6. Simulate scenarios
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Step 5: Simulating scenarios`);
    }
    const { scenarios, results } = this.simulator.simulateStandardScenarios(
      projectMetrics,
      normalizedMetrics,
      classifications,
      currentAllocation || recommendedAllocation,
      fullConstraints
    );
    
    const simulationResults = Array.from(results.values());
    
    // 7. Generate recommendations
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Step 6: Generating recommendations`);
    }
    const recommendation = this.recommendationEngine.generateRecommendations(
      projectMetrics,
      normalizedMetrics,
      classifications,
      currentAllocation || recommendedAllocation,
      simulationResults
    );
    
    // 8. Build comparison if current allocation provided
    let comparisonToCurrentAllocation;
    if (currentAllocation) {
      comparisonToCurrentAllocation = this.buildAllocationComparison(
        currentAllocation,
        recommendedAllocation,
        normalizedMetrics
      );
    }
    
    const executionTimeMs = Date.now() - startTime;
    
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizationEngine] Optimization complete in ${executionTimeMs}ms`);
    }
    
    return {
      portfolioId,
      normalizedMetrics,
      classifications,
      recommendedAllocation,
      simulationResults,
      recommendation,
      comparisonToCurrentAllocation,
      optimizedAt: new Date().toISOString(),
      executionTimeMs,
      warnings,
    };
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  private buildConstraints(
    partial: Partial<PortfolioConstraints>,
    projects: ProjectMetrics[]
  ): PortfolioConstraints {
    const defaults = DEFAULT_PORTFOLIO_CONSTRAINTS['balanced'] || {};
    
    return {
      id: `constraints-${Date.now()}`,
      name: partial.name || 'Portfolio Constraints',
      totalTokenBudget: partial.totalTokenBudget || defaults.totalTokenBudget || 1000000,
      totalEffortHours: partial.totalEffortHours || defaults.totalEffortHours || 200,
      totalComputeBudget: partial.totalComputeBudget || 100000,
      portfolioRiskTolerance: partial.portfolioRiskTolerance || defaults.portfolioRiskTolerance || 0.5,
      maxProjectRisk: partial.maxProjectRisk || defaults.maxProjectRisk || 0.6,
      maxProjectAllocation: partial.maxProjectAllocation || defaults.maxProjectAllocation || 0.5,
      minProjectAllocation: partial.minProjectAllocation || defaults.minProjectAllocation || 0.03,
      maxProjectCount: partial.maxProjectCount || projects.length,
      maxAutomationLevel: partial.maxAutomationLevel || defaults.maxAutomationLevel || 0.7,
      requireHumanApproval: partial.requireHumanApproval ?? defaults.requireHumanApproval ?? true,
      planningHorizon: partial.planningHorizon || defaults.planningHorizon || 60,
      rebalanceFrequency: partial.rebalanceFrequency || defaults.rebalanceFrequency || 'weekly',
      customConstraints: partial.customConstraints || [],
    };
  }
  
  private countClassifications(
    classifications: ProjectClassificationResult[]
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const c of classifications) {
      counts[c.classification] = (counts[c.classification] || 0) + 1;
    }
    return counts;
  }
  
  private buildAllocationComparison(
    current: PortfolioAllocation,
    recommended: PortfolioAllocation,
    normalizedMetrics: NormalizedProjectMetrics[]
  ): {
    currentTotalROI: number;
    projectedTotalROI: number;
    roiImprovement: number;
    currentRisk: number;
    projectedRisk: number;
    riskChange: number;
    significantChanges: AllocationChange[];
    tradeOffs: string[];
  } {
    // Calculate current ROI
    let currentROI = 0;
    let currentRisk = 0;
    let recommendedROI = 0;
    let recommendedRisk = 0;
    let currentWeight = 0;
    let recommendedWeight = 0;
    
    for (const alloc of current.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === alloc.projectId);
      if (!normalized) continue;
      
      currentROI += normalized.roiScore * alloc.totalAllocationPercent;
      currentRisk += normalized.riskScore * alloc.totalAllocationPercent;
      currentWeight += alloc.totalAllocationPercent;
    }
    
    for (const alloc of recommended.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === alloc.projectId);
      if (!normalized) continue;
      
      recommendedROI += normalized.roiScore * alloc.totalAllocationPercent;
      recommendedRisk += normalized.riskScore * alloc.totalAllocationPercent;
      recommendedWeight += alloc.totalAllocationPercent;
    }
    
    currentROI = currentWeight > 0 ? currentROI / currentWeight : 0;
    currentRisk = currentWeight > 0 ? (currentRisk / currentWeight) / 100 : 0;
    recommendedROI = recommendedWeight > 0 ? recommendedROI / recommendedWeight : 0;
    recommendedRisk = recommendedWeight > 0 ? (recommendedRisk / recommendedWeight) / 100 : 0;
    
    // Find significant changes
    const significantChanges: AllocationChange[] = [];
    for (const recAlloc of recommended.projectAllocations) {
      const currAlloc = current.projectAllocations.find(a => a.projectId === recAlloc.projectId);
      if (!currAlloc) continue;
      
      const changePercent = currAlloc.totalAllocationPercent > 0
        ? ((recAlloc.totalAllocationPercent - currAlloc.totalAllocationPercent) / currAlloc.totalAllocationPercent) * 100
        : 0;
      
      if (Math.abs(changePercent) > 10) {
        significantChanges.push({
          projectId: recAlloc.projectId,
          previousAllocation: currAlloc.totalAllocationPercent,
          newAllocation: recAlloc.totalAllocationPercent,
          changePercent,
          reason: `${changePercent > 0 ? 'Increased' : 'Decreased'} based on optimization`,
        });
      }
    }
    
    // Generate trade-off descriptions
    const tradeOffs: string[] = [];
    const increased = significantChanges.filter(c => c.changePercent > 0);
    const decreased = significantChanges.filter(c => c.changePercent < 0);
    
    if (increased.length > 0 && decreased.length > 0) {
      tradeOffs.push(
        `Shifting ${decreased.length} project(s) budget to ${increased.length} higher-potential project(s)`
      );
    }
    
    if (recommendedRisk < currentRisk) {
      tradeOffs.push(`Overall portfolio risk reduced by ${((currentRisk - recommendedRisk) * 100).toFixed(1)}%`);
    } else if (recommendedRisk > currentRisk) {
      tradeOffs.push(`Accepting ${((recommendedRisk - currentRisk) * 100).toFixed(1)}% higher risk for better ROI`);
    }
    
    return {
      currentTotalROI: currentROI,
      projectedTotalROI: recommendedROI,
      roiImprovement: recommendedROI - currentROI,
      currentRisk,
      projectedRisk: recommendedRisk,
      riskChange: (recommendedRisk - currentRisk) * 100,
      significantChanges,
      tradeOffs,
    };
  }
  
  // ==========================================================================
  // INDIVIDUAL OPERATIONS
  // ==========================================================================
  
  /**
   * Aggregate metrics only
   */
  aggregateMetrics(rawData: RawProjectData[]): ProjectMetrics[] {
    return this.aggregator.aggregatePortfolio(rawData);
  }
  
  /**
   * Normalize metrics only
   */
  normalizeMetrics(projects: ProjectMetrics[]): NormalizedProjectMetrics[] {
    return this.aggregator.normalizeMetrics(projects);
  }
  
  /**
   * Classify projects only
   */
  classifyProjects(
    projects: ProjectMetrics[],
    normalized: NormalizedProjectMetrics[]
  ): ProjectClassificationResult[] {
    return this.classifier.classifyPortfolio(projects, normalized);
  }
  
  /**
   * Optimize allocation only
   */
  optimizeAllocation(
    projects: ProjectMetrics[],
    normalized: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    constraints: PortfolioConstraints,
    strategy: PortfolioStrategy
  ): PortfolioAllocation {
    return this.optimizer.optimizeAllocation(
      projects, normalized, classifications, constraints, strategy
    );
  }
  
  /**
   * Simulate scenarios only
   */
  simulateScenarios(
    projects: ProjectMetrics[],
    normalized: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints
  ): { scenarios: PortfolioScenario[]; results: Map<string, PortfolioSimulationResult> } {
    return this.simulator.simulateStandardScenarios(
      projects, normalized, classifications, currentAllocation, constraints
    );
  }
  
  /**
   * Generate recommendations only
   */
  generateRecommendations(
    projects: ProjectMetrics[],
    normalized: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    simulationResults: PortfolioSimulationResult[]
  ): PortfolioRecommendation {
    return this.recommendationEngine.generateRecommendations(
      projects, normalized, classifications, currentAllocation, simulationResults
    );
  }
  
  // ==========================================================================
  // EXPLANATION
  // ==========================================================================
  
  /**
   * Generate human-readable explanation of allocation
   */
  explainAllocation(allocation: PortfolioAllocation): string {
    const lines: string[] = [];
    
    lines.push('PORTFOLIO ALLOCATION EXPLANATION');
    lines.push('================================');
    lines.push('');
    lines.push(`Method: ${allocation.optimizationMethod}`);
    lines.push(`Optimization Score: ${allocation.optimizationScore.toFixed(1)}/100`);
    lines.push(`Iterations: ${allocation.iterations}`);
    lines.push('');
    lines.push('ALLOCATION BY PROJECT:');
    lines.push('-'.repeat(60));
    
    const sorted = [...allocation.projectAllocations].sort(
      (a, b) => b.totalAllocationPercent - a.totalAllocationPercent
    );
    
    for (const alloc of sorted) {
      lines.push('');
      lines.push(`${alloc.projectName} [${alloc.classification}]`);
      lines.push(`  Allocation: ${(alloc.totalAllocationPercent * 100).toFixed(1)}%`);
      lines.push(`  Token Budget: ${alloc.tokenBudget.toLocaleString()}`);
      lines.push(`  Effort Hours: ${alloc.effortHours.toFixed(1)}`);
      lines.push(`  Automation Level: ${(alloc.automationLevel * 100).toFixed(0)}%`);
      lines.push(`  Requires Approval: ${alloc.requiresApproval ? 'Yes' : 'No'}`);
      
      if (alloc.allocationRationale.length > 0) {
        lines.push(`  Rationale:`);
        for (const reason of alloc.allocationRationale) {
          lines.push(`    - ${reason}`);
        }
      }
      
      if (alloc.tradeOffsAccepted.length > 0) {
        lines.push(`  Trade-offs:`);
        for (const tradeOff of alloc.tradeOffsAccepted) {
          lines.push(`    - ${tradeOff}`);
        }
      }
    }
    
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('DISTRIBUTION BY CLASSIFICATION:');
    
    for (const [classification, percent] of Object.entries(allocation.classificationDistribution)) {
      if (percent > 0) {
        lines.push(`  ${classification}: ${(percent * 100).toFixed(1)}%`);
      }
    }
    
    lines.push('');
    lines.push('RESOURCE SUMMARY:');
    lines.push(`  Tokens Allocated: ${allocation.totalTokensAllocated.toLocaleString()} (${allocation.unallocatedTokens.toLocaleString()} unallocated)`);
    lines.push(`  Effort Allocated: ${allocation.totalEffortAllocated.toFixed(1)} hours (${allocation.unallocatedEffort.toFixed(1)} unallocated)`);
    
    return lines.join('\n');
  }
  
  /**
   * Generate human-readable explanation of recommendation
   */
  explainRecommendation(recommendation: PortfolioRecommendation): string {
    const lines: string[] = [];
    
    lines.push('PORTFOLIO RECOMMENDATION');
    lines.push('========================');
    lines.push('');
    lines.push('SUMMARY:');
    lines.push(recommendation.summary);
    lines.push('');
    
    // Risk warnings
    if (recommendation.riskWarnings.length > 0) {
      lines.push('⚠️ RISK WARNINGS:');
      lines.push('-'.repeat(40));
      for (const warning of recommendation.riskWarnings) {
        const icon = warning.severity === 'critical' ? '🔴' : warning.severity === 'warning' ? '🟡' : 'ℹ️';
        lines.push(`${icon} [${warning.type}] ${warning.description}`);
        lines.push(`   Mitigation: ${warning.suggestedMitigation}`);
      }
      lines.push('');
    }
    
    // Prioritized actions
    lines.push('🎯 PRIORITIZED ACTIONS:');
    lines.push('-'.repeat(40));
    for (const action of recommendation.prioritizedActions.slice(0, 5)) {
      lines.push(`[P${action.priority}] ${action.action}`);
      lines.push(`   Impact: ${action.expectedImpact}`);
      lines.push(`   Effort: ${action.effort}`);
    }
    lines.push('');
    
    // Project recommendations
    lines.push('📋 PROJECT RECOMMENDATIONS:');
    lines.push('-'.repeat(40));
    for (const rec of recommendation.projectRecommendations) {
      lines.push('');
      lines.push(`${rec.projectName} [${rec.classification}]`);
      lines.push(`  Action: ${rec.recommendedAction}`);
      lines.push(`  Priority: ${rec.priority}/10`);
      lines.push(`  Impact: ${rec.expectedImpact}`);
      
      if (rec.rationale.length > 0) {
        lines.push(`  Rationale:`);
        for (const reason of rec.rationale.slice(0, 2)) {
          lines.push(`    - ${reason}`);
        }
      }
    }
    lines.push('');
    
    // Expected outcomes
    lines.push('📈 EXPECTED OUTCOMES:');
    lines.push('-'.repeat(40));
    for (const outcome of recommendation.expectedOutcomes) {
      const direction = outcome.changePercent >= 0 ? '↑' : '↓';
      lines.push(`${outcome.metric}: ${outcome.currentValue.toFixed(1)} → ${outcome.projectedValue.toFixed(1)} (${direction}${Math.abs(outcome.changePercent).toFixed(1)}%)`);
      lines.push(`   Timeframe: ${outcome.timeframe}, Confidence: ${(outcome.confidence * 100).toFixed(0)}%`);
    }
    lines.push('');
    
    // Portfolio insights
    if (recommendation.portfolioInsights.length > 0) {
      lines.push('💡 PORTFOLIO INSIGHTS:');
      lines.push('-'.repeat(40));
      for (const insight of recommendation.portfolioInsights) {
        const icon = insight.type === 'opportunity' ? '🌟' : 
                    insight.type === 'risk' ? '⚠️' : 
                    insight.type === 'efficiency' ? '⚡' : '🔄';
        lines.push(`${icon} ${insight.title}`);
        lines.push(`   ${insight.description}`);
        lines.push(`   Action: ${insight.suggestedAction}`);
      }
    }
    
    lines.push('');
    lines.push(`Confidence: ${(recommendation.confidence * 100).toFixed(0)}%`);
    lines.push(`Valid Until: ${recommendation.validUntil}`);
    
    return lines.join('\n');
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create default portfolio optimization engine
 */
export function createPortfolioOptimizationEngine(
  config?: Partial<PortfolioOptimizationConfig>
): PortfolioOptimizationEngine {
  return new PortfolioOptimizationEngine(config);
}

/**
 * Create conservative portfolio optimization engine
 */
export function createConservativePortfolioEngine(): PortfolioOptimizationEngine {
  return new PortfolioOptimizationEngine({
    defaultAllocationMethod: 'rule_based' as any,
    maxOptimizationIterations: 50,
  });
}

/**
 * Create aggressive portfolio optimization engine
 */
export function createAggressivePortfolioEngine(): PortfolioOptimizationEngine {
  return new PortfolioOptimizationEngine({
    defaultAllocationMethod: 'greedy' as any,
    maxOptimizationIterations: 200,
  });
}
