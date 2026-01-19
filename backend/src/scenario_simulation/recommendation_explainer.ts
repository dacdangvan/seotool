/**
 * Recommendation Explainer v1.5
 * 
 * Generates human-readable explanations and recommendations
 * from simulation results.
 * 
 * Output:
 * - Executive summary
 * - Trade-off explanations
 * - Risk warnings
 * - Action steps
 * 
 * Design Principles:
 * - Never recommend without explanation
 * - Highlight assumptions and uncertainties
 * - Provide actionable next steps
 */

import {
  Scenario,
  ScenarioType,
  SimulationResult,
  ScenarioComparison,
  ScenarioRanking,
  SimulationRecommendation,
  RecommendedScenario,
  NotRecommendedScenario,
  ExpectedOutcome,
  TimeHorizon,
} from './models';

// ============================================================================
// RECOMMENDATION EXPLAINER
// ============================================================================

export class RecommendationExplainer {
  private logger: Console;
  
  constructor() {
    this.logger = console;
  }
  
  /**
   * Generate full recommendation from comparison results
   */
  generateRecommendation(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>,
    comparison: ScenarioComparison
  ): SimulationRecommendation {
    this.logger.log('[Explainer] Generating recommendation');
    
    const bestScenario = this.selectBestScenario(scenarios, results, comparison);
    const safeAlternative = this.findSafeAlternative(scenarios, results, comparison);
    const notRecommended = this.identifyNotRecommended(scenarios, results, comparison);
    
    const summary = this.generateSummary(bestScenario, safeAlternative, comparison);
    const keyTradeOffs = this.extractKeyTradeOffs(comparison);
    const sensitivityNotes = this.generateSensitivityNotes(results, comparison);
    const nextSteps = this.generateNextSteps(bestScenario, results);
    
    return {
      id: `rec_${Date.now()}`,
      projectId: scenarios[0]?.projectId || '',
      generatedAt: new Date().toISOString(),
      bestScenario,
      safeAlternative,
      notRecommended,
      summary,
      keyTradeOffs,
      sensitivityNotes,
      nextSteps,
    };
  }
  
