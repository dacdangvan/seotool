/**
 * Recommendation Engine v1.7
 * 
 * Generates portfolio-level recommendations with rationale and expected impact.
 * 
 * Recommendation Types:
 * - INCREASE_INVESTMENT: Expand budget for high-potential projects
 * - MAINTAIN_INVESTMENT: Keep current allocation
 * - REDUCE_INVESTMENT: Cut budget for underperforming projects
 * - INCREASE_AUTOMATION: Allow more automated actions
 * - REDUCE_AUTOMATION: Require more human oversight
 * - PAUSE_RISKY_ACTIONS: Stop risky activities
 * - ACCELERATE_GROWTH: Push growth initiatives
 * - FOCUS_ON_STABILITY: Prioritize stability
 * - INITIATE_TURNAROUND: Start recovery program
 * - CONSIDER_SUNSET: Evaluate project closure
 * 
 * Design Principles:
 * - Never optimize in isolation
 * - Always show trade-offs
 * - Explainable rationale
 * - No forced execution
 */

import {
  ProjectMetrics,
  NormalizedProjectMetrics,
  ProjectClassification,
  ProjectClassificationResult,
  PortfolioAllocation,
  ProjectAllocation,
  PortfolioSimulationResult,
  PortfolioRecommendation,
  ProjectRecommendation,
  RecommendedAction,
  AlternativeRecommendation,
  PortfolioInsight,
  PortfolioAction,
  ExpectedOutcome,
  RiskWarning,
  PortfolioOptimizationConfig,
  DEFAULT_PORTFOLIO_CONFIG,
} from './models';

// ============================================================================
// RECOMMENDATION THRESHOLDS
// ============================================================================

interface RecommendationThresholds {
  // Investment thresholds
  increaseInvestmentMinROI: number;
  reduceInvestmentMaxROI: number;
  
  // Automation thresholds
  increaseAutomationMinStability: number;
  reduceAutomationMaxRisk: number;
  
  // Risk thresholds
  pauseActionsMinRisk: number;
  
  // Growth thresholds
  accelerateGrowthMinPotential: number;
  
  // Concentration warning threshold
  concentrationWarningPercent: number;
}

const DEFAULT_THRESHOLDS: RecommendationThresholds = {
  increaseInvestmentMinROI: 70,
  reduceInvestmentMaxROI: 35,
  increaseAutomationMinStability: 70,
  reduceAutomationMaxRisk: 60,
  pauseActionsMinRisk: 75,
  accelerateGrowthMinPotential: 65,
  concentrationWarningPercent: 0.4,
};

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

/**
 * Generates portfolio-level recommendations
 */
export class RecommendationEngine {
  private config: PortfolioOptimizationConfig;
  private thresholds: RecommendationThresholds;
  private logger: Console;
  
  constructor(
    config: Partial<PortfolioOptimizationConfig> = {},
    thresholds: Partial<RecommendationThresholds> = {}
  ) {
    this.config = { ...DEFAULT_PORTFOLIO_CONFIG, ...config };
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.logger = console;
  }
  
  // ==========================================================================
  // MAIN RECOMMENDATION GENERATION
  // ==========================================================================
  
