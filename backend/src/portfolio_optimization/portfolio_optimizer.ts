/**
 * Portfolio Optimizer v1.7
 * 
 * Optimizes resource allocation across projects under shared constraints.
 * 
 * Optimization Methods:
 * - RULE_BASED: Simple rule-based allocation by classification
 * - GREEDY: Greedy allocation by ROI score
 * - PROPORTIONAL: Proportional to composite scores
 * - CONSTRAINED: Constraint satisfaction optimization
 * 
 * Design Principles:
 * - Deterministic allocation
 * - Explainable decisions
 * - Respect all constraints
 * - Show trade-offs between projects
 */

import {
  ProjectMetrics,
  NormalizedProjectMetrics,
  ProjectClassification,
  ProjectClassificationResult,
  PortfolioConstraints,
  PortfolioAllocation,
  ProjectAllocation,
  AllocationMethod,
  PortfolioStrategy,
  PortfolioOptimizationConfig,
  DEFAULT_PORTFOLIO_CONFIG,
  DEFAULT_PORTFOLIO_CONSTRAINTS,
} from './models';

// ============================================================================
// ALLOCATION RULES BY CLASSIFICATION
// ============================================================================

interface ClassificationAllocationRule {
  baseAllocationPercent: number;
  minAllocationPercent: number;
  maxAllocationPercent: number;
  automationLevel: number;
  requiresApproval: boolean;
  approvalThreshold: number;
}

const DEFAULT_ALLOCATION_RULES: Record<ProjectClassification, ClassificationAllocationRule> = {
  [ProjectClassification.INVEST]: {
    baseAllocationPercent: 0.30,
    minAllocationPercent: 0.15,
    maxAllocationPercent: 0.50,
    automationLevel: 0.8,
    requiresApproval: false,
    approvalThreshold: 1000,
  },
  [ProjectClassification.MAINTAIN]: {
    baseAllocationPercent: 0.20,
    minAllocationPercent: 0.10,
    maxAllocationPercent: 0.35,
    automationLevel: 0.6,
    requiresApproval: false,
    approvalThreshold: 500,
  },
  [ProjectClassification.OPTIMIZE_CAUTIOUSLY]: {
    baseAllocationPercent: 0.15,
    minAllocationPercent: 0.05,
    maxAllocationPercent: 0.25,
    automationLevel: 0.4,
    requiresApproval: true,
    approvalThreshold: 200,
  },
  [ProjectClassification.OBSERVE]: {
    baseAllocationPercent: 0.05,
    minAllocationPercent: 0.02,
    maxAllocationPercent: 0.10,
    automationLevel: 0.2,
    requiresApproval: true,
    approvalThreshold: 100,
  },
  [ProjectClassification.TURNAROUND]: {
    baseAllocationPercent: 0.15,
    minAllocationPercent: 0.05,
    maxAllocationPercent: 0.25,
    automationLevel: 0.3,
    requiresApproval: true,
    approvalThreshold: 150,
  },
  [ProjectClassification.SUNSET]: {
    baseAllocationPercent: 0.02,
    minAllocationPercent: 0.00,
    maxAllocationPercent: 0.05,
    automationLevel: 0.1,
    requiresApproval: true,
    approvalThreshold: 50,
  },
};

// ============================================================================
// PORTFOLIO OPTIMIZER
// ============================================================================

/**
 * Optimizes resource allocation across the portfolio
 */
export class PortfolioOptimizer {
  private config: PortfolioOptimizationConfig;
  private allocationRules: Record<ProjectClassification, ClassificationAllocationRule>;
  private logger: Console;
  
  constructor(
    config: Partial<PortfolioOptimizationConfig> = {},
    allocationRules?: Partial<Record<ProjectClassification, ClassificationAllocationRule>>
  ) {
    this.config = { ...DEFAULT_PORTFOLIO_CONFIG, ...config };
    this.allocationRules = { ...DEFAULT_ALLOCATION_RULES, ...allocationRules };
    this.logger = console;
  }
  
  // ==========================================================================
  // MAIN OPTIMIZATION
  // ==========================================================================
  
