/**
 * Cost Optimization v1.6 - Module Index
 * 
 * Cost-aware SEO Action Optimization
 * 
 * Purpose: Choose SEO actions that deliver the highest value per cost
 * 
 * Components:
 * - CostEstimator: Estimate costs across dimensions (token, compute, effort, risk)
 * - ValueEstimator: Estimate expected value (traffic, ranking, risk reduction, brand)
 * - ROIScorer: Calculate and rank actions by ROI
 * - BudgetConstraintSolver: Optimize action selection under constraints
 * - CostFeedbackUpdater: Learn from execution feedback
 * 
 * Design Principles:
 * - Deterministic calculations
 * - Explainable cost assumptions
 * - No hidden multipliers
 * - Respect all prior guardrails (v1.1–v1.4)
 */

// ============================================================================
// MODELS
// ============================================================================

export {
  // Cost types
  CostCategory,
  TokenCost,
  TokenOperationType,
  ComputeCost,
  EffortCost,
  RiskCost,
  ActionCostBreakdown,
  CostAssumption,
  
  // Value types
  ValueCategory,
  TrafficValue,
  RankingValue,
  RiskReductionValue,
  BrandValue,
  ActionValueBreakdown,
  ValueAssumption,
  
  // ROI types
  ROIStrategy,
  ROIWeights,
  STRATEGY_WEIGHTS,
  ActionROIScore,
  
  // Budget types
  BudgetConstraint,
  BudgetConstraintType,
  BudgetProfile,
  DEFAULT_BUDGET_PROFILES,
  ActionSelectionDecision,
  OptimizedActionPlan,
  
  // Feedback types
  CostFeedbackRecord,
  CostHeuristics,
  
  // Configuration
  CostOptimizationConfig,
  DEFAULT_COST_OPTIMIZATION_CONFIG,
  
  // Reporting
  CostOptimizationReport,
} from './models';

// ============================================================================
// ESTIMATORS
// ============================================================================

export {
  CostEstimator,
  TokenCostEstimator,
  ComputeCostEstimator,
  EffortCostEstimator,
  RiskCostEstimator,
  SEOActionInput,
  createCostEstimator,
} from './cost_estimator';

export {
  ValueEstimator,
  SEOActionForValue,
  CurrentStateInput,
  SimulationDataInput,
  createValueEstimator,
} from './value_estimator';

// ============================================================================
// SCORING & OPTIMIZATION
// ============================================================================

export {
  ROIScorer,
  createROIScorer,
  createTrafficFocusedScorer,
  createRiskAverseScorer,
  createBrandFirstScorer,
  createQuickWinsScorer,
  createHighImpactScorer,
} from './roi_scorer';

export {
  BudgetConstraintSolver,
  ActionInput,
  createBudgetSolver,
  createConservativeSolver,
  createAggressiveSolver,
} from './budget_solver';

// ============================================================================
// FEEDBACK
// ============================================================================

export {
  CostFeedbackUpdater,
  ActualCostInput,
  ActualValueInput,
  createFeedbackUpdater,
} from './feedback_updater';

// ============================================================================
// COST OPTIMIZATION ENGINE (ORCHESTRATOR)
// ============================================================================

import {
  ActionCostBreakdown,
  ActionValueBreakdown,
  ActionROIScore,
  OptimizedActionPlan,
  ROIStrategy,
  BudgetProfile,
  CostOptimizationConfig,
  DEFAULT_COST_OPTIMIZATION_CONFIG,
  CostOptimizationReport,
  ValueCategory,
  CostCategory,
} from './models';

import { CostEstimator, SEOActionInput } from './cost_estimator';
import { ValueEstimator, SEOActionForValue, CurrentStateInput, SimulationDataInput } from './value_estimator';
import { ROIScorer } from './roi_scorer';
import { BudgetConstraintSolver, ActionInput } from './budget_solver';
import { CostFeedbackUpdater, ActualCostInput, ActualValueInput } from './feedback_updater';

/**
 * Unified action input combining cost and value inputs
 */
export interface SEOActionFullInput {
  id: string;
  type: string;
  title: string;
  targetUrl?: string;
  targetKeyword?: string;
  pageCount?: number;
  scopeMultiplier?: number;
  model?: string;
  priority?: number;
  requiredDependencies?: string[];
  expectedImpact?: {
    metric: string;
    estimatedChange: number;
    confidence: 'low' | 'medium' | 'high';
    timeToResult: string;
  };
}

/**
 * Main orchestrator for cost-aware SEO optimization
 */
export class CostOptimizationEngine {
  private costEstimator: CostEstimator;
  private valueEstimator: ValueEstimator;
  private roiScorer: ROIScorer;
  private budgetSolver: BudgetConstraintSolver;
  private feedbackUpdater: CostFeedbackUpdater;
  private logger: Console;
  