  /**
   * Select best scenario with full reasoning
   */
  private selectBestScenario(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>,
    comparison: ScenarioComparison
  ): RecommendedScenario {
    // Get top ranked scenario
    const topRanking = comparison.rankings[0];
    if (!topRanking) {
      return this.createNoRecommendation();
    }
    
    const scenario = scenarios.find(s => s.id === topRanking.scenarioId);
    const result = results.get(topRanking.scenarioId);
    
    if (!scenario || !result) {
      return this.createNoRecommendation();
    }
    
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: scenario.type,
      reasons: this.buildReasons(topRanking, result),
      expectedOutcomes: this.buildExpectedOutcomes(result),
      keyRisks: this.buildKeyRisks(result),
      confidence: result.overallConfidence,
      suggestedTiming: this.suggestTiming(scenario, result),
    };
  }
  
  /**
   * Find a safe alternative (lower risk option)
   */
  private findSafeAlternative(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>,
    comparison: ScenarioComparison
  ): RecommendedScenario | null {
    // Find lowest risk scenario that isn't baseline
    let lowestRiskScenario: Scenario | null = null;
    let lowestRiskResult: SimulationResult | null = null;
    let lowestRisk = Infinity;
    
    for (const scenario of scenarios) {
      if (scenario.type === ScenarioType.BASELINE) continue;
      
      const result = results.get(scenario.id);
      if (!result) continue;
      
      if (result.riskImpact.overallRiskScore < lowestRisk) {
        lowestRisk = result.riskImpact.overallRiskScore;
        lowestRiskScenario = scenario;
        lowestRiskResult = result;
      }
    }
    
    // Only return if it's different from best and has reasonable gains
    const bestId = comparison.rankings[0]?.scenarioId;
    if (!lowestRiskScenario || lowestRiskScenario.id === bestId || !lowestRiskResult) {
      return null;
    }
    
    const trafficGain = lowestRiskResult.trafficImpact.percentageChange[90]?.mid || 0;
    if (trafficGain < 1) {
      return null; // Not worth recommending if minimal gain
    }
    
    const ranking = comparison.rankings.find(r => r.scenarioId === lowestRiskScenario!.id);
    
    return {
      scenarioId: lowestRiskScenario.id,
      scenarioName: lowestRiskScenario.name,
      scenarioType: lowestRiskScenario.type,
      reasons: [
        'Lower risk exposure than top recommendation',
        `Risk score: ${(lowestRiskResult.riskImpact.overallRiskScore * 100).toFixed(0)}% vs ${((results.get(bestId || '')?.riskImpact.overallRiskScore || 0) * 100).toFixed(0)}%`,
        ...ranking?.strengths || [],
      ],
      expectedOutcomes: this.buildExpectedOutcomes(lowestRiskResult),
      keyRisks: this.buildKeyRisks(lowestRiskResult),
      confidence: lowestRiskResult.overallConfidence,
      suggestedTiming: this.suggestTiming(lowestRiskScenario, lowestRiskResult),
    };
  }
  
  /**
   * Identify scenarios not recommended
   */
  private identifyNotRecommended(
    scenarios: Scenario[],
    results: Map<string, SimulationResult>,
    comparison: ScenarioComparison
  ): NotRecommendedScenario[] {
    const notRecommended: NotRecommendedScenario[] = [];
    const topRank = comparison.rankings[0]?.rank || 0;
    
    for (const ranking of comparison.rankings) {
      // Skip top 2 ranked scenarios
      if (ranking.rank <= 2) continue;
      
      const scenario = scenarios.find(s => s.id === ranking.scenarioId);
      const result = results.get(ranking.scenarioId);
      
      if (!scenario || !result) continue;
      
      notRecommended.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        reasons: this.buildNotRecommendedReasons(ranking, result, comparison),
        conditionsToReconsider: this.buildReconsiderConditions(ranking, result),
      });
    }
    
    return notRecommended;
  }
  
  /**
   * Build reasons for recommendation
   */
  private buildReasons(ranking: ScenarioRanking, result: SimulationResult): string[] {
    const reasons: string[] = [];
    
    // Rank-based reason
    if (ranking.rank === 1) {
      reasons.push(`Highest composite score (${ranking.compositeScore.toFixed(1)}) among all scenarios`);
    }
    
    // Strengths
    if (ranking.strengths.length > 0) {
      reasons.push(...ranking.strengths);
    }
    
    // Traffic gain
    const trafficGain = result.trafficImpact.percentageChange[90]?.mid || 0;
    if (trafficGain > 5) {
      reasons.push(`Expected traffic increase of ${trafficGain.toFixed(1)}% over 90 days`);
    }
    
    // Confidence
    if (result.overallConfidence > 0.7) {
      reasons.push(`High confidence in projections (${(result.overallConfidence * 100).toFixed(0)}%)`);
    }
    
    // ROI
    if (result.scores.estimatedROI > 100) {
      reasons.push(`Strong estimated ROI: ${result.scores.estimatedROI.toFixed(0)}%`);
    }
    
    return reasons;
  }
  
  /**
   * Build expected outcomes
   */
  private buildExpectedOutcomes(result: SimulationResult): ExpectedOutcome[] {
    const outcomes: ExpectedOutcome[] = [];
    
    // Traffic outcome
    outcomes.push({
      metric: 'Organic Traffic',
      currentValue: result.trafficImpact.currentTraffic,
      projectedValue: result.trafficImpact.projectedTraffic[90],
      timeHorizon: 90,
      unit: 'sessions/month',
    });
    
    // Ranking outcome
    outcomes.push({
      metric: 'Average Position Change',
      currentValue: 0,
      projectedValue: result.rankingImpact.avgPositionChange[90],
      timeHorizon: 90,
      unit: 'positions',
    });
    
    return outcomes;
  }
  
  /**
   * Build key risks
   */
  private buildKeyRisks(result: SimulationResult): string[] {
    const risks: string[] = [];
    
    // High-scoring risk categories
    for (const categoryRisk of result.riskImpact.categoryRisks) {
      if (categoryRisk.score > 0.4) {
        risks.push(`${categoryRisk.description} (${(categoryRisk.probability * 100).toFixed(0)}% probability)`);
      }
    }
    
    // Potential downsides
    for (const downside of result.riskImpact.potentialDownsides.slice(0, 2)) {
      if (downside.probability > 0.3) {
        risks.push(downside.description);
      }
    }
    
    // Brand risks
    if (result.brandImpact.driftRisk > 0.3) {
      risks.push('Brand consistency may be affected');
    }
    
    return risks.slice(0, 5);
  }
  
  /**
   * Suggest timing
   */
  private suggestTiming(scenario: Scenario, result: SimulationResult): string {
    // Based on scenario type
    if (scenario.type === ScenarioType.DELAYED) {
      const delay = scenario.parameters.delayDays || 14;
      return `Execute after ${delay} days of additional monitoring`;
    }
    
    if (scenario.type === ScenarioType.PHASED) {
      const phases = scenario.parameters.phaseCount || 3;
      const daysBetween = scenario.parameters.daysBetweenPhases || 7;
      return `Execute in ${phases} phases, ${daysBetween} days apart`;
    }
    
    // Based on confidence
    if (result.overallConfidence < 0.5) {
      return 'Gather more data before executing';
    }
    
    // Based on risk
    if (result.riskImpact.overallRiskScore > 0.5) {
      return 'Execute with careful monitoring';
    }
    
    return 'Ready for immediate execution';
  }
  
  /**
   * Build reasons for not recommending
   */
  private buildNotRecommendedReasons(
    ranking: ScenarioRanking,
    result: SimulationResult,
    comparison: ScenarioComparison
  ): string[] {
    const reasons: string[] = [];
    
    // Weaknesses
    if (ranking.weaknesses.length > 0) {
      reasons.push(...ranking.weaknesses);
    }
    
    // Comparison to top
    const topScore = comparison.rankings[0]?.compositeScore || 0;
    const scoreDiff = topScore - ranking.compositeScore;
    if (scoreDiff > 10) {
      reasons.push(`Composite score ${scoreDiff.toFixed(1)} points below top option`);
    }
    
    // Risk
    if (result.riskImpact.overallRiskScore > 0.6) {
      reasons.push('Elevated risk exposure');
    }
    
    // Low gains
    const trafficGain = result.trafficImpact.percentageChange[90]?.mid || 0;
    if (trafficGain < 2) {
      reasons.push('Minimal expected traffic improvement');
    }
    
    return reasons;
  }
  
  /**
   * Build conditions to reconsider
   */
  private buildReconsiderConditions(
    ranking: ScenarioRanking,
    result: SimulationResult
  ): string[] {
    const conditions: string[] = [];
    
    if (ranking.weaknesses.includes('High risk exposure')) {
      conditions.push('If risk tolerance increases');
    }
    
    if (ranking.weaknesses.includes('High implementation effort')) {
      conditions.push('If additional resources become available');
    }
    
    if (result.overallConfidence < 0.5) {
      conditions.push('If more historical data becomes available');
    }
    
    conditions.push('If business priorities change');
    
    return conditions;
  }
  
  /**
   * Generate executive summary
   */
  private generateSummary(
    bestScenario: RecommendedScenario,
    safeAlternative: RecommendedScenario | null,
    comparison: ScenarioComparison
  ): string {
    let summary = `Recommendation: ${bestScenario.scenarioName} (${bestScenario.scenarioType})`;
    
    summary += ` with ${(bestScenario.confidence * 100).toFixed(0)}% confidence.`;
    
    if (bestScenario.reasons.length > 0) {
      summary += ` Key reason: ${bestScenario.reasons[0]}.`;
    }
    
    if (safeAlternative) {
      summary += ` Alternative: ${safeAlternative.scenarioName} for lower risk.`;
    }
    
    const analyzed = comparison.scenarioIds.length;
    summary += ` Analyzed ${analyzed} scenarios.`;
    
    return summary;
  }
  
  /**
   * Extract key trade-offs
   */
  private extractKeyTradeOffs(comparison: ScenarioComparison): string[] {
    const tradeOffs: string[] = [];
    
    for (const analysis of comparison.tradeOffs.slice(0, 3)) {
      tradeOffs.push(analysis.explanation);
    }
    
    return tradeOffs;
  }
  
  /**
   * Generate sensitivity notes
   */
  private generateSensitivityNotes(
    results: Map<string, SimulationResult>,
    comparison: ScenarioComparison
  ): string[] {
    const notes: string[] = [];
    
    // Check for close rankings
    if (comparison.rankings.length >= 2) {
      const diff = comparison.rankings[0].compositeScore - comparison.rankings[1].compositeScore;
      if (diff < 5) {
        notes.push('Top scenarios are very close - small changes in weights could change recommendation');
      }
    }
    
    // Check for low confidence results
    const lowConfidenceResults = Array.from(results.values()).filter(r => r.overallConfidence < 0.5);
    if (lowConfidenceResults.length > 0) {
      notes.push(`${lowConfidenceResults.length} scenarios have low confidence projections`);
    }
    
    // Assumption sensitivity
    notes.push('Projections assume stable competitive environment');
    notes.push('Traffic estimates based on historical trends - sudden algorithm changes not modeled');
    
    return notes;
  }
  
  /**
   * Generate next steps
   */
  private generateNextSteps(
    bestScenario: RecommendedScenario,
    results: Map<string, SimulationResult>
  ): string[] {
    const steps: string[] = [];
    
    const result = results.get(bestScenario.scenarioId);
    
    // Confidence-based steps
    if (bestScenario.confidence < 0.5) {
      steps.push('Gather more historical data to improve projection confidence');
    }
    
    // Risk-based steps
    if (result && result.riskImpact.overallRiskScore > 0.4) {
      steps.push('Review risk mitigation strategies before execution');
    }
    
    // Brand-based steps
    if (result && result.brandImpact.driftRisk > 0.3) {
      steps.push('Review content changes with brand team');
    }
    
    // Execution steps
    if (bestScenario.scenarioType === ScenarioType.PHASED) {
      steps.push('Define success criteria for each phase before starting');
    }
    
    steps.push('Set up monitoring alerts for key metrics');
    steps.push('Schedule review checkpoint after first 30 days');
    
    return steps.slice(0, 5);
  }
  
  /**
   * Create a no-recommendation result
   */
  private createNoRecommendation(): RecommendedScenario {
    return {
      scenarioId: '',
      scenarioName: 'No Recommendation',
      scenarioType: ScenarioType.BASELINE,
      reasons: ['Insufficient data to make a recommendation'],
      expectedOutcomes: [],
      keyRisks: ['Unable to assess risks without proper simulation'],
      confidence: 0,
      suggestedTiming: 'Gather more data before proceeding',
    };
  }
  
  /**
   * Generate explanation for a specific scenario
   */
  explainScenario(
    scenario: Scenario,
    result: SimulationResult
  ): string {
    let explanation = `**${scenario.name}** (${scenario.type})\n\n`;
    
    // Traffic projection
    const trafficChange = result.trafficImpact.percentageChange[90]?.mid || 0;
    explanation += `**Traffic Impact:** ${trafficChange > 0 ? '+' : ''}${trafficChange.toFixed(1)}% projected change over 90 days\n`;
    explanation += `- 30-day: ${(result.trafficImpact.percentageChange[30]?.mid || 0).toFixed(1)}%\n`;
    explanation += `- 60-day: ${(result.trafficImpact.percentageChange[60]?.mid || 0).toFixed(1)}%\n\n`;
    
    // Risk assessment
    explanation += `**Risk Assessment:** ${(result.riskImpact.overallRiskScore * 100).toFixed(0)}% overall risk score\n`;
    for (const risk of result.riskImpact.categoryRisks.slice(0, 3)) {
      explanation += `- ${risk.description}\n`;
    }
    explanation += '\n';
    
    // Brand impact
    explanation += `**Brand Impact:** ${result.brandImpact.consistencyTrend} trend\n`;
    explanation += `- Drift risk: ${(result.brandImpact.driftRisk * 100).toFixed(0)}%\n`;
    if (result.brandImpact.potentialViolations.length > 0) {
      explanation += `- ${result.brandImpact.potentialViolations.length} potential violations identified\n`;
    }
    explanation += '\n';
    
    // Effort
    explanation += `**Implementation Effort:**\n`;
    explanation += `- Hours: ${result.effortEstimate.hoursRequired}\n`;
    explanation += `- Complexity: ${result.effortEstimate.complexity}\n`;
    explanation += `- Reversible: ${result.effortEstimate.reversible ? 'Yes' : 'No'}\n\n`;
    
    // Confidence
    explanation += `**Confidence Level:** ${(result.overallConfidence * 100).toFixed(0)}%\n`;
    
    // Key assumptions
    explanation += `\n**Key Assumptions:**\n`;
    for (const assumption of result.assumptions.slice(0, 3)) {
      explanation += `- ${assumption.description}\n`;
    }
    
    return explanation;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createRecommendationExplainer(): RecommendationExplainer {
  return new RecommendationExplainer();
}