  /**
   * Generate comprehensive portfolio recommendations
   */
  generateRecommendations(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation,
    simulationResults: PortfolioSimulationResult[]
  ): PortfolioRecommendation {
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[RecommendationEngine] Generating recommendations for ${projects.length} projects`);
    }
    
    // Generate project-level recommendations
    const projectRecommendations = this.generateProjectRecommendations(
      projects,
      normalizedMetrics,
      classifications,
      currentAllocation
    );
    
    // Generate portfolio-level insights
    const portfolioInsights = this.generatePortfolioInsights(
      projects,
      normalizedMetrics,
      classifications,
      currentAllocation
    );
    
    // Generate prioritized actions
    const prioritizedActions = this.generatePrioritizedActions(
      projectRecommendations,
      portfolioInsights,
      simulationResults
    );
    
    // Calculate expected outcomes
    const expectedOutcomes = this.calculateExpectedOutcomes(
      projects,
      normalizedMetrics,
      projectRecommendations,
      simulationResults
    );
    
    // Generate risk warnings
    const riskWarnings = this.generateRiskWarnings(
      projects,
      normalizedMetrics,
      classifications,
      currentAllocation
    );
    
    // Generate summary
    const summary = this.generateSummary(
      projectRecommendations,
      portfolioInsights,
      riskWarnings
    );
    
    return {
      id: `recommendation-${Date.now()}`,
      portfolioId: currentAllocation.portfolioId,
      summary,
      projectRecommendations,
      portfolioInsights,
      prioritizedActions,
      expectedOutcomes,
      riskWarnings,
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: this.calculateOverallConfidence(projectRecommendations, portfolioInsights),
    };
  }
  
  // ==========================================================================
  // PROJECT RECOMMENDATIONS
  // ==========================================================================
  
  private generateProjectRecommendations(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation
  ): ProjectRecommendation[] {
    const recommendations: ProjectRecommendation[] = [];
    
    for (const project of projects) {
      const normalized = normalizedMetrics.find(n => n.projectId === project.projectId);
      const classification = classifications.find(c => c.projectId === project.projectId);
      const allocation = currentAllocation.projectAllocations.find(
        a => a.projectId === project.projectId
      );
      
      if (!normalized || !classification || !allocation) continue;
      
      const recommendation = this.generateProjectRecommendation(
        project,
        normalized,
        classification,
        allocation
      );
      
      recommendations.push(recommendation);
    }
    
    // Sort by priority
    return recommendations.sort((a, b) => b.priority - a.priority);
  }
  
  private generateProjectRecommendation(
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics,
    classification: ProjectClassificationResult,
    allocation: ProjectAllocation
  ): ProjectRecommendation {
    // Determine recommended action based on classification and metrics
    const recommendedAction = this.determineRecommendedAction(
      classification.classification,
      normalized,
      project
    );
    
    // Generate rationale
    const rationale = this.generateRationale(
      recommendedAction,
      project,
      normalized,
      classification
    );
    
    // Calculate expected impact
    const expectedImpact = this.calculateExpectedImpact(
      recommendedAction,
      project,
      normalized
    );
    
    // Calculate priority (1-10)
    const priority = this.calculatePriority(
      classification.classification,
      normalized,
      recommendedAction
    );
    
    // Generate alternatives
    const alternatives = this.generateAlternatives(
      recommendedAction,
      classification.classification,
      normalized
    );
    
    return {
      projectId: project.projectId,
      projectName: project.projectName,
      classification: classification.classification,
      recommendedAction,
      rationale,
      expectedImpact,
      priority,
      alternatives,
    };
  }
  
  private determineRecommendedAction(
    classification: ProjectClassification,
    normalized: NormalizedProjectMetrics,
    project: ProjectMetrics
  ): RecommendedAction {
    // Classification-based primary recommendation
    switch (classification) {
      case ProjectClassification.INVEST:
        if (normalized.roiScore >= this.thresholds.increaseInvestmentMinROI) {
          return RecommendedAction.INCREASE_INVESTMENT;
        }
        if (normalized.potentialScore >= this.thresholds.accelerateGrowthMinPotential) {
          return RecommendedAction.ACCELERATE_GROWTH;
        }
        return RecommendedAction.MAINTAIN_INVESTMENT;
        
      case ProjectClassification.MAINTAIN:
        if (normalized.stabilityScore >= this.thresholds.increaseAutomationMinStability) {
          return RecommendedAction.INCREASE_AUTOMATION;
        }
        return RecommendedAction.MAINTAIN_INVESTMENT;
        
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY:
        if (normalized.riskScore >= this.thresholds.pauseActionsMinRisk) {
          return RecommendedAction.PAUSE_RISKY_ACTIONS;
        }
        if (normalized.riskScore >= this.thresholds.reduceAutomationMaxRisk) {
          return RecommendedAction.REDUCE_AUTOMATION;
        }
        return RecommendedAction.FOCUS_ON_STABILITY;
        
      case ProjectClassification.OBSERVE:
        if (normalized.roiScore <= this.thresholds.reduceInvestmentMaxROI) {
          return RecommendedAction.REDUCE_INVESTMENT;
        }
        return RecommendedAction.MAINTAIN_INVESTMENT;
        
      case ProjectClassification.TURNAROUND:
        return RecommendedAction.INITIATE_TURNAROUND;
        
      case ProjectClassification.SUNSET:
        return RecommendedAction.CONSIDER_SUNSET;
        
      default:
        return RecommendedAction.MAINTAIN_INVESTMENT;
    }
  }
  
  private generateRationale(
    action: RecommendedAction,
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics,
    classification: ProjectClassificationResult
  ): string[] {
    const rationale: string[] = [];
    
    // Add classification context
    rationale.push(
      `Classified as "${classification.classification}" with ${(classification.confidence * 100).toFixed(0)}% confidence`
    );
    
    // Add action-specific rationale
    switch (action) {
      case RecommendedAction.INCREASE_INVESTMENT:
        rationale.push(`Strong ROI score of ${normalized.roiScore.toFixed(0)} exceeds investment threshold`);
        rationale.push(`Growth potential score of ${normalized.growthScore.toFixed(0)} indicates upside`);
        rationale.push(`Risk score of ${normalized.riskScore.toFixed(0)} is within acceptable range`);
        break;
        
      case RecommendedAction.REDUCE_INVESTMENT:
        rationale.push(`Low ROI score of ${normalized.roiScore.toFixed(0)} below investment threshold`);
        if (project.traffic.trafficTrend === 'declining') {
          rationale.push(`Declining traffic trend indicates reducing returns`);
        }
        break;
        
      case RecommendedAction.INCREASE_AUTOMATION:
        rationale.push(`High stability score of ${normalized.stabilityScore.toFixed(0)} supports more automation`);
        rationale.push(`Low risk profile allows automated execution`);
        break;
        
      case RecommendedAction.REDUCE_AUTOMATION:
        rationale.push(`Elevated risk score of ${normalized.riskScore.toFixed(0)} requires human oversight`);
        rationale.push(`${project.risk.criticalIssuesCount} critical issues need manual review`);
        break;
        
      case RecommendedAction.PAUSE_RISKY_ACTIONS:
        rationale.push(`Very high risk score of ${normalized.riskScore.toFixed(0)} requires immediate attention`);
        rationale.push(`${project.risk.criticalIssuesCount} critical issues must be resolved first`);
        break;
        
      case RecommendedAction.ACCELERATE_GROWTH:
        rationale.push(`High growth potential score of ${normalized.potentialScore.toFixed(0)}`);
        rationale.push(`Traffic forecast shows ${project.projections.trafficForecast90d.mid.toFixed(0)} at 90 days`);
        break;
        
      case RecommendedAction.FOCUS_ON_STABILITY:
        rationale.push(`Need to stabilize before growth initiatives`);
        rationale.push(`Current volatility requires conservative approach`);
        break;
        
      case RecommendedAction.INITIATE_TURNAROUND:
        rationale.push(`High potential (${normalized.potentialScore.toFixed(0)}) despite poor current performance`);
        rationale.push(`Focused intervention can unlock value`);
        break;
        
      case RecommendedAction.CONSIDER_SUNSET:
        rationale.push(`Low scores across all metrics indicate limited viability`);
        rationale.push(`Resources may be better allocated to other projects`);
        break;
        
      default:
        rationale.push(`Current allocation is appropriate for this classification`);
    }
    
    return rationale;
  }
  
  private calculateExpectedImpact(
    action: RecommendedAction,
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): string {
    switch (action) {
      case RecommendedAction.INCREASE_INVESTMENT:
        return `Expected ${(normalized.potentialScore * 0.3).toFixed(0)}% traffic increase with additional investment`;
        
      case RecommendedAction.REDUCE_INVESTMENT:
        return `Cost savings with minimal traffic impact (stable decline expected regardless)`;
        
      case RecommendedAction.INCREASE_AUTOMATION:
        return `Faster execution, reduced costs, same expected outcomes`;
        
      case RecommendedAction.REDUCE_AUTOMATION:
        return `Slower but safer execution, reduced risk exposure`;
        
      case RecommendedAction.PAUSE_RISKY_ACTIONS:
        return `Risk reduction of ${(normalized.riskScore * 0.2).toFixed(0)}%, potential short-term traffic stall`;
        
      case RecommendedAction.ACCELERATE_GROWTH:
        return `Potential ${(normalized.potentialScore * 0.4).toFixed(0)}% traffic uplift in 90 days`;
        
      case RecommendedAction.FOCUS_ON_STABILITY:
        return `Stabilization of rankings and traffic, foundation for future growth`;
        
      case RecommendedAction.INITIATE_TURNAROUND:
        return `Recovery potential of ${(normalized.potentialScore * 0.5).toFixed(0)}% over 6 months with focused effort`;
        
      case RecommendedAction.CONSIDER_SUNSET:
        return `Resource reallocation to higher-performing projects`;
        
      default:
        return `Continued stable performance expected`;
    }
  }
  
  private calculatePriority(
    classification: ProjectClassification,
    normalized: NormalizedProjectMetrics,
    action: RecommendedAction
  ): number {
    let basePriority = 5;
    
    // Adjust based on classification
    switch (classification) {
      case ProjectClassification.INVEST:
        basePriority = 8;
        break;
      case ProjectClassification.TURNAROUND:
        basePriority = 7;
        break;
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY:
        basePriority = 6;
        break;
      case ProjectClassification.MAINTAIN:
        basePriority = 5;
        break;
      case ProjectClassification.OBSERVE:
        basePriority = 3;
        break;
      case ProjectClassification.SUNSET:
        basePriority = 4;
        break;
    }
    
    // Adjust based on action urgency
    if (action === RecommendedAction.PAUSE_RISKY_ACTIONS) {
      basePriority = Math.min(10, basePriority + 2);
    }
    
    // Adjust based on investment attractiveness
    const attractivenessBonus = (normalized.investmentAttractivenessScore - 50) / 50;
    basePriority += attractivenessBonus;
    
    return Math.max(1, Math.min(10, Math.round(basePriority)));
  }
  
  private generateAlternatives(
    currentAction: RecommendedAction,
    classification: ProjectClassification,
    normalized: NormalizedProjectMetrics
  ): AlternativeRecommendation[] {
    const alternatives: AlternativeRecommendation[] = [];
    
    // Add contextual alternatives
    if (currentAction === RecommendedAction.INCREASE_INVESTMENT) {
      alternatives.push({
        action: RecommendedAction.ACCELERATE_GROWTH,
        condition: 'If budget is limited, focus on growth over broad investment',
        tradeOff: 'Higher concentration risk but faster results',
      });
      alternatives.push({
        action: RecommendedAction.MAINTAIN_INVESTMENT,
        condition: 'If portfolio is already concentrated',
        tradeOff: 'Lower growth but better diversification',
      });
    }
    
    if (currentAction === RecommendedAction.REDUCE_INVESTMENT) {
      alternatives.push({
        action: RecommendedAction.INITIATE_TURNAROUND,
        condition: 'If there is hidden potential not captured by metrics',
        tradeOff: 'Requires additional resource commitment',
      });
      alternatives.push({
        action: RecommendedAction.CONSIDER_SUNSET,
        condition: 'If decline is irreversible',
        tradeOff: 'Lose any potential recovery value',
      });
    }
    
    if (currentAction === RecommendedAction.FOCUS_ON_STABILITY) {
      alternatives.push({
        action: RecommendedAction.PAUSE_RISKY_ACTIONS,
        condition: 'If risk continues to escalate',
        tradeOff: 'Complete halt vs. cautious progress',
      });
    }
    
    return alternatives;
  }
  
  // ==========================================================================
  // PORTFOLIO INSIGHTS
  // ==========================================================================
  
  private generatePortfolioInsights(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation
  ): PortfolioInsight[] {
    const insights: PortfolioInsight[] = [];
    
    // Check for concentration risk
    const concentrationInsight = this.checkConcentrationRisk(currentAllocation);
    if (concentrationInsight) insights.push(concentrationInsight);
    
    // Check for underinvested high-performers
    const underinvestmentInsight = this.checkUnderinvestment(
      normalizedMetrics,
      currentAllocation
    );
    if (underinvestmentInsight) insights.push(underinvestmentInsight);
    
    // Check for rebalancing opportunity
    const rebalanceInsight = this.checkRebalanceOpportunity(
      normalizedMetrics,
      classifications,
      currentAllocation
    );
    if (rebalanceInsight) insights.push(rebalanceInsight);
    
    // Check for efficiency improvement
    const efficiencyInsight = this.checkEfficiencyOpportunity(
      normalizedMetrics,
      currentAllocation
    );
    if (efficiencyInsight) insights.push(efficiencyInsight);
    
    // Check for risk exposure
    const riskInsight = this.checkPortfolioRisk(
      normalizedMetrics,
      currentAllocation
    );
    if (riskInsight) insights.push(riskInsight);
    
    return insights;
  }
  
  private checkConcentrationRisk(
    currentAllocation: PortfolioAllocation
  ): PortfolioInsight | null {
    const topAllocation = Math.max(
      ...currentAllocation.projectAllocations.map(a => a.totalAllocationPercent)
    );
    
    if (topAllocation > this.thresholds.concentrationWarningPercent) {
      const topProject = currentAllocation.projectAllocations.find(
        a => a.totalAllocationPercent === topAllocation
      );
      
      return {
        type: 'risk',
        title: 'Concentration Risk Detected',
        description: `${topProject?.projectName || 'A project'} has ${(topAllocation * 100).toFixed(0)}% of allocation, ` +
          `exceeding the ${(this.thresholds.concentrationWarningPercent * 100).toFixed(0)}% concentration threshold`,
        affectedProjects: topProject ? [topProject.projectId] : [],
        suggestedAction: 'Consider redistributing resources to reduce single-project dependency',
        impact: 'high',
      };
    }
    
    return null;
  }
  
  private checkUnderinvestment(
    normalizedMetrics: NormalizedProjectMetrics[],
    currentAllocation: PortfolioAllocation
  ): PortfolioInsight | null {
    const underinvested: string[] = [];
    
    for (const normalized of normalizedMetrics) {
      const allocation = currentAllocation.projectAllocations.find(
        a => a.projectId === normalized.projectId
      );
      if (!allocation) continue;
      
      // High ROI but low allocation
      if (normalized.roiScore >= 70 && allocation.totalAllocationPercent < 0.15) {
        underinvested.push(normalized.projectId);
      }
    }
    
    if (underinvested.length > 0) {
      return {
        type: 'opportunity',
        title: 'Underinvested High-Performers Detected',
        description: `${underinvested.length} high-ROI project(s) have below-expected allocation`,
        affectedProjects: underinvested,
        suggestedAction: 'Increase investment in high-performing projects to capture more value',
        impact: 'high',
      };
    }
    
    return null;
  }
  
  private checkRebalanceOpportunity(
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation
  ): PortfolioInsight | null {
    let mismatchCount = 0;
    const mismatched: string[] = [];
    
    for (const classification of classifications) {
      const normalized = normalizedMetrics.find(n => n.projectId === classification.projectId);
      const allocation = currentAllocation.projectAllocations.find(
        a => a.projectId === classification.projectId
      );
      
      if (!normalized || !allocation) continue;
      
      // Check if allocation matches classification
      const expectedMinAllocation = this.getExpectedMinAllocation(classification.classification);
      const expectedMaxAllocation = this.getExpectedMaxAllocation(classification.classification);
      
      if (allocation.totalAllocationPercent < expectedMinAllocation ||
          allocation.totalAllocationPercent > expectedMaxAllocation) {
        mismatchCount++;
        mismatched.push(classification.projectId);
      }
    }
    
    if (mismatchCount >= 2) {
      return {
        type: 'rebalance',
        title: 'Portfolio Rebalancing Opportunity',
        description: `${mismatchCount} project(s) have allocations misaligned with their classifications`,
        affectedProjects: mismatched,
        suggestedAction: 'Run portfolio optimization to realign allocations with current classifications',
        impact: 'medium',
      };
    }
    
    return null;
  }
  
  private checkEfficiencyOpportunity(
    normalizedMetrics: NormalizedProjectMetrics[],
    currentAllocation: PortfolioAllocation
  ): PortfolioInsight | null {
    const inefficient: string[] = [];
    
    for (const normalized of normalizedMetrics) {
      const allocation = currentAllocation.projectAllocations.find(
        a => a.projectId === normalized.projectId
      );
      if (!allocation) continue;
      
      // Low efficiency but significant allocation
      if (normalized.efficiencyScore < 40 && allocation.totalAllocationPercent > 0.1) {
        inefficient.push(normalized.projectId);
      }
    }
    
    if (inefficient.length > 0) {
      return {
        type: 'efficiency',
        title: 'Efficiency Improvement Opportunity',
        description: `${inefficient.length} project(s) have low cost efficiency despite significant allocation`,
        affectedProjects: inefficient,
        suggestedAction: 'Review cost structures and optimize resource usage in affected projects',
        impact: 'medium',
      };
    }
    
    return null;
  }
  
  private checkPortfolioRisk(
    normalizedMetrics: NormalizedProjectMetrics[],
    currentAllocation: PortfolioAllocation
  ): PortfolioInsight | null {
    // Calculate weighted portfolio risk
    let weightedRisk = 0;
    let totalWeight = 0;
    const highRisk: string[] = [];
    
    for (const allocation of currentAllocation.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === allocation.projectId);
      if (!normalized) continue;
      
      weightedRisk += normalized.riskScore * allocation.totalAllocationPercent;
      totalWeight += allocation.totalAllocationPercent;
      
      if (normalized.riskScore > 60) {
        highRisk.push(allocation.projectId);
      }
    }
    
    const portfolioRisk = totalWeight > 0 ? weightedRisk / totalWeight : 0;
    
    if (portfolioRisk > 50) {
      return {
        type: 'risk',
        title: 'Elevated Portfolio Risk',
        description: `Portfolio risk score is ${portfolioRisk.toFixed(0)}, ` +
          `with ${highRisk.length} high-risk project(s)`,
        affectedProjects: highRisk,
        suggestedAction: 'Reduce exposure to high-risk projects or implement risk mitigation measures',
        impact: 'high',
      };
    }
    
    return null;
  }
  
  private getExpectedMinAllocation(classification: ProjectClassification): number {
    switch (classification) {
      case ProjectClassification.INVEST: return 0.15;
      case ProjectClassification.MAINTAIN: return 0.10;
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY: return 0.05;
      case ProjectClassification.OBSERVE: return 0.02;
      case ProjectClassification.TURNAROUND: return 0.05;
      case ProjectClassification.SUNSET: return 0.00;
      default: return 0.05;
    }
  }
  
  private getExpectedMaxAllocation(classification: ProjectClassification): number {
    switch (classification) {
      case ProjectClassification.INVEST: return 0.50;
      case ProjectClassification.MAINTAIN: return 0.35;
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY: return 0.25;
      case ProjectClassification.OBSERVE: return 0.10;
      case ProjectClassification.TURNAROUND: return 0.25;
      case ProjectClassification.SUNSET: return 0.05;
      default: return 0.25;
    }
  }
  
  // ==========================================================================
  // PRIORITIZED ACTIONS
  // ==========================================================================
  
  private generatePrioritizedActions(
    projectRecommendations: ProjectRecommendation[],
    portfolioInsights: PortfolioInsight[],
    simulationResults: PortfolioSimulationResult[]
  ): PortfolioAction[] {
    const actions: PortfolioAction[] = [];
    let actionId = 0;
    
    // Add actions from high-priority project recommendations
    for (const rec of projectRecommendations.filter(r => r.priority >= 7)) {
      actions.push({
        id: `action-${++actionId}`,
        action: this.actionToDescription(rec.recommendedAction, rec.projectName),
        targetProjectId: rec.projectId,
        priority: rec.priority,
        effort: this.actionToEffort(rec.recommendedAction),
        expectedImpact: rec.expectedImpact,
      });
    }
    
    // Add actions from portfolio insights
    for (const insight of portfolioInsights.filter(i => i.impact === 'high')) {
      actions.push({
        id: `action-${++actionId}`,
        action: insight.suggestedAction,
        priority: insight.type === 'risk' ? 9 : 7,
        effort: 'medium',
        expectedImpact: `Address ${insight.title.toLowerCase()}`,
      });
    }
    
    // Sort by priority
    return actions.sort((a, b) => b.priority - a.priority).slice(0, 10);
  }
  
  private actionToDescription(action: RecommendedAction, projectName: string): string {
    switch (action) {
      case RecommendedAction.INCREASE_INVESTMENT:
        return `Increase budget allocation to ${projectName}`;
      case RecommendedAction.REDUCE_INVESTMENT:
        return `Reduce budget allocation to ${projectName}`;
      case RecommendedAction.INCREASE_AUTOMATION:
        return `Enable more automated actions for ${projectName}`;
      case RecommendedAction.REDUCE_AUTOMATION:
        return `Require manual approval for ${projectName} actions`;
      case RecommendedAction.PAUSE_RISKY_ACTIONS:
        return `Pause all risky actions for ${projectName}`;
      case RecommendedAction.ACCELERATE_GROWTH:
        return `Fast-track growth initiatives for ${projectName}`;
      case RecommendedAction.FOCUS_ON_STABILITY:
        return `Prioritize stability measures for ${projectName}`;
      case RecommendedAction.INITIATE_TURNAROUND:
        return `Start turnaround program for ${projectName}`;
      case RecommendedAction.CONSIDER_SUNSET:
        return `Evaluate sunset plan for ${projectName}`;
      default:
        return `Review allocation for ${projectName}`;
    }
  }
  
  private actionToEffort(action: RecommendedAction): 'low' | 'medium' | 'high' {
    switch (action) {
      case RecommendedAction.INCREASE_AUTOMATION:
      case RecommendedAction.REDUCE_AUTOMATION:
        return 'low';
      case RecommendedAction.INCREASE_INVESTMENT:
      case RecommendedAction.REDUCE_INVESTMENT:
      case RecommendedAction.PAUSE_RISKY_ACTIONS:
        return 'medium';
      case RecommendedAction.ACCELERATE_GROWTH:
      case RecommendedAction.FOCUS_ON_STABILITY:
      case RecommendedAction.INITIATE_TURNAROUND:
      case RecommendedAction.CONSIDER_SUNSET:
        return 'high';
      default:
        return 'medium';
    }
  }
  
  // ==========================================================================
  // EXPECTED OUTCOMES
  // ==========================================================================
  
  private calculateExpectedOutcomes(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    projectRecommendations: ProjectRecommendation[],
    simulationResults: PortfolioSimulationResult[]
  ): ExpectedOutcome[] {
    const outcomes: ExpectedOutcome[] = [];
    
    // Find best simulation result
    const bestResult = simulationResults.reduce(
      (best, current) => current.projectedPortfolioROI > best.projectedPortfolioROI ? current : best,
      simulationResults[0]
    );
    
    if (bestResult) {
      // ROI outcome
      outcomes.push({
        metric: 'Portfolio ROI',
        currentValue: this.calculateCurrentPortfolioROI(normalizedMetrics),
        projectedValue: bestResult.projectedPortfolioROI,
        changePercent: bestResult.roiChangeFromBaseline,
        timeframe: '90 days',
        confidence: bestResult.overallConfidence,
      });
      
      // Traffic outcome
      const currentTraffic = projects.reduce(
        (sum, p) => sum + p.traffic.currentMonthlyTraffic, 0
      );
      outcomes.push({
        metric: 'Total Traffic',
        currentValue: currentTraffic,
        projectedValue: bestResult.projectedTotalTraffic.mid,
        changePercent: bestResult.trafficChangeFromBaseline,
        timeframe: '90 days',
        confidence: bestResult.overallConfidence * 0.9,
      });
      
      // Risk outcome
      outcomes.push({
        metric: 'Portfolio Risk',
        currentValue: this.calculateCurrentPortfolioRisk(normalizedMetrics) * 100,
        projectedValue: bestResult.projectedPortfolioRisk * 100,
        changePercent: bestResult.riskChangeFromBaseline,
        timeframe: '90 days',
        confidence: bestResult.overallConfidence * 0.85,
      });
    }
    
    return outcomes;
  }
  
  private calculateCurrentPortfolioROI(
    normalizedMetrics: NormalizedProjectMetrics[]
  ): number {
    const totalROI = normalizedMetrics.reduce((sum, n) => sum + n.roiScore, 0);
    return normalizedMetrics.length > 0 ? totalROI / normalizedMetrics.length : 0;
  }
  
  private calculateCurrentPortfolioRisk(
    normalizedMetrics: NormalizedProjectMetrics[]
  ): number {
    const totalRisk = normalizedMetrics.reduce((sum, n) => sum + n.riskScore, 0);
    return normalizedMetrics.length > 0 ? (totalRisk / normalizedMetrics.length) / 100 : 0;
  }
  
  // ==========================================================================
  // RISK WARNINGS
  // ==========================================================================
  
  private generateRiskWarnings(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[],
    classifications: ProjectClassificationResult[],
    currentAllocation: PortfolioAllocation
  ): RiskWarning[] {
    const warnings: RiskWarning[] = [];
    
    // Check concentration
    const maxAllocation = Math.max(
      ...currentAllocation.projectAllocations.map(a => a.totalAllocationPercent)
    );
    if (maxAllocation > 0.4) {
      const topProject = currentAllocation.projectAllocations.find(
        a => a.totalAllocationPercent === maxAllocation
      );
      warnings.push({
        type: 'concentration',
        severity: maxAllocation > 0.5 ? 'critical' : 'warning',
        description: `Single project has ${(maxAllocation * 100).toFixed(0)}% of portfolio allocation`,
        affectedProjects: topProject ? [topProject.projectId] : [],
        suggestedMitigation: 'Redistribute resources to reduce concentration risk',
      });
    }
    
    // Check under-investment in INVEST projects
    const investProjects = classifications.filter(c => c.classification === ProjectClassification.INVEST);
    for (const invest of investProjects) {
      const allocation = currentAllocation.projectAllocations.find(a => a.projectId === invest.projectId);
      if (allocation && allocation.totalAllocationPercent < 0.1) {
        warnings.push({
          type: 'under_investment',
          severity: 'warning',
          description: `High-potential project ${allocation.projectName} has only ${(allocation.totalAllocationPercent * 100).toFixed(0)}% allocation`,
          affectedProjects: [invest.projectId],
          suggestedMitigation: 'Increase allocation to capture growth potential',
        });
      }
    }
    
    // Check over-automation in risky projects
    for (const allocation of currentAllocation.projectAllocations) {
      const normalized = normalizedMetrics.find(n => n.projectId === allocation.projectId);
      if (!normalized) continue;
      
      if (normalized.riskScore > 60 && allocation.automationLevel > 0.5) {
        warnings.push({
          type: 'over_automation',
          severity: 'warning',
          description: `High-risk project ${allocation.projectName} has automation level of ${(allocation.automationLevel * 100).toFixed(0)}%`,
          affectedProjects: [allocation.projectId],
          suggestedMitigation: 'Reduce automation level and require human approval',
        });
      }
    }
    
    // Check high-risk projects
    for (const normalized of normalizedMetrics) {
      if (normalized.riskScore > 75) {
        const project = projects.find(p => p.projectId === normalized.projectId);
        warnings.push({
          type: 'high_risk',
          severity: normalized.riskScore > 85 ? 'critical' : 'warning',
          description: `${project?.projectName || normalized.projectId} has critical risk score of ${normalized.riskScore.toFixed(0)}`,
          affectedProjects: [normalized.projectId],
          suggestedMitigation: 'Pause risky actions and address critical issues immediately',
        });
      }
    }
    
    return warnings;
  }
  
  // ==========================================================================
  // SUMMARY GENERATION
  // ==========================================================================
  
  private generateSummary(
    projectRecommendations: ProjectRecommendation[],
    portfolioInsights: PortfolioInsight[],
    riskWarnings: RiskWarning[]
  ): string {
    const parts: string[] = [];
    
    // Count recommendations by action
    const actionCounts = new Map<RecommendedAction, number>();
    for (const rec of projectRecommendations) {
      actionCounts.set(rec.recommendedAction, (actionCounts.get(rec.recommendedAction) || 0) + 1);
    }
    
    // Build summary
    parts.push(`Portfolio analysis of ${projectRecommendations.length} projects completed.`);
    
    // Investment summary
    const increaseCount = actionCounts.get(RecommendedAction.INCREASE_INVESTMENT) || 0;
    const reduceCount = actionCounts.get(RecommendedAction.REDUCE_INVESTMENT) || 0;
    if (increaseCount > 0) {
      parts.push(`${increaseCount} project(s) recommended for increased investment.`);
    }
    if (reduceCount > 0) {
      parts.push(`${reduceCount} project(s) recommended for reduced investment.`);
    }
    
    // Risk summary
    const criticalWarnings = riskWarnings.filter(w => w.severity === 'critical').length;
    if (criticalWarnings > 0) {
      parts.push(`⚠️ ${criticalWarnings} critical risk warning(s) require immediate attention.`);
    }
    
    // Opportunities summary
    const opportunities = portfolioInsights.filter(i => i.type === 'opportunity').length;
    if (opportunities > 0) {
      parts.push(`${opportunities} opportunity insight(s) identified for value capture.`);
    }
    
    return parts.join(' ');
  }
  
  private calculateOverallConfidence(
    projectRecommendations: ProjectRecommendation[],
    portfolioInsights: PortfolioInsight[]
  ): number {
    // Base confidence from recommendation consistency
    const avgPriority = projectRecommendations.reduce(
      (sum, r) => sum + r.priority, 0
    ) / (projectRecommendations.length || 1);
    
    let confidence = 0.7 + (avgPriority - 5) / 50;
    
    // Reduce confidence if many high-impact issues
    const highImpactIssues = portfolioInsights.filter(i => i.impact === 'high').length;
    confidence -= highImpactIssues * 0.05;
    
    return Math.max(0.4, Math.min(0.95, confidence));
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createRecommendationEngine(
  config?: Partial<PortfolioOptimizationConfig>,
  thresholds?: Partial<RecommendationThresholds>
): RecommendationEngine {
  return new RecommendationEngine(config, thresholds);
}

/**
 * Create engine with conservative thresholds
 */
export function createConservativeRecommendationEngine(): RecommendationEngine {
  return new RecommendationEngine({}, {
    increaseInvestmentMinROI: 80,
    reduceInvestmentMaxROI: 30,
    pauseActionsMinRisk: 65,
    concentrationWarningPercent: 0.35,
  });
}
