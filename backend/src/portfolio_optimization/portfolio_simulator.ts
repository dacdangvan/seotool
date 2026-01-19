/**
 * Portfolio Simulator v1.7
 * 
 * Simulates portfolio outcomes under different allocation scenarios.
 * Uses v1.5 Scenario Simulation outputs at the project level.
 * 
 * Scenarios:
 * - BASELINE: Current allocation
 * - REBALANCE: Optimized rebalancing
 * - INCREASE_BUDGET: More resources
 * - DECREASE_BUDGET: Reduced resources
 * - SHIFT_TO_PROJECT: Move budget to specific project
 * - REDUCE_RISK: Lower overall portfolio risk
 * - MAXIMIZE_GROWTH: Aggressive growth allocation
 * 
 * Design Principles:
 * - Always compare to baseline
 * - Show trade-offs between projects
 * - Transparent assumptions
 * - Confidence intervals
 */

import {
  ProjectMetrics,
  NormalizedProjectMetrics,
  ProjectClassificationResult,
  PortfolioConstraints,
  PortfolioAllocation,
  ProjectAllocation,
  PortfolioScenario,
  PortfolioScenarioType,
  PortfolioSimulationResult,
  ProjectSimulationProjection,
  PortfolioTradeOff,
  SimulationAssumption,
  AllocationChange,
  PortfolioStrategy,
  PortfolioOptimizationConfig,
  DEFAULT_PORTFOLIO_CONFIG,
  ProjectionRange,
} from './models';

import { PortfolioOptimizer } from './portfolio_optimizer';

// ============================================================================
// SIMULATION PARAMETERS
// ============================================================================

interface SimulationParameters {
  // Budget scenarios
  budgetIncreasePercent: number;
  budgetDecreasePercent: number;
  
  // Response curves
  roiElasticity: number;      // How much ROI changes with budget
  riskElasticity: number;     // How much risk changes with budget
  trafficElasticity: number;  // How much traffic changes with budget
  
  // Diminishing returns
  diminishingReturnsThreshold: number; // Budget % above which returns diminish
  diminishingReturnsFactor: number;    // How much returns diminish
  
  // Confidence
  baseConfidence: number;
  confidenceDecayPerProjection: number;
}

const DEFAULT_SIMULATION_PARAMS: SimulationParameters = {
  budgetIncreasePercent: 0.25,
  budgetDecreasePercent: 0.25,
  roiElasticity: 0.7,
  riskElasticity: 0.4,
  trafficElasticity: 0.6,
  diminishingReturnsThreshold: 0.4,
  diminishingReturnsFactor: 0.5,
  baseConfidence: 0.8,
  confidenceDecayPerProjection: 0.05,
};

// ============================================================================
// PORTFOLIO SIMULATOR
// ============================================================================

/**
 * Simulates portfolio outcomes under different scenarios
 */
export class PortfolioSimulator {
  private config: PortfolioOptimizationConfig;
  private params: SimulationParameters;
  private optimizer: PortfolioOptimizer;
  private logger: Console;
  
  constructor(
    config: Partial<PortfolioOptimizationConfig> = {},
    params: Partial<SimulationParameters> = {}
  ) {
    this.config = { ...DEFAULT_PORTFOLIO_CONFIG, ...config };
    this.params = { ...DEFAULT_SIMULATION_PARAMS, ...params };
    this.optimizer = new PortfolioOptimizer(config);
    this.logger = console;
  }
  
  // ==========================================================================
  // MAIN SIMULATION
  // ==========================================================================
  