  constructor(
    config: Partial<CostOptimizationConfig> = {},
    strategy: ROIStrategy = ROIStrategy.BALANCED,
    budgetProfile?: BudgetProfile
  ) {
    const fullConfig = { ...DEFAULT_COST_OPTIMIZATION_CONFIG, ...config };
    
    this.costEstimator = new CostEstimator(fullConfig);
    this.valueEstimator = new ValueEstimator(fullConfig);
    this.roiScorer = new ROIScorer(strategy);
    this.budgetSolver = new BudgetConstraintSolver(budgetProfile);
    this.feedbackUpdater = new CostFeedbackUpdater();
    this.logger = console;
  }
  
  /**
   * Set ROI strategy
   */
  setStrategy(strategy: ROIStrategy): void {
    this.roiScorer.setStrategy(strategy);
  }
  
  /**
   * Set budget profile
   */
  setBudgetProfile(profile: BudgetProfile): void {
    this.budgetSolver.setProfile(profile);
  }
  
  /**
   * Set budget profile from preset
   */
  setBudgetPreset(preset: 'conservative' | 'moderate' | 'aggressive'): void {
    this.budgetSolver.setProfilePreset(preset);
  }
  
  /**
   * Load heuristics from historical feedback
   */
  loadHeuristics(json: string): void {
    this.feedbackUpdater.importHeuristics(json);
    this.costEstimator.updateHeuristics(this.feedbackUpdater.getAllHeuristics());
  }
  