  /**
   * Optimize portfolio allocation
   */
  optimizeAllocation(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    constraints: PortfolioConstraints,
    strategy: PortfolioStrategy,
    method?: AllocationMethod
  ): PortfolioAllocation {
    const optimizationMethod = method || this.config.defaultAllocationMethod;
    
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[PortfolioOptimizer] Optimizing ${projects.length} projects with ${optimizationMethod} method`);
    }
    
    // Select optimization method
    let projectAllocations: ProjectAllocation[];
    let iterations = 1;
    
    switch (optimizationMethod) {
      case AllocationMethod.RULE_BASED:
        projectAllocations = this.ruleBasedAllocation(
          projects, normalizedMetrics, classifications, constraints
        );
        break;
        
      case AllocationMethod.GREEDY:
        const greedyResult = this.greedyAllocation(
          projects, normalizedMetrics, classifications, constraints, strategy
        );
        projectAllocations = greedyResult.allocations;
        iterations = greedyResult.iterations;
        break;
        
      case AllocationMethod.PROPORTIONAL:
        projectAllocations = this.proportionalAllocation(
          projects, normalizedMetrics, classifications, constraints, strategy
        );
        break;
        
      case AllocationMethod.CONSTRAINED:
        const constrainedResult = this.constrainedAllocation(
          projects, normalizedMetrics, classifications, constraints, strategy
        );
        projectAllocations = constrainedResult.allocations;
        iterations = constrainedResult.iterations;
        break;
        
      default:
        projectAllocations = this.ruleBasedAllocation(
          projects, normalizedMetrics, classifications, constraints
        );
    }
    
    // Apply final constraint enforcement
    projectAllocations = this.enforceConstraints(projectAllocations, constraints);
    
    // Calculate distribution by classification
    const classificationDistribution = this.calculateClassificationDistribution(
      projectAllocations
    );
    
    // Calculate totals
    const totalTokensAllocated = projectAllocations.reduce((sum, p) => sum + p.tokenBudget, 0);
    const totalEffortAllocated = projectAllocations.reduce((sum, p) => sum + p.effortHours, 0);
    
    // Calculate optimization score
    const optimizationScore = this.calculateOptimizationScore(
      projectAllocations, normalizedMetrics, constraints, strategy
    );
    
    return {
      id: `allocation-${Date.now()}`,
      portfolioId: `portfolio-${projects[0]?.projectId || 'unknown'}`,
      projectAllocations,
      allocatedProjects: projectAllocations.filter(p => p.totalAllocation > 0).length,
      totalTokensAllocated,
      totalEffortAllocated,
      unallocatedTokens: constraints.totalTokenBudget - totalTokensAllocated,
      unallocatedEffort: constraints.totalEffortHours - totalEffortAllocated,
      classificationDistribution,
      optimizationMethod,
      optimizationScore,
      iterations,
      constraints,
      allocatedAt: new Date().toISOString(),
      validUntil: this.calculateValidUntil(constraints),
    };
  }
  
  // ==========================================================================
  // RULE-BASED ALLOCATION
  // ==========================================================================
  
  private ruleBasedAllocation(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    constraints: PortfolioConstraints
  ): ProjectAllocation[] {
    const allocations: ProjectAllocation[] = [];
    
    // Calculate initial allocations based on classification rules
    let totalBaseAllocation = 0;
    const baseAllocations: Array<{ projectId: string; basePercent: number }> = [];
    
    for (const project of projects) {
      const classification = classifications.find(c => c.projectId === project.projectId);
      if (!classification) continue;
      
      const rule = this.allocationRules[classification.classification];
      baseAllocations.push({
        projectId: project.projectId,
        basePercent: rule.baseAllocationPercent,
      });
      totalBaseAllocation += rule.baseAllocationPercent;
    }
    
    // Normalize to 100% if needed
    const scaleFactor = totalBaseAllocation > 1 ? 1 / totalBaseAllocation : 1;
    
    for (const project of projects) {
      const classification = classifications.find(c => c.projectId === project.projectId);
      const normalized = normalizedMetrics.find(n => n.projectId === project.projectId);
      if (!classification || !normalized) continue;
      
      const baseAlloc = baseAllocations.find(b => b.projectId === project.projectId);
      if (!baseAlloc) continue;
      
      const rule = this.allocationRules[classification.classification];
      const allocationPercent = baseAlloc.basePercent * scaleFactor;
      
      allocations.push(this.createProjectAllocation(
        project,
        classification,
        normalized,
        allocationPercent,
        constraints,
        rule
      ));
    }
    
    return allocations;
  }
  
  // ==========================================================================
  // GREEDY ALLOCATION
  // ==========================================================================
  
  private greedyAllocation(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    constraints: PortfolioConstraints,
    strategy: PortfolioStrategy
  ): { allocations: ProjectAllocation[]; iterations: number } {
    // Sort projects by score based on strategy
    const sortedProjects = [...projects].sort((a, b) => {
      const normA = normalizedMetrics.find(n => n.projectId === a.projectId);
      const normB = normalizedMetrics.find(n => n.projectId === b.projectId);
      if (!normA || !normB) return 0;
      
      const scoreA = this.getStrategyScore(normA, strategy);
      const scoreB = this.getStrategyScore(normB, strategy);
      return scoreB - scoreA;
    });
    
    const allocations: ProjectAllocation[] = [];
    let remainingTokens = constraints.totalTokenBudget;
    let remainingEffort = constraints.totalEffortHours;
    let iterations = 0;
    
    for (const project of sortedProjects) {
      iterations++;
      
      const classification = classifications.find(c => c.projectId === project.projectId);
      const normalized = normalizedMetrics.find(n => n.projectId === project.projectId);
      if (!classification || !normalized) continue;
      
      const rule = this.allocationRules[classification.classification];
      
      // Calculate how much this project can get (greedy: as much as possible within rules)
      const maxTokens = Math.min(
        remainingTokens,
        constraints.totalTokenBudget * rule.maxAllocationPercent,
        constraints.totalTokenBudget * constraints.maxProjectAllocation
      );
      
      const maxEffort = Math.min(
        remainingEffort,
        constraints.totalEffortHours * rule.maxAllocationPercent,
        constraints.totalEffortHours * constraints.maxProjectAllocation
      );
      
      // Ensure minimum allocation
      const tokenAllocation = Math.max(
        constraints.totalTokenBudget * rule.minAllocationPercent,
        maxTokens * (normalized.investmentAttractivenessScore / 100)
      );
      
      const effortAllocation = Math.max(
        constraints.totalEffortHours * rule.minAllocationPercent,
        maxEffort * (normalized.investmentAttractivenessScore / 100)
      );
      
      const allocationPercent = tokenAllocation / constraints.totalTokenBudget;
      
      allocations.push(this.createProjectAllocation(
        project,
        classification,
        normalized,
        allocationPercent,
        constraints,
        rule
      ));
      
      remainingTokens -= tokenAllocation;
      remainingEffort -= effortAllocation;
      
      // Stop if resources exhausted
      if (remainingTokens <= 0 || remainingEffort <= 0) break;
    }
    
    return { allocations, iterations };
  }
  
  // ==========================================================================
  // PROPORTIONAL ALLOCATION
  // ==========================================================================
  
  private proportionalAllocation(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    constraints: PortfolioConstraints,
    strategy: PortfolioStrategy
  ): ProjectAllocation[] {
    // Calculate total score for proportional allocation
    let totalScore = 0;
    const projectScores: Array<{ projectId: string; score: number }> = [];
    
    for (const project of projects) {
      const normalized = normalizedMetrics.find(n => n.projectId === project.projectId);
      if (!normalized) continue;
      
      const score = this.getStrategyScore(normalized, strategy);
      projectScores.push({ projectId: project.projectId, score });
      totalScore += score;
    }
    
    const allocations: ProjectAllocation[] = [];
    
    for (const project of projects) {
      const classification = classifications.find(c => c.projectId === project.projectId);
      const normalized = normalizedMetrics.find(n => n.projectId === project.projectId);
      const projectScore = projectScores.find(s => s.projectId === project.projectId);
      
      if (!classification || !normalized || !projectScore) continue;
      
      const rule = this.allocationRules[classification.classification];
      
      // Proportional allocation
      let allocationPercent = totalScore > 0 ? projectScore.score / totalScore : 0;
      
      // Apply min/max constraints
      allocationPercent = Math.max(rule.minAllocationPercent, allocationPercent);
      allocationPercent = Math.min(rule.maxAllocationPercent, allocationPercent);
      allocationPercent = Math.min(constraints.maxProjectAllocation, allocationPercent);
      
      allocations.push(this.createProjectAllocation(
        project,
        classification,
        normalized,
        allocationPercent,
        constraints,
        rule
      ));
    }
    
    return allocations;
  }
  
  // ==========================================================================
  // CONSTRAINED OPTIMIZATION
  // ==========================================================================
  
  private constrainedAllocation(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    constraints: PortfolioConstraints,
    strategy: PortfolioStrategy
  ): { allocations: ProjectAllocation[]; iterations: number } {
    // Start with proportional allocation
    let currentAllocations = this.proportionalAllocation(
      projects, normalizedMetrics, classifications, constraints, strategy
    );
    
    let iterations = 0;
    let converged = false;
    
    // Iterative constraint satisfaction
    while (!converged && iterations < this.config.maxOptimizationIterations) {
      iterations++;
      
      const previousAllocations = [...currentAllocations];
      
      // Check and fix constraint violations
      currentAllocations = this.fixConstraintViolations(
        currentAllocations, normalizedMetrics, constraints, strategy
      );
      
      // Check convergence
      const maxChange = this.calculateMaxChange(previousAllocations, currentAllocations);
      converged = maxChange < this.config.convergenceThreshold;
    }
    
    return { allocations: currentAllocations, iterations };
  }
  
  private fixConstraintViolations(
    allocations: ProjectAllocation[],
    normalizedMetrics: NormalizedProjectMetrics[],
    constraints: PortfolioConstraints,
    strategy: PortfolioStrategy
  ): ProjectAllocation[] {
    const fixed = [...allocations];
    
    // Check total allocation
    const totalAllocation = fixed.reduce((sum, a) => sum + a.totalAllocationPercent, 0);
    
    if (totalAllocation > 1) {
      // Scale down proportionally
      const scaleFactor = 1 / totalAllocation;
      for (const allocation of fixed) {
        allocation.tokenBudgetPercent *= scaleFactor;
        allocation.effortHoursPercent *= scaleFactor;
        allocation.totalAllocationPercent *= scaleFactor;
        allocation.tokenBudget = allocation.tokenBudgetPercent * constraints.totalTokenBudget;
        allocation.effortHours = allocation.effortHoursPercent * constraints.totalEffortHours;
      }
    }
    
    // Check risk constraint
    const portfolioRisk = this.calculatePortfolioRisk(fixed, normalizedMetrics);
    if (portfolioRisk > constraints.portfolioRiskTolerance) {
      // Reduce allocation to high-risk projects
      for (const allocation of fixed) {
        const normalized = normalizedMetrics.find(n => n.projectId === allocation.projectId);
        if (!normalized) continue;
        
        if (normalized.riskScore > 60) {
          const reductionFactor = 0.8;
          allocation.tokenBudgetPercent *= reductionFactor;
          allocation.effortHoursPercent *= reductionFactor;
          allocation.totalAllocationPercent *= reductionFactor;
          allocation.tokenBudget *= reductionFactor;
          allocation.effortHours *= reductionFactor;
          allocation.tradeOffsAccepted.push(`Reduced allocation due to portfolio risk constraint`);
        }
      }
    }
    
    // Check max project allocation
    for (const allocation of fixed) {
      if (allocation.totalAllocationPercent > constraints.maxProjectAllocation) {
        const excess = allocation.totalAllocationPercent - constraints.maxProjectAllocation;
        allocation.totalAllocationPercent = constraints.maxProjectAllocation;
        allocation.tokenBudgetPercent = constraints.maxProjectAllocation;
        allocation.effortHoursPercent = constraints.maxProjectAllocation;
        allocation.tokenBudget = allocation.tokenBudgetPercent * constraints.totalTokenBudget;
        allocation.effortHours = allocation.effortHoursPercent * constraints.totalEffortHours;
        allocation.tradeOffsAccepted.push(`Capped at ${(constraints.maxProjectAllocation * 100).toFixed(0)}% max allocation`);
      }
    }
    
    return fixed;
  }
  
  private calculateMaxChange(
    previous: ProjectAllocation[],
    current: ProjectAllocation[]
  ): number {
    let maxChange = 0;
    
    for (const curr of current) {
      const prev = previous.find(p => p.projectId === curr.projectId);
      if (!prev) continue;
      
      const change = Math.abs(curr.totalAllocationPercent - prev.totalAllocationPercent);
      maxChange = Math.max(maxChange, change);
    }
    
    return maxChange;
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  private createProjectAllocation(
    project: ProjectMetrics,
    classification: ProjectClassificationResult,
    normalized: NormalizedProjectMetrics,
    allocationPercent: number,
    constraints: PortfolioConstraints,
    rule: ClassificationAllocationRule
  ): ProjectAllocation {
    const tokenBudget = allocationPercent * constraints.totalTokenBudget;
    const effortHours = allocationPercent * constraints.totalEffortHours;
    const computeBudget = allocationPercent * constraints.totalComputeBudget;
    
    // Determine allowed/restricted action types based on classification
    const { allowedActionTypes, restrictedActionTypes } = this.getActionTypeRestrictions(
      classification.classification,
      normalized.riskScore
    );
    
    // Calculate risk budget
    const riskBudget = constraints.portfolioRiskTolerance * allocationPercent;
    const maxActionRisk = Math.min(constraints.maxProjectRisk, riskBudget * 2);
    
    // Determine automation level
    const automationLevel = Math.min(
      rule.automationLevel,
      constraints.maxAutomationLevel,
      this.calculateSafeAutomationLevel(normalized.riskScore)
    );
    
    // Generate rationale
    const allocationRationale = this.generateAllocationRationale(
      project,
      classification,
      normalized,
      allocationPercent
    );
    
    return {
      projectId: project.projectId,
      projectName: project.projectName,
      classification: classification.classification,
      tokenBudget: Math.round(tokenBudget),
      tokenBudgetPercent: allocationPercent,
      effortHours: Math.round(effortHours * 10) / 10,
      effortHoursPercent: allocationPercent,
      computeBudget: Math.round(computeBudget),
      computeBudgetPercent: allocationPercent,
      totalAllocation: tokenBudget + computeBudget + (effortHours * 50), // Weighted sum
      totalAllocationPercent: allocationPercent,
      automationLevel,
      allowedActionTypes,
      restrictedActionTypes,
      riskBudget,
      maxActionRisk,
      requiresApproval: rule.requiresApproval || constraints.requireHumanApproval,
      approvalThreshold: rule.approvalThreshold,
      allocationRationale,
      tradeOffsAccepted: [],
    };
  }
  
  private getStrategyScore(
    normalized: NormalizedProjectMetrics,
    strategy: PortfolioStrategy
  ): number {
    switch (strategy) {
      case PortfolioStrategy.MAXIMIZE_ROI:
        return normalized.roiScore * 0.5 + normalized.efficiencyScore * 0.3 + normalized.growthScore * 0.2;
        
      case PortfolioStrategy.MINIMIZE_RISK:
        return (100 - normalized.riskScore) * 0.5 + normalized.stabilityScore * 0.3 + normalized.roiScore * 0.2;
        
      case PortfolioStrategy.BALANCED_GROWTH:
        return normalized.growthScore * 0.3 + normalized.roiScore * 0.25 + 
               (100 - normalized.riskScore) * 0.25 + normalized.potentialScore * 0.2;
        
      case PortfolioStrategy.AGGRESSIVE_GROWTH:
        return normalized.growthScore * 0.4 + normalized.potentialScore * 0.3 + normalized.roiScore * 0.3;
        
      case PortfolioStrategy.CAPITAL_PRESERVATION:
        return normalized.stabilityScore * 0.4 + (100 - normalized.riskScore) * 0.4 + normalized.roiScore * 0.2;
        
      default:
        return normalized.overallScore;
    }
  }
  
  private getActionTypeRestrictions(
    classification: ProjectClassification,
    riskScore: number
  ): { allowedActionTypes: string[]; restrictedActionTypes: string[] } {
    const allActionTypes = [
      'create_content', 'update_content', 'optimize_content',
      'fix_technical_issue', 'improve_page_speed', 'fix_schema_markup',
      'add_internal_link', 'optimize_anchor_text',
      'target_new_keyword', 'improve_keyword_ranking',
    ];
    
    const riskyActionTypes = [
      'create_content', 'optimize_anchor_text', 'target_new_keyword',
    ];
    
    const safeActionTypes = [
      'fix_technical_issue', 'fix_schema_markup', 'improve_page_speed',
    ];
    
    switch (classification) {
      case ProjectClassification.INVEST:
        return { allowedActionTypes: allActionTypes, restrictedActionTypes: [] };
        
      case ProjectClassification.MAINTAIN:
        return { 
          allowedActionTypes: allActionTypes.filter(t => !riskyActionTypes.includes(t)).concat(safeActionTypes),
          restrictedActionTypes: riskyActionTypes 
        };
        
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY:
        return { 
          allowedActionTypes: safeActionTypes,
          restrictedActionTypes: riskyActionTypes 
        };
        
      case ProjectClassification.OBSERVE:
      case ProjectClassification.SUNSET:
        return { 
          allowedActionTypes: ['fix_technical_issue', 'fix_schema_markup'],
          restrictedActionTypes: allActionTypes.filter(t => !['fix_technical_issue', 'fix_schema_markup'].includes(t))
        };
        
      case ProjectClassification.TURNAROUND:
        return { 
          allowedActionTypes: [...safeActionTypes, 'update_content'],
          restrictedActionTypes: riskyActionTypes 
        };
        
      default:
        return { allowedActionTypes: safeActionTypes, restrictedActionTypes: riskyActionTypes };
    }
  }
  
  private calculateSafeAutomationLevel(riskScore: number): number {
    // Higher risk = lower safe automation
    if (riskScore >= 70) return 0.3;
    if (riskScore >= 50) return 0.5;
    if (riskScore >= 30) return 0.7;
    return 0.9;
  }
  
  private generateAllocationRationale(
    project: ProjectMetrics,
    classification: ProjectClassificationResult,
    normalized: NormalizedProjectMetrics,
    allocationPercent: number
  ): string[] {
    const rationale: string[] = [];
    
    rationale.push(`Classification: ${classification.classification} with ${(classification.confidence * 100).toFixed(0)}% confidence`);
    rationale.push(`Allocation: ${(allocationPercent * 100).toFixed(1)}% of portfolio resources`);
    rationale.push(`Investment attractiveness score: ${normalized.investmentAttractivenessScore.toFixed(0)}/100`);
    
    if (normalized.roiScore >= 70) {
      rationale.push(`Strong ROI score (${normalized.roiScore.toFixed(0)}) justifies higher allocation`);
    }
    
    if (normalized.riskScore >= 50) {
      rationale.push(`Elevated risk score (${normalized.riskScore.toFixed(0)}) limits allocation`);
    }
    
    if (project.traffic.trafficTrend === 'growing') {
      rationale.push(`Growing traffic trend supports investment`);
    } else if (project.traffic.trafficTrend === 'declining') {
      rationale.push(`Declining traffic limits additional investment`);
    }
    
    return rationale;
  }
  
  private enforceConstraints(
    allocations: ProjectAllocation[],
    constraints: PortfolioConstraints
  ): ProjectAllocation[] {
    // Normalize to ensure total doesn't exceed 100%
    const totalPercent = allocations.reduce((sum, a) => sum + a.totalAllocationPercent, 0);
    
    if (totalPercent > 1) {
      const scaleFactor = 1 / totalPercent;
      for (const allocation of allocations) {
        allocation.tokenBudgetPercent *= scaleFactor;
        allocation.effortHoursPercent *= scaleFactor;
        allocation.computeBudgetPercent *= scaleFactor;
        allocation.totalAllocationPercent *= scaleFactor;
        allocation.tokenBudget = allocation.tokenBudgetPercent * constraints.totalTokenBudget;
        allocation.effortHours = allocation.effortHoursPercent * constraints.totalEffortHours;
        allocation.computeBudget = allocation.computeBudgetPercent * constraints.totalComputeBudget;
      }
    }
    
    return allocations;
  }
  
  private calculateClassificationDistribution(
    allocations: ProjectAllocation[]
  ): Record<ProjectClassification, number> {
    const distribution: Record<ProjectClassification, number> = {
      [ProjectClassification.INVEST]: 0,
      [ProjectClassification.MAINTAIN]: 0,
      [ProjectClassification.OPTIMIZE_CAUTIOUSLY]: 0,
      [ProjectClassification.OBSERVE]: 0,
      [ProjectClassification.TURNAROUND]: 0,
      [ProjectClassification.SUNSET]: 0,
    };
    
    for (const allocation of allocations) {
      distribution[allocation.classification] += allocation.totalAllocationPercent;
    }
    
    return distribution;
  }
  
  private calculatePortfolioRisk(
    allocations: ProjectAllocation[],
    normalizedMetrics: NormalizedProjectMetrics[]
  ): number {
    let weightedRisk = 0;
    let totalWeight = 0;
    
    for (const allocation of allocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === allocation.projectId);
      if (!normalized) continue;
      
      weightedRisk += (normalized.riskScore / 100) * allocation.totalAllocationPercent;
      totalWeight += allocation.totalAllocationPercent;
    }
    
    return totalWeight > 0 ? weightedRisk / totalWeight : 0;
  }
  
  private calculateOptimizationScore(
    allocations: ProjectAllocation[],
    normalizedMetrics: NormalizedProjectMetrics[],
    constraints: PortfolioConstraints,
    strategy: PortfolioStrategy
  ): number {
    // Calculate weighted average of strategy scores
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const allocation of allocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === allocation.projectId);
      if (!normalized) continue;
      
      const strategyScore = this.getStrategyScore(normalized, strategy);
      totalScore += strategyScore * allocation.totalAllocationPercent;
      totalWeight += allocation.totalAllocationPercent;
    }
    
    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    // Penalize for unallocated resources
    const allocationEfficiency = allocations.reduce((sum, a) => sum + a.totalAllocationPercent, 0);
    
    return avgScore * allocationEfficiency;
  }
  
  private calculateValidUntil(constraints: PortfolioConstraints): string {
    const now = new Date();
    let daysValid = 7;
    
    switch (constraints.rebalanceFrequency) {
      case 'daily':
        daysValid = 1;
        break;
      case 'weekly':
        daysValid = 7;
        break;
      case 'monthly':
        daysValid = 30;
        break;
    }
    
    const validUntil = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);
    return validUntil.toISOString();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createPortfolioOptimizer(
  config?: Partial<PortfolioOptimizationConfig>
): PortfolioOptimizer {
  return new PortfolioOptimizer(config);
}

/**
 * Create optimizer with default conservative constraints
 */
export function createConservativeOptimizer(): PortfolioOptimizer {
  return new PortfolioOptimizer({
    defaultAllocationMethod: AllocationMethod.RULE_BASED,
    maxOptimizationIterations: 50,
  });
}

/**
 * Create optimizer for aggressive growth
 */
export function createAggressiveOptimizer(): PortfolioOptimizer {
  return new PortfolioOptimizer({
    defaultAllocationMethod: AllocationMethod.GREEDY,
    maxOptimizationIterations: 100,
  });
}
