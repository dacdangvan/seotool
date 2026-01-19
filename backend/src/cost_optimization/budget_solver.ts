/**
 * Budget Constraint Solver v1.6
 * 
 * Optimizes action selection under budget constraints.
 * 
 * Constraint Types:
 * - Token budget (max LLM tokens)
 * - Compute budget (max compute cost)
 * - Effort hours (max human hours)
 * - Risk tolerance (max acceptable risk)
 * - Total cost budget
 * - Action count limit
 * 
 * Optimization Methods:
 * - Greedy: Select highest ROI actions that fit
 * - Knapsack: Optimize total value under constraints
 * - Rule-based: Apply business rules first, then optimize
 * 
 * Design Principles:
 * - Deterministic optimization
 * - Explainable selection decisions
 * - Constraint transparency
 */

import {
  BudgetConstraint,
  BudgetConstraintType,
  BudgetProfile,
  DEFAULT_BUDGET_PROFILES,
  ActionCostBreakdown,
  ActionValueBreakdown,
  ActionROIScore,
  ActionSelectionDecision,
  OptimizedActionPlan,
  CostCategory,
  ValueCategory,
  ROIStrategy,
} from './models';

// ============================================================================
// CONSTRAINT CHECKERS
// ============================================================================

interface ConstraintCheckResult {
  satisfied: boolean;
  remaining: number;
  utilizationPercent: number;
  message: string;
}

function checkConstraint(
  constraint: BudgetConstraint,
  additionalUsage: number
): ConstraintCheckResult {
  const newUsage = constraint.currentUsage + additionalUsage;
  const remaining = constraint.maxValue - newUsage;
  const utilizationPercent = (newUsage / constraint.maxValue) * 100;
  
  const satisfied = constraint.hardLimit 
    ? remaining >= 0 
    : remaining >= -constraint.maxValue * 0.1; // 10% soft overflow allowed
  
  const message = satisfied
    ? `${constraint.name}: ${newUsage.toFixed(1)} / ${constraint.maxValue} (${utilizationPercent.toFixed(0)}%)`
    : `${constraint.name} exceeded: ${newUsage.toFixed(1)} > ${constraint.maxValue}`;
  
  return { satisfied, remaining, utilizationPercent, message };
}

// ============================================================================
// BUDGET SOLVER
// ============================================================================

export interface ActionInput {
  id: string;
  type: string;
  title: string;
  priority?: number;
  requiredDependencies?: string[];
}

export class BudgetConstraintSolver {
  private profile: BudgetProfile;
  private logger: Console;
  
  constructor(profile?: BudgetProfile) {
    this.profile = profile || this.createDefaultProfile('moderate');
    this.logger = console;
  }
  