  /**
   * Run full cost optimization pipeline
   * 
   * 1. Estimate costs for all actions
   * 2. Estimate values for all actions
   * 3. Calculate ROI scores
   * 4. Optimize selection under budget constraints
   * 5. Generate report
   */
  async optimize(
    projectId: string,
    actions: SEOActionFullInput[],
    currentState: CurrentStateInput,
    simulationDataMap?: Map<string, SimulationDataInput>,
    optimizationMethod: 'greedy' | 'knapsack' | 'rule_based' = 'greedy'
  ): Promise<{
    costs: Map<string, ActionCostBreakdown>;
    values: Map<string, ActionValueBreakdown>;
    roiScores: ActionROIScore[];
    plan: OptimizedActionPlan;
    report: CostOptimizationReport;
  }> {
    this.logger.log(`[CostEngine] Starting optimization for ${actions.length} actions`);
    const startTime = Date.now();
    
    // Step 1: Estimate costs
    this.logger.log('[CostEngine] Step 1: Estimating costs');
    const costInputs: SEOActionInput[] = actions.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      targetUrl: a.targetUrl,
      pageCount: a.pageCount,
      scopeMultiplier: a.scopeMultiplier,
      model: a.model,
      currentMetrics: {
        monthlyTraffic: currentState.monthlyTraffic,
        avgPosition: currentState.avgPosition,
        brandScore: currentState.currentBrandScore,
      },
    }));
    
    const costs = this.costEstimator.estimateMultipleActions(costInputs);
    
    // Step 2: Estimate values
    this.logger.log('[CostEngine] Step 2: Estimating values');
    const valueInputs: SEOActionForValue[] = actions.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      targetKeyword: a.targetKeyword,
      targetUrl: a.targetUrl,
      expectedImpact: a.expectedImpact,
    }));
    
    const values = this.valueEstimator.estimateMultipleActions(
      valueInputs,
      currentState,
      simulationDataMap
    );
    
    // Step 3: Calculate ROI scores
    this.logger.log('[CostEngine] Step 3: Calculating ROI scores');
    const roiScores = this.roiScorer.calculateMultipleROI(costs, values);
    
    // Step 4: Optimize selection under budget constraints
    this.logger.log('[CostEngine] Step 4: Optimizing selection');
    const actionInputs: ActionInput[] = actions.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      priority: a.priority,
      requiredDependencies: a.requiredDependencies,
    }));
    
    const plan = this.budgetSolver.solve(
      actionInputs,
      costs,
      values,
      roiScores,
      optimizationMethod
    );
    plan.projectId = projectId;
    
    // Step 5: Generate report
    this.logger.log('[CostEngine] Step 5: Generating report');
    const report = this.generateReport(projectId, actions, costs, values, roiScores, plan);
    
    const duration = Date.now() - startTime;
    this.logger.log(`[CostEngine] Optimization complete in ${duration}ms`);
    
    return { costs, values, roiScores, plan, report };
  }
  
  /**
   * Record feedback after action execution
   */
  recordFeedback(
    actionId: string,
    actionType: string,
    projectId: string,
    estimatedCost: ActionCostBreakdown,
    actualCost: ActualCostInput,
    estimatedValue: ActionValueBreakdown,
    actualValue: ActualValueInput
  ): void {
    const record = this.feedbackUpdater.recordFeedback(
      actionId,
      actionType,
      projectId,
      estimatedCost,
      actualCost,
      estimatedValue,
      actualValue
    );
    
    // Update cost estimator with new heuristics
    this.costEstimator.updateHeuristics(this.feedbackUpdater.getAllHeuristics());
    
    this.logger.log(`[CostEngine] Recorded feedback for ${actionId}, accuracy: ${(record.overallAccuracy * 100).toFixed(0)}%`);
  }
  
  /**
   * Get cost breakdown for a single action
   */
  getCostBreakdown(action: SEOActionInput): ActionCostBreakdown {
    return this.costEstimator.estimateActionCost(action);
  }
  
  /**
   * Get value breakdown for a single action
   */
  getValueBreakdown(
    action: SEOActionForValue,
    currentState: CurrentStateInput,
    simulationData?: SimulationDataInput
  ): ActionValueBreakdown {
    return this.valueEstimator.estimateActionValue(action, currentState, simulationData);
  }
  
  /**
   * Get ROI score for a single action
   */
  getROIScore(
    cost: ActionCostBreakdown,
    value: ActionValueBreakdown
  ): ActionROIScore {
    return this.roiScorer.calculateROI(cost, value);
  }
  
  /**
   * Export feedback heuristics for persistence
   */
  exportHeuristics(): string {
    return this.feedbackUpdater.exportHeuristics();
  }
  
  /**
   * Get accuracy statistics
   */
  getAccuracyStatistics(actionType?: string) {
    return this.feedbackUpdater.getAccuracyStatistics(actionType);
  }
  
  /**
   * Generate cost optimization report
   */
  private generateReport(
    projectId: string,
    actions: SEOActionFullInput[],
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>,
    roiScores: ActionROIScore[],
    plan: OptimizedActionPlan
  ): CostOptimizationReport {
    // Calculate totals
    let totalEstimatedCost = 0;
    let totalExpectedValue = 0;
    const costByCategory: Record<CostCategory, number> = {
      [CostCategory.TOKEN]: 0,
      [CostCategory.COMPUTE]: 0,
      [CostCategory.EFFORT]: 0,
      [CostCategory.RISK]: 0,
    };
    const valueByCategory: Record<ValueCategory, number> = {
      [ValueCategory.TRAFFIC]: 0,
      [ValueCategory.RANKING]: 0,
      [ValueCategory.RISK_REDUCTION]: 0,
      [ValueCategory.BRAND]: 0,
      [ValueCategory.TECHNICAL]: 0,
    };
    
    for (const decision of plan.selectedActions) {
      const cost = costs.get(decision.actionId);
      const value = values.get(decision.actionId);
      
      if (cost) {
        totalEstimatedCost += cost.totalCost;
        for (const [cat, val] of Object.entries(cost.costPerCategory)) {
          costByCategory[cat as CostCategory] += val;
        }
      }
      
      if (value) {
        totalExpectedValue += value.totalValue;
        for (const [cat, val] of Object.entries(value.valuePerCategory)) {
          valueByCategory[cat as ValueCategory] += val;
        }
      }
    }
    
    // ROI statistics
    const selectedROIs = roiScores.filter(
      s => plan.selectedActions.some(d => d.actionId === s.actionId)
    );
    const roiStats = this.roiScorer.getROIStatistics(selectedROIs);
    
    // Top actions by ROI
    const topActionsByROI = selectedROIs
      .sort((a, b) => b.rawROI - a.rawROI)
      .slice(0, 5)
      .map(s => {
        const action = actions.find(a => a.id === s.actionId);
        return {
          actionId: s.actionId,
          title: action?.title || s.actionId,
          roi: s.rawROI,
          reason: s.reasoning[0] || '',
        };
      });
    
    // Rejected actions
    const rejectedActions = plan.rejectedActions.slice(0, 5).map(d => {
      const action = actions.find(a => a.id === d.actionId);
      return {
        actionId: d.actionId,
        title: action?.title || d.actionId,
        reason: d.reason,
      };
    });
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(plan, roiStats);
    
    // Generate warnings
    const warnings = [...plan.warnings];
    if (roiStats.avgROI < 1.0) {
      warnings.push('Average ROI is below 1.0 - consider reviewing action selection');
    }
    
    return {
      id: `report_${projectId}_${Date.now()}`,
      projectId,
      generatedAt: new Date().toISOString(),
      totalActionsEvaluated: actions.length,
      actionsSelected: plan.selectedActions.length,
      actionsRejected: plan.rejectedActions.length,
      totalEstimatedCost,
      costByCategory,
      budgetUtilization: this.calculateBudgetUtilization(plan),
      totalExpectedValue,
      valueByCategory,
      portfolioROI: plan.planROI,
      avgActionROI: roiStats.avgROI,
      roiDistribution: roiStats.tierDistribution,
      topActionsByROI,
      rejectedActions,
      recommendations,
      warnings,
    };
  }
  
  /**
   * Calculate overall budget utilization
   */
  private calculateBudgetUtilization(plan: OptimizedActionPlan): number {
    const utilizations = Object.values(plan.constraintUtilization);
    if (utilizations.length === 0) return 0;
    return utilizations.reduce((sum, u) => sum + u.percent, 0) / utilizations.length;
  }
  
  /**
   * Generate recommendations based on plan
   */
  private generateRecommendations(
    plan: OptimizedActionPlan,
    roiStats: ReturnType<ROIScorer['getROIStatistics']>
  ): string[] {
    const recommendations: string[] = [];
    
    if (plan.selectedActions.length === 0) {
      recommendations.push('No actions selected - consider increasing budget or lowering ROI threshold');
    }
    
    if (roiStats.tierDistribution.excellent > 0) {
      recommendations.push(`Prioritize ${roiStats.tierDistribution.excellent} excellent-ROI actions for maximum impact`);
    }
    
    if (roiStats.tierDistribution.poor > 2) {
      recommendations.push('Consider removing low-ROI actions to focus resources on high-value opportunities');
    }
    
    const avgUtilization = this.calculateBudgetUtilization(plan);
    if (avgUtilization < 50) {
      recommendations.push('Budget underutilized - consider adding more actions or increasing scope');
    } else if (avgUtilization > 90) {
      recommendations.push('Budget nearly exhausted - monitor closely during execution');
    }
    
    if (plan.executionOrder.length > 5) {
      recommendations.push(`Execute actions in recommended order: ${plan.executionOrder.slice(0, 3).join(' → ')}...`);
    }
    
    return recommendations;
  }
  
  /**
   * Explain why an action was selected or rejected
   */
  explainActionDecision(
    actionId: string,
    plan: OptimizedActionPlan,
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>,
    roiScores: ActionROIScore[]
  ): string {
    const decision = plan.selectedActions.find(d => d.actionId === actionId) ||
                     plan.rejectedActions.find(d => d.actionId === actionId);
    
    if (!decision) {
      return `Action ${actionId} not found in optimization plan.`;
    }
    
    const cost = costs.get(actionId);
    const value = values.get(actionId);
    const score = roiScores.find(s => s.actionId === actionId);
    
    let explanation = `Action ${actionId}:\n`;
    explanation += `- Decision: ${decision.selected ? 'SELECTED' : 'REJECTED'}\n`;
    explanation += `- Reason: ${decision.reason}\n`;
    
    if (cost) {
      explanation += `\nCost Breakdown:\n`;
      explanation += `  - Token cost: ${cost.tokenCost.totalTokens.toLocaleString()} tokens\n`;
      explanation += `  - Effort cost: ${cost.effortCost.totalHours.toFixed(1)} hours\n`;
      explanation += `  - Risk cost: ${(cost.riskCost.riskProbability * 100).toFixed(0)}% risk probability\n`;
      explanation += `  - Total cost: ${cost.totalCost.toFixed(1)} units\n`;
    }
    
    if (value) {
      explanation += `\nValue Breakdown:\n`;
      explanation += `  - Traffic value: ${value.trafficValue.expectedVisitors.toLocaleString()} visitors\n`;
      explanation += `  - Ranking value: ${value.rankingValue.avgPositionImprovement.toFixed(1)} positions\n`;
      explanation += `  - Risk reduction: ${value.riskReductionValue.riskReductionPercent.toFixed(0)}%\n`;
      explanation += `  - Total value: ${value.totalValue.toFixed(1)} units\n`;
    }
    
    if (score) {
      explanation += `\nROI Analysis:\n`;
      explanation += `  - Raw ROI: ${score.rawROI.toFixed(2)}\n`;
      explanation += `  - Weighted ROI: ${score.weightedROI.toFixed(2)}\n`;
      explanation += `  - Tier: ${score.tier}\n`;
      explanation += `  - Rank: #${score.rank}\n`;
      explanation += `  - Reasoning:\n`;
      for (const reason of score.reasoning) {
        explanation += `    • ${reason}\n`;
      }
    }
    
    return explanation;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createCostOptimizationEngine(
  config?: Partial<CostOptimizationConfig>,
  strategy?: ROIStrategy,
  budgetProfile?: BudgetProfile
): CostOptimizationEngine {
  return new CostOptimizationEngine(config, strategy, budgetProfile);
}