  /**
   * Generate and simulate standard scenarios
   */
  simulateStandardScenarios(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints
  ): { scenarios: PortfolioScenario[]; results: Map<string, PortfolioSimulationResult> } {
    const scenarios: PortfolioScenario[] = [];
    const results = new Map<string, PortfolioSimulationResult>();
    
    // Generate baseline scenario
    const baselineScenario = this.createBaselineScenario(currentAllocation);
    scenarios.push(baselineScenario);
    const baselineResult = this.simulateScenario(
      baselineScenario, projects, normalizedMetrics, classifications, currentAllocation, constraints
    );
    results.set(baselineScenario.id, baselineResult);
    
    // Generate rebalance scenario
    const rebalanceScenario = this.createRebalanceScenario(
      projects, normalizedMetrics, classifications, currentAllocation, constraints
    );
    scenarios.push(rebalanceScenario);
    results.set(rebalanceScenario.id, this.simulateScenario(
      rebalanceScenario, projects, normalizedMetrics, classifications, currentAllocation, constraints
    ));
    
    // Generate increase budget scenario
    const increaseBudgetScenario = this.createBudgetChangeScenario(
      currentAllocation, constraints, this.params.budgetIncreasePercent, 'increase'
    );
    scenarios.push(increaseBudgetScenario);
    results.set(increaseBudgetScenario.id, this.simulateScenario(
      increaseBudgetScenario, projects, normalizedMetrics, classifications, currentAllocation, constraints
    ));
    
    // Generate decrease budget scenario
    const decreaseBudgetScenario = this.createBudgetChangeScenario(
      currentAllocation, constraints, this.params.budgetDecreasePercent, 'decrease'
    );
    scenarios.push(decreaseBudgetScenario);
    results.set(decreaseBudgetScenario.id, this.simulateScenario(
      decreaseBudgetScenario, projects, normalizedMetrics, classifications, currentAllocation, constraints
    ));
    
    // Generate reduce risk scenario
    const reduceRiskScenario = this.createReduceRiskScenario(
      projects, normalizedMetrics, classifications, currentAllocation, constraints
    );
    scenarios.push(reduceRiskScenario);
    results.set(reduceRiskScenario.id, this.simulateScenario(
      reduceRiskScenario, projects, normalizedMetrics, classifications, currentAllocation, constraints
    ));
    
    // Generate maximize growth scenario
    const maxGrowthScenario = this.createMaxGrowthScenario(
      projects, normalizedMetrics, classifications, currentAllocation, constraints
    );
    scenarios.push(maxGrowthScenario);
    results.set(maxGrowthScenario.id, this.simulateScenario(
      maxGrowthScenario, projects, normalizedMetrics, classifications, currentAllocation, constraints
    ));
    
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioSimulator] Generated ${scenarios.length} scenarios`);
    }
    
    return { scenarios, results };
  }
  
  /**
   * Simulate a custom scenario
   */
  simulateCustomScenario(
    scenario: PortfolioScenario,
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints
  ): PortfolioSimulationResult {
    return this.simulateScenario(
      scenario, projects, normalizedMetrics, classifications, currentAllocation, constraints
    );
  }
  
  // ==========================================================================
  // SCENARIO CREATION
  // ==========================================================================
  
  private createBaselineScenario(currentAllocation: PortfolioAllocation): PortfolioScenario {
    return {
      id: `scenario-baseline-${Date.now()}`,
      name: 'Baseline (Current Allocation)',
      description: 'Continue with current resource allocation',
      type: PortfolioScenarioType.BASELINE,
      allocationChanges: [],
      parameters: {},
      createdAt: new Date().toISOString(),
    };
  }
  
  private createRebalanceScenario(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints
  ): PortfolioScenario {
    // Get optimized allocation
    const optimizedAllocation = this.optimizer.optimizeAllocation(
      projects,
      normalizedMetrics,
      classifications,
      constraints,
      PortfolioStrategy.BALANCED_GROWTH
    );
    
    // Calculate changes
    const changes = this.calculateAllocationChanges(currentAllocation, optimizedAllocation);
    
    return {
      id: `scenario-rebalance-${Date.now()}`,
      name: 'Optimized Rebalancing',
      description: 'Rebalance portfolio based on current metrics and classifications',
      type: PortfolioScenarioType.REBALANCE,
      allocationChanges: changes,
      parameters: {},
      createdAt: new Date().toISOString(),
    };
  }
  
  private createBudgetChangeScenario(
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints,
    changePercent: number,
    direction: 'increase' | 'decrease'
  ): PortfolioScenario {
    const multiplier = direction === 'increase' ? 1 + changePercent : 1 - changePercent;
    
    const changes: AllocationChange[] = currentAllocation.projectAllocations.map(alloc => ({
      projectId: alloc.projectId,
      previousAllocation: alloc.totalAllocationPercent,
      newAllocation: alloc.totalAllocationPercent * multiplier,
      changePercent: (multiplier - 1) * 100,
      reason: `${direction === 'increase' ? 'Increased' : 'Decreased'} budget by ${(changePercent * 100).toFixed(0)}%`,
    }));
    
    return {
      id: `scenario-${direction}-budget-${Date.now()}`,
      name: direction === 'increase' ? 'Increased Budget (+25%)' : 'Decreased Budget (-25%)',
      description: `${direction === 'increase' ? 'Increase' : 'Decrease'} total budget by ${(changePercent * 100).toFixed(0)}%`,
      type: direction === 'increase' ? PortfolioScenarioType.INCREASE_BUDGET : PortfolioScenarioType.DECREASE_BUDGET,
      allocationChanges: changes,
      parameters: { budgetChange: direction === 'increase' ? changePercent : -changePercent },
      createdAt: new Date().toISOString(),
    };
  }
  
  private createReduceRiskScenario(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints
  ): PortfolioScenario {
    // Reduce allocation to high-risk projects
    const changes: AllocationChange[] = [];
    
    for (const alloc of currentAllocation.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === alloc.projectId);
      if (!normalized) continue;
      
      if (normalized.riskScore > 50) {
        // Reduce high-risk projects
        const reductionFactor = 1 - (normalized.riskScore / 200); // 50 risk = 25% reduction
        changes.push({
          projectId: alloc.projectId,
          previousAllocation: alloc.totalAllocationPercent,
          newAllocation: alloc.totalAllocationPercent * reductionFactor,
          changePercent: (reductionFactor - 1) * 100,
          reason: `Reduced allocation due to high risk score (${normalized.riskScore.toFixed(0)})`,
        });
      } else {
        // Increase low-risk projects proportionally
        changes.push({
          projectId: alloc.projectId,
          previousAllocation: alloc.totalAllocationPercent,
          newAllocation: alloc.totalAllocationPercent * 1.1,
          changePercent: 10,
          reason: `Increased allocation due to low risk score (${normalized.riskScore.toFixed(0)})`,
        });
      }
    }
    
    return {
      id: `scenario-reduce-risk-${Date.now()}`,
      name: 'Reduce Portfolio Risk',
      description: 'Shift allocation from high-risk to low-risk projects',
      type: PortfolioScenarioType.REDUCE_RISK,
      allocationChanges: changes,
      parameters: { riskReduction: 0.2 },
      createdAt: new Date().toISOString(),
    };
  }
  
  private createMaxGrowthScenario(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints
  ): PortfolioScenario {
    // Increase allocation to high-growth projects
    const changes: AllocationChange[] = [];
    
    for (const alloc of currentAllocation.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === alloc.projectId);
      if (!normalized) continue;
      
      if (normalized.growthScore > 60) {
        // Increase high-growth projects
        const increaseFactor = 1 + (normalized.growthScore / 200); // 80 growth = 40% increase
        changes.push({
          projectId: alloc.projectId,
          previousAllocation: alloc.totalAllocationPercent,
          newAllocation: Math.min(0.5, alloc.totalAllocationPercent * increaseFactor),
          changePercent: (increaseFactor - 1) * 100,
          reason: `Increased allocation due to high growth score (${normalized.growthScore.toFixed(0)})`,
        });
      } else {
        // Reduce low-growth projects
        changes.push({
          projectId: alloc.projectId,
          previousAllocation: alloc.totalAllocationPercent,
          newAllocation: alloc.totalAllocationPercent * 0.8,
          changePercent: -20,
          reason: `Reduced allocation due to low growth score (${normalized.growthScore.toFixed(0)})`,
        });
      }
    }
    
    return {
      id: `scenario-max-growth-${Date.now()}`,
      name: 'Maximize Growth',
      description: 'Shift allocation toward high-growth potential projects',
      type: PortfolioScenarioType.MAXIMIZE_GROWTH,
      allocationChanges: changes,
      parameters: { growthTarget: 0.3 },
      createdAt: new Date().toISOString(),
    };
  }
  
  // ==========================================================================
  // SIMULATION EXECUTION
  // ==========================================================================
  
  private simulateScenario(
    scenario: PortfolioScenario,
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    constraints: PortfolioConstraints
  ): PortfolioSimulationResult {
    // Calculate new allocations based on scenario changes
    const newAllocations = this.applyAllocationChanges(
      currentAllocation.projectAllocations,
      scenario.allocationChanges
    );
    
    // Simulate each project
    const projectProjections: ProjectSimulationProjection[] = [];
    let totalCurrentTraffic = 0;
    let totalProjectedTraffic = 0;
    let weightedROI = 0;
    let weightedRisk = 0;
    let totalWeight = 0;
    
    for (const project of projects) {
      const currentAlloc = currentAllocation.projectAllocations.find(a => a.projectId === project.projectId);
      const newAlloc = newAllocations.find(a => a.projectId === project.projectId);
      const normalized = normalizedMetrics.find(n => n.projectId === project.projectId);
      
      if (!currentAlloc || !newAlloc || !normalized) continue;
      
      const projection = this.simulateProjectOutcome(
        project,
        normalized,
        currentAlloc.totalAllocationPercent,
        newAlloc.totalAllocationPercent
      );
      
      projectProjections.push(projection);
      
      totalCurrentTraffic += project.traffic.currentMonthlyTraffic;
      totalProjectedTraffic += project.traffic.currentMonthlyTraffic * (1 + projection.projectedTrafficChange / 100);
      weightedROI += projection.projectedROI * newAlloc.totalAllocationPercent;
      weightedRisk += (normalized.riskScore + projection.projectedRiskChange) * newAlloc.totalAllocationPercent;
      totalWeight += newAlloc.totalAllocationPercent;
    }
    
    // Calculate portfolio-level projections
    const projectedPortfolioROI = totalWeight > 0 ? weightedROI / totalWeight : 0;
    const projectedPortfolioRisk = totalWeight > 0 ? (weightedRisk / totalWeight) / 100 : 0;
    
    // Calculate baseline comparison
    const baselineROI = this.calculateBaselineROI(normalizedMetrics, currentAllocation);
    const baselineRisk = this.calculateBaselineRisk(normalizedMetrics, currentAllocation);
    const baselineTraffic = totalCurrentTraffic;
    
    // Identify trade-offs
    const tradeOffs = this.identifyTradeOffs(projectProjections, scenario);
    
    // Generate assumptions
    const assumptions = this.generateAssumptions(scenario);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(scenario, projectProjections);
    
    return {
      id: `result-${scenario.id}`,
      scenarioId: scenario.id,
      projectedPortfolioROI,
      projectedTotalTraffic: {
        low: totalProjectedTraffic * 0.8,
        mid: totalProjectedTraffic,
        high: totalProjectedTraffic * 1.2,
      },
      projectedPortfolioRisk,
      projectProjections,
      roiChangeFromBaseline: projectedPortfolioROI - baselineROI,
      trafficChangeFromBaseline: ((totalProjectedTraffic - baselineTraffic) / baselineTraffic) * 100,
      riskChangeFromBaseline: (projectedPortfolioRisk - baselineRisk) * 100,
      tradeOffs,
      overallConfidence: confidence,
      assumptions,
      simulatedAt: new Date().toISOString(),
    };
  }
  
  private simulateProjectOutcome(
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics,
    currentAllocationPercent: number,
    newAllocationPercent: number
  ): ProjectSimulationProjection {
    const allocationChange = newAllocationPercent - currentAllocationPercent;
    const allocationChangePercent = currentAllocationPercent > 0 
      ? (allocationChange / currentAllocationPercent) * 100 
      : 0;
    
    // Calculate traffic change (with diminishing returns)
    let trafficChange = allocationChangePercent * this.params.trafficElasticity;
    if (newAllocationPercent > this.params.diminishingReturnsThreshold) {
      const excess = newAllocationPercent - this.params.diminishingReturnsThreshold;
      trafficChange *= (1 - excess * this.params.diminishingReturnsFactor);
    }
    
    // Calculate ROI change
    let roiChange = allocationChangePercent * this.params.roiElasticity;
    // Increasing budget tends to decrease ROI efficiency
    if (allocationChange > 0) {
      roiChange *= 0.7; // Diminishing returns on ROI
    }
    const projectedROI = normalized.roiScore + roiChange;
    
    // Calculate risk change
    const riskChange = allocationChange > 0
      ? allocationChangePercent * this.params.riskElasticity * 0.1 // More budget = slightly more risk
      : allocationChangePercent * this.params.riskElasticity * -0.05; // Less budget = slightly less risk
    
    // Generate impact summary
    const impactSummary = this.generateImpactSummary(
      project.projectName,
      allocationChangePercent,
      trafficChange,
      riskChange
    );
    
    return {
      projectId: project.projectId,
      currentAllocation: currentAllocationPercent,
      scenarioAllocation: newAllocationPercent,
      projectedROI: Math.max(0, projectedROI),
      projectedTrafficChange: trafficChange,
      projectedRiskChange: riskChange,
      impactSummary,
    };
  }
  
  private generateImpactSummary(
    projectName: string,
    allocationChangePercent: number,
    trafficChange: number,
    riskChange: number
  ): string {
    if (Math.abs(allocationChangePercent) < 5) {
      return `${projectName}: Minimal change expected with current allocation`;
    }
    
    const direction = allocationChangePercent > 0 ? 'increased' : 'decreased';
    const trafficDirection = trafficChange > 0 ? 'increase' : 'decrease';
    
    return `${projectName}: ${direction} allocation by ${Math.abs(allocationChangePercent).toFixed(0)}%, ` +
           `expecting ${Math.abs(trafficChange).toFixed(1)}% traffic ${trafficDirection}` +
           (Math.abs(riskChange) > 2 ? `, ${Math.abs(riskChange).toFixed(1)}% risk change` : '');
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  private applyAllocationChanges(
    currentAllocations: ProjectAllocation[],
    changes: AllocationChange[]
  ): ProjectAllocation[] {
    return currentAllocations.map(alloc => {
      const change = changes.find(c => c.projectId === alloc.projectId);
      if (!change) return { ...alloc };
      
      return {
        ...alloc,
        totalAllocationPercent: change.newAllocation,
        tokenBudgetPercent: change.newAllocation,
        effortHoursPercent: change.newAllocation,
      };
    });
  }
  
  private calculateAllocationChanges(
    current: PortfolioAllocation,
    optimized: PortfolioAllocation
  ): AllocationChange[] {
    const changes: AllocationChange[] = [];
    
    for (const currentAlloc of current.projectAllocations) {
      const optimizedAlloc = optimized.projectAllocations.find(
        a => a.projectId === currentAlloc.projectId
      );
      
      if (!optimizedAlloc) continue;
      
      const changePercent = currentAlloc.totalAllocationPercent > 0
        ? ((optimizedAlloc.totalAllocationPercent - currentAlloc.totalAllocationPercent) / 
           currentAlloc.totalAllocationPercent) * 100
        : 0;
      
      if (Math.abs(changePercent) > 1) { // Only include significant changes
        changes.push({
          projectId: currentAlloc.projectId,
          previousAllocation: currentAlloc.totalAllocationPercent,
          newAllocation: optimizedAlloc.totalAllocationPercent,
          changePercent,
          reason: this.explainAllocationChange(currentAlloc, optimizedAlloc, changePercent),
        });
      }
    }
    
    return changes;
  }
  
  private explainAllocationChange(
    current: ProjectAllocation,
    optimized: ProjectAllocation,
    changePercent: number
  ): string {
    const direction = changePercent > 0 ? 'increased' : 'decreased';
    const absChange = Math.abs(changePercent);
    
    if (current.classification !== optimized.classification) {
      return `Classification changed from ${current.classification} to ${optimized.classification}`;
    }
    
    if (absChange > 50) {
      return `Significant ${direction} allocation based on optimization score`;
    }
    
    return `${direction} allocation by ${absChange.toFixed(0)}% to optimize portfolio`;
  }
  
  private calculateBaselineROI(
    normalizedMetrics: NormalizedProjectMetrics[],
    currentAllocation: PortfolioAllocation
  ): number {
    let weightedROI = 0;
    let totalWeight = 0;
    
    for (const alloc of currentAllocation.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === alloc.projectId);
      if (!normalized) continue;
      
      weightedROI += normalized.roiScore * alloc.totalAllocationPercent;
      totalWeight += alloc.totalAllocationPercent;
    }
    
    return totalWeight > 0 ? weightedROI / totalWeight : 0;
  }
  
  private calculateBaselineRisk(
    normalizedMetrics: NormalizedProjectMetrics[],
    currentAllocation: PortfolioAllocation
  ): number {
    let weightedRisk = 0;
    let totalWeight = 0;
    
    for (const alloc of currentAllocation.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === alloc.projectId);
      if (!normalized) continue;
      
      weightedRisk += normalized.riskScore * alloc.totalAllocationPercent;
      totalWeight += alloc.totalAllocationPercent;
    }
    
    return totalWeight > 0 ? (weightedRisk / totalWeight) / 100 : 0;
  }
  
  private identifyTradeOffs(
    projections: ProjectSimulationProjection[],
    scenario: PortfolioScenario
  ): PortfolioTradeOff[] {
    const tradeOffs: PortfolioTradeOff[] = [];
    
    // Find projects with increased allocation
    const increased = projections.filter(p => 
      p.scenarioAllocation > p.currentAllocation * 1.05
    );
    
    // Find projects with decreased allocation
    const decreased = projections.filter(p => 
      p.scenarioAllocation < p.currentAllocation * 0.95
    );
    
    // Generate trade-off descriptions
    for (const incr of increased) {
      for (const decr of decreased) {
        tradeOffs.push({
          description: `Budget shifted from ${decr.projectId} to ${incr.projectId}`,
          benefitProject: incr.projectId,
          costProject: decr.projectId,
          benefitMetric: 'traffic',
          costMetric: 'traffic',
          netImpact: incr.projectedTrafficChange > Math.abs(decr.projectedTrafficChange) 
            ? 'positive' 
            : 'negative',
          magnitude: Math.abs(incr.projectedTrafficChange) > 10 ? 'large' : 
                    Math.abs(incr.projectedTrafficChange) > 5 ? 'medium' : 'small',
        });
      }
    }
    
    // Add scenario-specific trade-offs
    if (scenario.type === PortfolioScenarioType.REDUCE_RISK) {
      tradeOffs.push({
        description: 'Reduced risk exposure may limit growth potential',
        benefitMetric: 'risk_reduction',
        costMetric: 'growth',
        netImpact: 'neutral',
        magnitude: 'medium',
      });
    }
    
    if (scenario.type === PortfolioScenarioType.MAXIMIZE_GROWTH) {
      tradeOffs.push({
        description: 'Aggressive growth strategy increases risk exposure',
        benefitMetric: 'growth',
        costMetric: 'risk',
        netImpact: 'neutral',
        magnitude: 'medium',
      });
    }
    
    return tradeOffs;
  }
  
  private generateAssumptions(scenario: PortfolioScenario): SimulationAssumption[] {
    const assumptions: SimulationAssumption[] = [
      {
        id: 'elasticity',
        description: 'Budget changes impact metrics with standard elasticity curves',
        sensitivity: 'high',
        basis: 'Historical portfolio performance data',
      },
      {
        id: 'diminishing-returns',
        description: 'Returns diminish above 40% allocation per project',
        sensitivity: 'medium',
        basis: 'Portfolio theory principles',
      },
      {
        id: 'no-external-changes',
        description: 'No major algorithm updates or market changes',
        sensitivity: 'high',
        basis: 'Ceteris paribus assumption',
      },
    ];
    
    if (scenario.type === PortfolioScenarioType.INCREASE_BUDGET) {
      assumptions.push({
        id: 'budget-availability',
        description: 'Additional budget can be effectively deployed',
        sensitivity: 'medium',
        basis: 'Resource availability assessment',
      });
    }
    
    if (scenario.type === PortfolioScenarioType.REDUCE_RISK) {
      assumptions.push({
        id: 'risk-correlation',
        description: 'Project risks are not perfectly correlated',
        sensitivity: 'medium',
        basis: 'Portfolio diversification theory',
      });
    }
    
    return assumptions;
  }
  
  private calculateConfidence(
    scenario: PortfolioScenario,
    projections: ProjectSimulationProjection[]
  ): number {
    let confidence = this.params.baseConfidence;
    
    // Reduce confidence for more drastic changes
    const avgAbsChange = projections.reduce(
      (sum, p) => sum + Math.abs(p.scenarioAllocation - p.currentAllocation), 0
    ) / projections.length;
    
    confidence -= avgAbsChange * 0.5;
    
    // Reduce confidence for riskier scenarios
    if (scenario.type === PortfolioScenarioType.MAXIMIZE_GROWTH) {
      confidence -= 0.1;
    }
    
    // Reduce confidence for major budget changes
    if (scenario.type === PortfolioScenarioType.INCREASE_BUDGET ||
        scenario.type === PortfolioScenarioType.DECREASE_BUDGET) {
      confidence -= 0.05;
    }
    
    return Math.max(0.3, Math.min(0.95, confidence));
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createPortfolioSimulator(
  config?: Partial<PortfolioOptimizationConfig>,
  params?: Partial<SimulationParameters>
): PortfolioSimulator {
  return new PortfolioSimulator(config, params);
}

/**
 * Create simulator with conservative parameters
 */
export function createConservativeSimulator(): PortfolioSimulator {
  return new PortfolioSimulator({}, {
    budgetIncreasePercent: 0.15,
    budgetDecreasePercent: 0.15,
    roiElasticity: 0.5,
    riskElasticity: 0.6,
    trafficElasticity: 0.4,
  });
}