  /**
   * Create a default profile from presets
   */
  private createDefaultProfile(preset: 'conservative' | 'moderate' | 'aggressive'): BudgetProfile {
    const template = DEFAULT_BUDGET_PROFILES[preset];
    return {
      id: `profile_${preset}_${Date.now()}`,
      name: template.name || preset,
      constraints: template.constraints || [],
      strategy: template.strategy || ROIStrategy.BALANCED,
      minROIThreshold: template.minROIThreshold || 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Set budget profile
   */
  setProfile(profile: BudgetProfile): void {
    this.profile = profile;
    this.logger.log(`[BudgetSolver] Profile set: ${profile.name}`);
  }
  
  /**
   * Set profile from preset
   */
  setProfilePreset(preset: 'conservative' | 'moderate' | 'aggressive'): void {
    this.profile = this.createDefaultProfile(preset);
    this.logger.log(`[BudgetSolver] Using ${preset} preset`);
  }
  
  /**
   * Update a specific constraint
   */
  updateConstraint(constraintId: string, updates: Partial<BudgetConstraint>): void {
    const constraint = this.profile.constraints.find(c => c.id === constraintId);
    if (constraint) {
      Object.assign(constraint, updates);
      this.profile.updatedAt = new Date().toISOString();
    }
  }
  
  /**
   * Reset constraint usage
   */
  resetUsage(): void {
    for (const constraint of this.profile.constraints) {
      constraint.currentUsage = 0;
    }
  }
  
  /**
   * Solve optimization problem using the configured method
   */
  solve(
    actions: ActionInput[],
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>,
    roiScores: ActionROIScore[],
    method: 'greedy' | 'knapsack' | 'rule_based' = 'greedy'
  ): OptimizedActionPlan {
    this.logger.log(`[BudgetSolver] Solving with ${method} method for ${actions.length} actions`);
    
    // Reset usage before solving
    this.resetUsage();
    
    let result: {
      selected: ActionSelectionDecision[];
      rejected: ActionSelectionDecision[];
    };
    
    switch (method) {
      case 'greedy':
        result = this.solveGreedy(actions, costs, values, roiScores);
        break;
      case 'knapsack':
        result = this.solveKnapsack(actions, costs, values, roiScores);
        break;
      case 'rule_based':
        result = this.solveRuleBased(actions, costs, values, roiScores);
        break;
      default:
        result = this.solveGreedy(actions, costs, values, roiScores);
    }
    
    // Build optimized plan
    return this.buildOptimizedPlan(
      actions,
      costs,
      values,
      result.selected,
      result.rejected,
      method
    );
  }
  
  /**
   * Greedy optimization: Select highest ROI actions that fit
   */
  private solveGreedy(
    actions: ActionInput[],
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>,
    roiScores: ActionROIScore[]
  ): { selected: ActionSelectionDecision[]; rejected: ActionSelectionDecision[] } {
    const selected: ActionSelectionDecision[] = [];
    const rejected: ActionSelectionDecision[] = [];
    
    // Sort by ROI (descending)
    const sortedScores = [...roiScores].sort((a, b) => b.weightedROI - a.weightedROI);
    
    for (const score of sortedScores) {
      const action = actions.find(a => a.id === score.actionId);
      const cost = costs.get(score.actionId);
      const value = values.get(score.actionId);
      
      if (!action || !cost || !value) continue;
      
      // Check minimum ROI threshold
      if (score.rawROI < this.profile.minROIThreshold) {
        rejected.push({
          actionId: action.id,
          selected: false,
          reason: `ROI ${score.rawROI.toFixed(2)} below minimum threshold ${this.profile.minROIThreshold}`,
          roiScore: score.rawROI,
          costImpact: cost.totalCost,
          valueImpact: value.totalValue,
          constraintsAffected: [],
        });
        continue;
      }
      
      // Check if action fits within constraints
      const { fits, violatedConstraints, messages } = this.checkActionFits(cost);
      
      if (fits) {
        // Select action and update constraint usage
        this.updateConstraintUsage(cost);
        
        selected.push({
          actionId: action.id,
          selected: true,
          reason: `Selected: ROI ${score.rawROI.toFixed(2)} (${score.tier}), ${messages.join('; ')}`,
          roiScore: score.rawROI,
          costImpact: cost.totalCost,
          valueImpact: value.totalValue,
          constraintsAffected: this.profile.constraints.map(c => c.id),
        });
      } else {
        rejected.push({
          actionId: action.id,
          selected: false,
          reason: `Constraint violation: ${violatedConstraints.join(', ')}`,
          roiScore: score.rawROI,
          costImpact: cost.totalCost,
          valueImpact: value.totalValue,
          constraintsAffected: violatedConstraints,
        });
      }
    }
    
    return { selected, rejected };
  }
  
  /**
   * Knapsack optimization: Maximize total value under constraints
   * Uses a simplified 0/1 knapsack approach with the primary constraint
   */
  private solveKnapsack(
    actions: ActionInput[],
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>,
    roiScores: ActionROIScore[]
  ): { selected: ActionSelectionDecision[]; rejected: ActionSelectionDecision[] } {
    const selected: ActionSelectionDecision[] = [];
    const rejected: ActionSelectionDecision[] = [];
    
    // Find primary constraint (highest priority hard limit)
    const primaryConstraint = this.profile.constraints
      .filter(c => c.hardLimit)
      .sort((a, b) => b.priority - a.priority)[0];
    
    if (!primaryConstraint) {
      // No hard constraints, use greedy
      return this.solveGreedy(actions, costs, values, roiScores);
    }
    
    // Build items for knapsack
    const items = roiScores
      .filter(s => s.rawROI >= this.profile.minROIThreshold)
      .map(score => {
        const cost = costs.get(score.actionId);
        const value = values.get(score.actionId);
        return {
          actionId: score.actionId,
          score,
          cost: cost ? this.getCostForConstraint(cost, primaryConstraint.type) : Infinity,
          value: value?.totalValue || 0,
        };
      })
      .filter(item => item.cost !== Infinity);
    
    // Simple knapsack DP (for small action sets)
    const capacity = Math.floor(primaryConstraint.maxValue);
    const n = items.length;
    
    if (n === 0 || capacity <= 0) {
      return { selected: [], rejected: [] };
    }
    
    // DP table
    const dp: number[][] = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));
    
    for (let i = 1; i <= n; i++) {
      const item = items[i - 1];
      const itemCost = Math.ceil(item.cost);
      
      for (let w = 0; w <= capacity; w++) {
        if (itemCost <= w) {
          dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - itemCost] + item.value);
        } else {
          dp[i][w] = dp[i - 1][w];
        }
      }
    }
    
    // Backtrack to find selected items
    const selectedIds = new Set<string>();
    let w = capacity;
    for (let i = n; i > 0 && w > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) {
        const item = items[i - 1];
        selectedIds.add(item.actionId);
        w -= Math.ceil(item.cost);
      }
    }
    
    // Build selection decisions
    for (const item of items) {
      const action = actions.find(a => a.id === item.actionId);
      const cost = costs.get(item.actionId);
      const value = values.get(item.actionId);
      
      if (!action || !cost || !value) continue;
      
      if (selectedIds.has(item.actionId)) {
        // Verify all constraints still fit
        const { fits, violatedConstraints } = this.checkActionFits(cost);
        
        if (fits) {
          this.updateConstraintUsage(cost);
          selected.push({
            actionId: action.id,
            selected: true,
            reason: `Knapsack selected: ROI ${item.score.rawROI.toFixed(2)}, value ${item.value.toFixed(1)}`,
            roiScore: item.score.rawROI,
            costImpact: cost.totalCost,
            valueImpact: value.totalValue,
            constraintsAffected: [primaryConstraint.id],
          });
        } else {
          rejected.push({
            actionId: action.id,
            selected: false,
            reason: `Secondary constraint violation: ${violatedConstraints.join(', ')}`,
            roiScore: item.score.rawROI,
            costImpact: cost.totalCost,
            valueImpact: value.totalValue,
            constraintsAffected: violatedConstraints,
          });
        }
      } else {
        rejected.push({
          actionId: action.id,
          selected: false,
          reason: `Not selected by knapsack optimization`,
          roiScore: item.score.rawROI,
          costImpact: cost.totalCost,
          valueImpact: value.totalValue,
          constraintsAffected: [primaryConstraint.id],
        });
      }
    }
    
    return { selected, rejected };
  }
  
  /**
   * Rule-based optimization: Apply business rules first, then optimize remainder
   */
  private solveRuleBased(
    actions: ActionInput[],
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>,
    roiScores: ActionROIScore[]
  ): { selected: ActionSelectionDecision[]; rejected: ActionSelectionDecision[] } {
    const selected: ActionSelectionDecision[] = [];
    const rejected: ActionSelectionDecision[] = [];
    const processedIds = new Set<string>();
    
    // Rule 1: Always include high-priority actions with good ROI
    const highPriorityActions = actions.filter(a => (a.priority || 999) <= 1);
    for (const action of highPriorityActions) {
      const score = roiScores.find(s => s.actionId === action.id);
      const cost = costs.get(action.id);
      const value = values.get(action.id);
      
      if (!score || !cost || !value) continue;
      
      if (score.rawROI >= this.profile.minROIThreshold * 0.8) { // Slightly relaxed for high priority
        const { fits, violatedConstraints } = this.checkActionFits(cost);
        
        if (fits) {
          this.updateConstraintUsage(cost);
          selected.push({
            actionId: action.id,
            selected: true,
            reason: `High priority action (priority=${action.priority}), ROI ${score.rawROI.toFixed(2)}`,
            roiScore: score.rawROI,
            costImpact: cost.totalCost,
            valueImpact: value.totalValue,
            constraintsAffected: [],
          });
          processedIds.add(action.id);
        }
      }
    }
    
    // Rule 2: Include dependency chains
    for (const action of actions) {
      if (processedIds.has(action.id)) continue;
      if (!action.requiredDependencies?.length) continue;
      
      const allDepsSelected = action.requiredDependencies.every(
        depId => selected.some(s => s.actionId === depId)
      );
      
      if (allDepsSelected) {
        const score = roiScores.find(s => s.actionId === action.id);
        const cost = costs.get(action.id);
        const value = values.get(action.id);
        
        if (!score || !cost || !value) continue;
        
        const { fits } = this.checkActionFits(cost);
        if (fits && score.rawROI >= this.profile.minROIThreshold) {
          this.updateConstraintUsage(cost);
          selected.push({
            actionId: action.id,
            selected: true,
            reason: `Dependencies satisfied, ROI ${score.rawROI.toFixed(2)}`,
            roiScore: score.rawROI,
            costImpact: cost.totalCost,
            valueImpact: value.totalValue,
            constraintsAffected: [],
          });
          processedIds.add(action.id);
        }
      }
    }
    
    // Rule 3: Fill remaining capacity with greedy selection
    const remainingScores = roiScores
      .filter(s => !processedIds.has(s.actionId))
      .sort((a, b) => b.weightedROI - a.weightedROI);
    
    for (const score of remainingScores) {
      const action = actions.find(a => a.id === score.actionId);
      const cost = costs.get(score.actionId);
      const value = values.get(score.actionId);
      
      if (!action || !cost || !value) continue;
      
      if (score.rawROI < this.profile.minROIThreshold) {
        rejected.push({
          actionId: action.id,
          selected: false,
          reason: `ROI ${score.rawROI.toFixed(2)} below threshold`,
          roiScore: score.rawROI,
          costImpact: cost.totalCost,
          valueImpact: value.totalValue,
          constraintsAffected: [],
        });
        continue;
      }
      
      const { fits, violatedConstraints } = this.checkActionFits(cost);
      
      if (fits) {
        this.updateConstraintUsage(cost);
        selected.push({
          actionId: action.id,
          selected: true,
          reason: `Greedy fill: ROI ${score.rawROI.toFixed(2)}`,
          roiScore: score.rawROI,
          costImpact: cost.totalCost,
          valueImpact: value.totalValue,
          constraintsAffected: [],
        });
      } else {
        rejected.push({
          actionId: action.id,
          selected: false,
          reason: `Constraint violation: ${violatedConstraints.join(', ')}`,
          roiScore: score.rawROI,
          costImpact: cost.totalCost,
          valueImpact: value.totalValue,
          constraintsAffected: violatedConstraints,
        });
      }
    }
    
    return { selected, rejected };
  }
  
  /**
   * Check if action fits within constraints
   */
  private checkActionFits(cost: ActionCostBreakdown): {
    fits: boolean;
    violatedConstraints: string[];
    messages: string[];
  } {
    const violatedConstraints: string[] = [];
    const messages: string[] = [];
    
    for (const constraint of this.profile.constraints) {
      const usage = this.getCostForConstraint(cost, constraint.type);
      const result = checkConstraint(constraint, usage);
      
      messages.push(result.message);
      
      if (!result.satisfied) {
        violatedConstraints.push(constraint.id);
      }
    }
    
    return {
      fits: violatedConstraints.length === 0,
      violatedConstraints,
      messages,
    };
  }
  
  /**
   * Get cost value for a specific constraint type
   */
  private getCostForConstraint(cost: ActionCostBreakdown, type: BudgetConstraintType): number {
    switch (type) {
      case BudgetConstraintType.TOKEN_BUDGET:
        return cost.tokenCost.totalTokens;
      case BudgetConstraintType.COMPUTE_BUDGET:
        return cost.computeCost.totalCost;
      case BudgetConstraintType.EFFORT_HOURS:
        return cost.effortCost.totalHours;
      case BudgetConstraintType.RISK_TOLERANCE:
        return cost.riskCost.riskProbability;
      case BudgetConstraintType.TOTAL_COST:
        return cost.totalCost;
      case BudgetConstraintType.ACTION_COUNT:
        return 1;
      default:
        return cost.totalCost;
    }
  }
  
  /**
   * Update constraint usage after selecting an action
   */
  private updateConstraintUsage(cost: ActionCostBreakdown): void {
    for (const constraint of this.profile.constraints) {
      const usage = this.getCostForConstraint(cost, constraint.type);
      constraint.currentUsage += usage;
    }
  }
  
  /**
   * Build the optimized action plan
   */
  private buildOptimizedPlan(
    actions: ActionInput[],
    costs: Map<string, ActionCostBreakdown>,
    values: Map<string, ActionValueBreakdown>,
    selected: ActionSelectionDecision[],
    rejected: ActionSelectionDecision[],
    method: 'greedy' | 'knapsack' | 'rule_based'
  ): OptimizedActionPlan {
    // Calculate total cost and value
    const totalCost = this.aggregateCosts(selected, costs);
    const totalValue = this.aggregateValues(selected, values);
    
    // Calculate plan ROI
    const planROI = totalCost.totalCost > 0 
      ? totalValue.totalValue / totalCost.totalCost 
      : 0;
    
    // Calculate constraint utilization
    const constraintUtilization: OptimizedActionPlan['constraintUtilization'] = {};
    for (const constraint of this.profile.constraints) {
      constraintUtilization[constraint.id] = {
        used: constraint.currentUsage,
        max: constraint.maxValue,
        percent: (constraint.currentUsage / constraint.maxValue) * 100,
      };
    }
    
    // Determine execution order (by ROI, with dependencies first)
    const executionOrder = this.determineExecutionOrder(selected, actions);
    
    // Generate summary
    const summary = this.generateSummary(selected, rejected, planROI, method);
    
    // Generate warnings
    const warnings = this.generateWarnings(constraintUtilization, selected);
    
    return {
      id: `plan_${Date.now()}`,
      projectId: '',
      createdAt: new Date().toISOString(),
      budgetProfile: this.profile,
      selectedActions: selected,
      rejectedActions: rejected,
      totalCost,
      totalValue,
      planROI,
      constraintUtilization,
      optimizationMethod: method,
      executionOrder,
      summary,
      warnings,
    };
  }
  
  /**
   * Aggregate costs for selected actions
   */
  private aggregateCosts(
    selected: ActionSelectionDecision[],
    costs: Map<string, ActionCostBreakdown>
  ): ActionCostBreakdown {
    const aggregated: ActionCostBreakdown = {
      actionId: 'plan_total',
      actionType: 'aggregate',
      tokenCost: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0, model: 'mixed', operationType: 'content_analysis' as any },
      computeCost: { crawlCost: 0, auditCost: 0, embeddingCost: 0, processingCost: 0, storageCost: 0, totalCost: 0, estimatedDurationMs: 0 },
      effortCost: { engineeringHours: 0, contentHours: 0, reviewHours: 0, coordinationHours: 0, totalHours: 0, skillsRequired: [], complexity: 'medium' },
      riskCost: { rankingRiskCost: 0, trafficRiskCost: 0, penaltyRiskCost: 0, brandRiskCost: 0, technicalRiskCost: 0, totalRiskCost: 0, riskProbability: 0, expectedLoss: 0 },
      totalCost: 0,
      costPerCategory: { [CostCategory.TOKEN]: 0, [CostCategory.COMPUTE]: 0, [CostCategory.EFFORT]: 0, [CostCategory.RISK]: 0 },
      assumptions: [],
      estimatedAt: new Date().toISOString(),
    };
    
    const skills = new Set<string>();
    
    for (const decision of selected) {
      const cost = costs.get(decision.actionId);
      if (!cost) continue;
      
      aggregated.tokenCost.promptTokens += cost.tokenCost.promptTokens;
      aggregated.tokenCost.completionTokens += cost.tokenCost.completionTokens;
      aggregated.tokenCost.totalTokens += cost.tokenCost.totalTokens;
      aggregated.tokenCost.estimatedCost += cost.tokenCost.estimatedCost;
      
      aggregated.computeCost.crawlCost += cost.computeCost.crawlCost;
      aggregated.computeCost.auditCost += cost.computeCost.auditCost;
      aggregated.computeCost.embeddingCost += cost.computeCost.embeddingCost;
      aggregated.computeCost.processingCost += cost.computeCost.processingCost;
      aggregated.computeCost.storageCost += cost.computeCost.storageCost;
      aggregated.computeCost.totalCost += cost.computeCost.totalCost;
      aggregated.computeCost.estimatedDurationMs += cost.computeCost.estimatedDurationMs;
      
      aggregated.effortCost.engineeringHours += cost.effortCost.engineeringHours;
      aggregated.effortCost.contentHours += cost.effortCost.contentHours;
      aggregated.effortCost.reviewHours += cost.effortCost.reviewHours;
      aggregated.effortCost.coordinationHours += cost.effortCost.coordinationHours;
      aggregated.effortCost.totalHours += cost.effortCost.totalHours;
      cost.effortCost.skillsRequired.forEach(s => skills.add(s));
      
      aggregated.riskCost.rankingRiskCost += cost.riskCost.rankingRiskCost;
      aggregated.riskCost.trafficRiskCost += cost.riskCost.trafficRiskCost;
      aggregated.riskCost.penaltyRiskCost += cost.riskCost.penaltyRiskCost;
      aggregated.riskCost.brandRiskCost += cost.riskCost.brandRiskCost;
      aggregated.riskCost.technicalRiskCost += cost.riskCost.technicalRiskCost;
      aggregated.riskCost.totalRiskCost += cost.riskCost.totalRiskCost;
      aggregated.riskCost.riskProbability = Math.max(aggregated.riskCost.riskProbability, cost.riskCost.riskProbability);
      aggregated.riskCost.expectedLoss += cost.riskCost.expectedLoss;
      
      aggregated.totalCost += cost.totalCost;
      
      for (const [category, value] of Object.entries(cost.costPerCategory)) {
        aggregated.costPerCategory[category as CostCategory] += value;
      }
    }
    
    aggregated.effortCost.skillsRequired = Array.from(skills);
    aggregated.effortCost.complexity = 
      aggregated.effortCost.totalHours > 40 ? 'very_high' :
      aggregated.effortCost.totalHours > 20 ? 'high' :
      aggregated.effortCost.totalHours > 10 ? 'medium' : 'low';
    
    return aggregated;
  }
  
  /**
   * Aggregate values for selected actions
   */
  private aggregateValues(
    selected: ActionSelectionDecision[],
    values: Map<string, ActionValueBreakdown>
  ): ActionValueBreakdown {
    const aggregated: ActionValueBreakdown = {
      actionId: 'plan_total',
      actionType: 'aggregate',
      trafficValue: { expectedVisitors: 0, trafficUpliftPercent: 0, confidenceInterval: { low: 0, mid: 0, high: 0 }, timeToRealize: 0, sustainabilityMonths: 0 },
      rankingValue: { keywordsAffected: 0, avgPositionImprovement: 0, topKeywordImprovements: [], estimatedClickIncrease: 0 },
      riskReductionValue: { currentRiskScore: 0, projectedRiskScore: 0, riskReduction: 0, riskReductionPercent: 0, issuesResolved: 0, penaltyPrevention: false },
      brandValue: { consistencyImprovement: 0, violationsResolved: 0, brandScoreIncrease: 0, reputationProtection: 0 },
      totalValue: 0,
      valuePerCategory: { [ValueCategory.TRAFFIC]: 0, [ValueCategory.RANKING]: 0, [ValueCategory.RISK_REDUCTION]: 0, [ValueCategory.BRAND]: 0, [ValueCategory.TECHNICAL]: 0 },
      assumptions: [],
      estimatedAt: new Date().toISOString(),
      dataSourceQuality: 'medium',
    };
    
    for (const decision of selected) {
      const value = values.get(decision.actionId);
      if (!value) continue;
      
      aggregated.trafficValue.expectedVisitors += value.trafficValue.expectedVisitors;
      aggregated.trafficValue.trafficUpliftPercent += value.trafficValue.trafficUpliftPercent;
      aggregated.trafficValue.timeToRealize = Math.max(aggregated.trafficValue.timeToRealize, value.trafficValue.timeToRealize);
      aggregated.trafficValue.sustainabilityMonths = Math.max(aggregated.trafficValue.sustainabilityMonths, value.trafficValue.sustainabilityMonths);
      
      aggregated.rankingValue.keywordsAffected += value.rankingValue.keywordsAffected;
      aggregated.rankingValue.avgPositionImprovement += value.rankingValue.avgPositionImprovement;
      aggregated.rankingValue.estimatedClickIncrease += value.rankingValue.estimatedClickIncrease;
      
      aggregated.riskReductionValue.riskReduction += value.riskReductionValue.riskReduction;
      aggregated.riskReductionValue.issuesResolved += value.riskReductionValue.issuesResolved;
      aggregated.riskReductionValue.penaltyPrevention = aggregated.riskReductionValue.penaltyPrevention || value.riskReductionValue.penaltyPrevention;
      
      aggregated.brandValue.consistencyImprovement += value.brandValue.consistencyImprovement;
      aggregated.brandValue.violationsResolved += value.brandValue.violationsResolved;
      aggregated.brandValue.brandScoreIncrease += value.brandValue.brandScoreIncrease;
      
      aggregated.totalValue += value.totalValue;
      
      for (const [category, v] of Object.entries(value.valuePerCategory)) {
        aggregated.valuePerCategory[category as ValueCategory] += v;
      }
    }
    
    return aggregated;
  }
  
  /**
   * Determine execution order
   */
  private determineExecutionOrder(
    selected: ActionSelectionDecision[],
    actions: ActionInput[]
  ): string[] {
    // Sort by: dependencies first, then by ROI (descending)
    const order: string[] = [];
    const remaining = new Set(selected.map(s => s.actionId));
    const processed = new Set<string>();
    
    while (remaining.size > 0) {
      for (const decision of selected) {
        if (processed.has(decision.actionId)) continue;
        
        const action = actions.find(a => a.id === decision.actionId);
        if (!action) continue;
        
        // Check if all dependencies are processed
        const depsProcessed = !action.requiredDependencies?.length ||
          action.requiredDependencies.every(d => processed.has(d));
        
        if (depsProcessed) {
          order.push(decision.actionId);
          processed.add(decision.actionId);
          remaining.delete(decision.actionId);
        }
      }
      
      // Prevent infinite loop
      if (remaining.size > 0 && order.length === processed.size - 1) {
        // Add remaining in ROI order
        const remainingDecisions = selected
          .filter(s => remaining.has(s.actionId))
          .sort((a, b) => b.roiScore - a.roiScore);
        for (const d of remainingDecisions) {
          order.push(d.actionId);
        }
        break;
      }
    }
    
    return order;
  }
  
  /**
   * Generate plan summary
   */
  private generateSummary(
    selected: ActionSelectionDecision[],
    rejected: ActionSelectionDecision[],
    planROI: number,
    method: string
  ): string {
    return `Optimized plan with ${selected.length} actions selected, ${rejected.length} rejected. ` +
           `Plan ROI: ${planROI.toFixed(2)}. Method: ${method}. ` +
           `Profile: ${this.profile.name} (${this.profile.strategy}).`;
  }
  
  /**
   * Generate warnings
   */
  private generateWarnings(
    utilization: OptimizedActionPlan['constraintUtilization'],
    selected: ActionSelectionDecision[]
  ): string[] {
    const warnings: string[] = [];
    
    // High utilization warnings
    for (const [constraintId, usage] of Object.entries(utilization)) {
      if (usage.percent > 90) {
        warnings.push(`Constraint '${constraintId}' is at ${usage.percent.toFixed(0)}% utilization`);
      }
    }
    
    // Low ROI warnings
    const lowROI = selected.filter(s => s.roiScore < 1.0);
    if (lowROI.length > 0) {
      warnings.push(`${lowROI.length} actions have ROI below 1.0`);
    }
    
    // Empty plan warning
    if (selected.length === 0) {
      warnings.push('No actions selected - consider relaxing constraints or lowering ROI threshold');
    }
    
    return warnings;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBudgetSolver(profile?: BudgetProfile): BudgetConstraintSolver {
  return new BudgetConstraintSolver(profile);
}

export function createConservativeSolver(): BudgetConstraintSolver {
  const solver = new BudgetConstraintSolver();
  solver.setProfilePreset('conservative');
  return solver;
}

export function createAggressiveSolver(): BudgetConstraintSolver {
  const solver = new BudgetConstraintSolver();
  solver.setProfilePreset('aggressive');
  return solver;
}
