/**
 * Risk Simulator v1.5
 * 
 * Simulates SEO risk exposure for scenarios.
 * 
 * Risk Categories:
 * - Ranking drop risk
 * - Traffic loss risk
 * - Penalty risk (over-optimization)
 * - Technical failure risk
 * - Content quality risk
 * 
 * Design Principles:
 * - Conservative risk estimation
 * - Explainable risk factors
 * - Actionable mitigation suggestions
 */

import { ActionType } from '../autonomous_agent/models';
import {
  Scenario,
  ScenarioType,
  RiskImpact,
  CategoryRisk,
  RiskCategory,
  PotentialOutcome,
  HistoricalData,
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
  SimulationAssumption,
} from './models';

// ============================================================================
// RISK WEIGHTS BY ACTION TYPE
// ============================================================================

const ACTION_RISK_WEIGHTS: Record<string, Partial<Record<RiskCategory, number>>> = {
  [ActionType.CREATE_CONTENT]: {
    [RiskCategory.CONTENT_QUALITY]: 0.3,
    [RiskCategory.BRAND_DAMAGE]: 0.2,
    [RiskCategory.RANKING_DROP]: 0.1,
  },
  [ActionType.UPDATE_CONTENT]: {
    [RiskCategory.RANKING_DROP]: 0.4,
    [RiskCategory.CONTENT_QUALITY]: 0.3,
    [RiskCategory.BRAND_DAMAGE]: 0.2,
  },
  [ActionType.OPTIMIZE_CONTENT]: {
    [RiskCategory.RANKING_DROP]: 0.2,
    [RiskCategory.OVER_OPTIMIZATION]: 0.3,
  },
  [ActionType.ADD_INTERNAL_LINK]: {
    [RiskCategory.OVER_OPTIMIZATION]: 0.1,
    [RiskCategory.TECHNICAL_FAILURE]: 0.1,
  },
  [ActionType.FIX_SCHEMA_MARKUP]: {
    [RiskCategory.TECHNICAL_FAILURE]: 0.2,
    [RiskCategory.RANKING_DROP]: 0.1,
  },
  [ActionType.FIX_TECHNICAL_ISSUE]: {
    [RiskCategory.TECHNICAL_FAILURE]: 0.3,
    [RiskCategory.TRAFFIC_LOSS]: 0.2,
  },
  [ActionType.IMPROVE_PAGE_SPEED]: {
    [RiskCategory.TECHNICAL_FAILURE]: 0.2,
    [RiskCategory.RANKING_DROP]: 0.1,
  },
  [ActionType.TARGET_NEW_KEYWORD]: {
    [RiskCategory.OVER_OPTIMIZATION]: 0.2,
    [RiskCategory.RANKING_DROP]: 0.1,
  },
  [ActionType.IMPROVE_KEYWORD_RANKING]: {
    [RiskCategory.OVER_OPTIMIZATION]: 0.3,
    [RiskCategory.RANKING_DROP]: 0.2,
  },
  default: {
    [RiskCategory.RANKING_DROP]: 0.2,
    [RiskCategory.TRAFFIC_LOSS]: 0.1,
  },
};

// ============================================================================
// RISK SIMULATOR
// ============================================================================

export class RiskSimulator {
  private config: SimulationConfig;
  private logger: Console;
  
  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.logger = console;
  }
  
  /**
   * Simulate risk impact for a scenario
   */
  simulateRiskImpact(
    scenario: Scenario,
    historicalData: HistoricalData
  ): { impact: RiskImpact; assumptions: SimulationAssumption[] } {
    this.logger.log(`[RiskSimulator] Simulating risks for scenario: ${scenario.name}`);
    
    const assumptions: SimulationAssumption[] = [];
    
    // Baseline has minimal risk
    if (scenario.type === ScenarioType.BASELINE) {
      return this.createBaselineRiskImpact(assumptions);
    }
    
    // Calculate category risks
    const categoryRisks = this.calculateCategoryRisks(scenario, historicalData, assumptions);
    
    // Calculate overall risk score
    const overallRiskScore = this.calculateOverallRiskScore(categoryRisks);
    
    // Identify potential downsides
    const potentialDownsides = this.identifyPotentialDownsides(scenario, categoryRisks);
    
    // Identify mitigation factors
    const mitigationFactors = this.identifyMitigationFactors(scenario, historicalData);
    
    const impact: RiskImpact = {
      overallRiskScore,
      categoryRisks,
      potentialDownsides,
      mitigationFactors,
    };
    
    return { impact, assumptions };
  }
  
  /**
   * Create baseline (minimal) risk impact
   */
  private createBaselineRiskImpact(
    assumptions: SimulationAssumption[]
  ): { impact: RiskImpact; assumptions: SimulationAssumption[] } {
    assumptions.push({
      id: 'baseline-risk',
      category: 'risk',
      description: 'Baseline scenario assumes no action-related risks',
      basis: 'Maintaining current state without changes',
      sensitivity: 'low',
    });
    
    const impact: RiskImpact = {
      overallRiskScore: 0.1, // Small inherent risk from market changes
      categoryRisks: [
        {
          category: RiskCategory.RANKING_DROP,
          score: 0.1,
          probability: 0.2,
          impact: 'low',
          description: 'Natural ranking fluctuations without intervention',
        },
        {
          category: RiskCategory.TRAFFIC_LOSS,
          score: 0.1,
          probability: 0.15,
          impact: 'low',
          description: 'Potential traffic decline if competitors improve',
        },
      ],
      potentialDownsides: [
        {
          description: 'Competitors may gain advantage while you wait',
          probability: 0.3,
          severity: 'low',
          recoveryTime: 30,
        },
      ],
      mitigationFactors: [
        'No changes means no change-related risks',
        'Time to gather more data before action',
      ],
    };
    
    return { impact, assumptions };
  }
  
  /**
   * Calculate risks by category
   */
  private calculateCategoryRisks(
    scenario: Scenario,
    historicalData: HistoricalData,
    assumptions: SimulationAssumption[]
  ): CategoryRisk[] {
    const risks: CategoryRisk[] = [];
    const includedActions = scenario.actions.filter(a => a.included);
    
    // Aggregate risk weights from all actions
    const aggregatedRisks: Map<RiskCategory, { score: number; count: number }> = new Map();
    
    for (const action of includedActions) {
      const actionType = action.action.type.toString();
      const weights = ACTION_RISK_WEIGHTS[actionType] || ACTION_RISK_WEIGHTS.default;
      
      for (const [category, weight] of Object.entries(weights)) {
        const existing = aggregatedRisks.get(category as RiskCategory) || { score: 0, count: 0 };
        
        // Adjust weight by scope modifier (less scope = less risk)
        const adjustedWeight = (weight as number) * action.scopeModifier;
        
        aggregatedRisks.set(category as RiskCategory, {
          score: existing.score + adjustedWeight,
          count: existing.count + 1,
        });
      }
    }
    
    // Convert to CategoryRisk objects
    for (const [category, { score, count }] of aggregatedRisks.entries()) {
      const avgScore = count > 0 ? score / count : 0;
      const normalizedScore = Math.min(1, avgScore);
      
      risks.push({
        category,
        score: normalizedScore,
        probability: this.scoreToProbability(normalizedScore),
        impact: this.scoreToImpact(normalizedScore),
        description: this.getCategoryDescription(category, normalizedScore),
      });
    }
    
    // Apply scenario-type modifiers
    const modifiedRisks = this.applyScenarioModifiers(risks, scenario);
    
    // Add historical context
    const historicalFailureRate = this.calculateHistoricalFailureRate(historicalData);
    
    assumptions.push({
      id: 'historical-failure',
      category: 'risk',
      description: `Historical action failure rate: ${(historicalFailureRate * 100).toFixed(1)}%`,
      basis: `Based on ${historicalData.actionOutcomes.length} past action outcomes`,
      sensitivity: 'medium',
    });
    
    // Adjust risks based on historical failure rate
    return modifiedRisks.map(risk => ({
      ...risk,
      score: risk.score * (1 + historicalFailureRate * 0.5),
      probability: Math.min(0.95, risk.probability * (1 + historicalFailureRate)),
    }));
  }
  
  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(categoryRisks: CategoryRisk[]): number {
    if (categoryRisks.length === 0) return 0;
    
    // Weighted average with higher weight for high-impact risks
    const weights: Record<string, number> = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      critical: 2.0,
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const risk of categoryRisks) {
      const weight = weights[risk.impact];
      weightedSum += risk.score * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Identify potential negative outcomes
   */
  private identifyPotentialDownsides(
    scenario: Scenario,
    categoryRisks: CategoryRisk[]
  ): PotentialOutcome[] {
    const downsides: PotentialOutcome[] = [];
    
    for (const risk of categoryRisks) {
      if (risk.score > 0.3) {
        downsides.push({
          description: this.getDownsideDescription(risk.category),
          probability: risk.probability,
          severity: risk.impact === 'critical' ? 'high' : risk.impact as any,
          recoveryTime: this.getRecoveryTime(risk.category),
        });
      }
    }
    
    // Add scenario-specific downsides
    if (scenario.type === ScenarioType.DELAYED) {
      downsides.push({
        description: 'Opportunity cost: competitors may improve while waiting',
        probability: 0.4,
        severity: 'low',
        recoveryTime: 60,
      });
    }
    
    if (scenario.type === ScenarioType.REDUCED_SCOPE) {
      downsides.push({
        description: 'Partial execution may not achieve critical mass for results',
        probability: 0.3,
        severity: 'medium',
        recoveryTime: 30,
      });
    }
    
    return downsides.sort((a, b) => b.probability - a.probability);
  }
  
  /**
   * Identify risk mitigation factors
   */
  private identifyMitigationFactors(
    scenario: Scenario,
    historicalData: HistoricalData
  ): string[] {
    const factors: string[] = [];
    
    // Scenario-based mitigations
    if (scenario.type === ScenarioType.PHASED) {
      factors.push('Phased rollout allows monitoring and adjustment between phases');
    }
    
    if (scenario.type === ScenarioType.REDUCED_SCOPE) {
      factors.push('Reduced scope limits blast radius of potential issues');
    }
    
    if (scenario.type === ScenarioType.DELAYED) {
      factors.push('Delay allows gathering more data before commitment');
    }
    
    // Data-based mitigations
    const successfulOutcomes = historicalData.actionOutcomes.filter(o => o.success);
    if (successfulOutcomes.length > 5) {
      factors.push(`${successfulOutcomes.length} successful past actions indicate proven execution capability`);
    }
    
    // Technical health mitigations
    const recentTechnical = historicalData.technicalHealth.slice(-7);
    const avgTechnicalScore = recentTechnical.length > 0
      ? recentTechnical.reduce((sum, t) => sum + t.overallScore, 0) / recentTechnical.length
      : 0;
    
    if (avgTechnicalScore > 80) {
      factors.push('Strong technical foundation reduces implementation risk');
    }
    
    // Reversibility
    const includedActions = scenario.actions.filter(a => a.included);
    const reversibleCount = includedActions.filter(a => 
      !a.action.type.toString().includes('DELETE') && 
      !a.action.type.toString().includes('REDIRECT')
    ).length;
    
    if (reversibleCount === includedActions.length) {
      factors.push('All actions are reversible if issues arise');
    } else if (reversibleCount > includedActions.length * 0.5) {
      factors.push(`${reversibleCount} of ${includedActions.length} actions are reversible`);
    }
    
    return factors;
  }
  
  /**
   * Apply scenario-type risk modifiers
   */
  private applyScenarioModifiers(
    risks: CategoryRisk[],
    scenario: Scenario
  ): CategoryRisk[] {
    const modifiers: Record<ScenarioType, number> = {
      [ScenarioType.BASELINE]: 0.1, // Very low
      [ScenarioType.PROPOSED]: 1.0, // Full risk
      [ScenarioType.REDUCED_SCOPE]: 0.6, // Lower risk
      [ScenarioType.DELAYED]: 0.9, // Slightly lower (more prep time)
      [ScenarioType.PHASED]: 0.7, // Lower (can adjust)
      [ScenarioType.COMBINED]: 1.2, // Higher (complexity)
      [ScenarioType.CUSTOM]: 1.0, // Full risk
    };
    
    const modifier = modifiers[scenario.type] || 1.0;
    
    return risks.map(risk => ({
      ...risk,
      score: risk.score * modifier,
      probability: Math.min(0.95, risk.probability * modifier),
    }));
  }
  
  /**
   * Calculate historical failure rate
   */
  private calculateHistoricalFailureRate(historicalData: HistoricalData): number {
    const outcomes = historicalData.actionOutcomes;
    if (outcomes.length === 0) return 0.2; // Default assumption
    
    const failures = outcomes.filter(o => !o.success);
    return failures.length / outcomes.length;
  }
  
  /**
   * Convert score to probability
   */
  private scoreToProbability(score: number): number {
    // Non-linear mapping: higher scores have higher probability
    return Math.min(0.95, score * 0.8 + 0.1);
  }
  
  /**
   * Convert score to impact level
   */
  private scoreToImpact(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 0.25) return 'low';
    if (score < 0.5) return 'medium';
    if (score < 0.75) return 'high';
    return 'critical';
  }
  
  /**
   * Get category description
   */
  private getCategoryDescription(category: RiskCategory, score: number): string {
    const descriptions: Record<RiskCategory, (score: number) => string> = {
      [RiskCategory.RANKING_DROP]: (s) => 
        `${s < 0.3 ? 'Minor' : s < 0.6 ? 'Moderate' : 'Significant'} risk of keyword ranking decline`,
      [RiskCategory.TRAFFIC_LOSS]: (s) =>
        `${s < 0.3 ? 'Low' : s < 0.6 ? 'Medium' : 'High'} risk of organic traffic reduction`,
      [RiskCategory.PENALTY_RISK]: (s) =>
        `${s < 0.3 ? 'Minimal' : s < 0.6 ? 'Possible' : 'Elevated'} risk of search engine penalties`,
      [RiskCategory.BRAND_DAMAGE]: (s) =>
        `${s < 0.3 ? 'Low' : s < 0.6 ? 'Moderate' : 'Significant'} risk to brand consistency`,
      [RiskCategory.TECHNICAL_FAILURE]: (s) =>
        `${s < 0.3 ? 'Low' : s < 0.6 ? 'Moderate' : 'High'} risk of technical implementation issues`,
      [RiskCategory.CONTENT_QUALITY]: (s) =>
        `${s < 0.3 ? 'Minor' : s < 0.6 ? 'Moderate' : 'Significant'} risk of content quality degradation`,
      [RiskCategory.OVER_OPTIMIZATION]: (s) =>
        `${s < 0.3 ? 'Low' : s < 0.6 ? 'Moderate' : 'High'} risk of over-optimization signals`,
    };
    
    return descriptions[category]?.(score) || `Risk level: ${(score * 100).toFixed(0)}%`;
  }
  
  /**
   * Get downside description
   */
  private getDownsideDescription(category: RiskCategory): string {
    const descriptions: Record<RiskCategory, string> = {
      [RiskCategory.RANKING_DROP]: 'Keywords may lose positions, reducing visibility',
      [RiskCategory.TRAFFIC_LOSS]: 'Organic traffic may decline temporarily or permanently',
      [RiskCategory.PENALTY_RISK]: 'Search engine may apply manual or algorithmic penalties',
      [RiskCategory.BRAND_DAMAGE]: 'Brand voice or messaging consistency may be compromised',
      [RiskCategory.TECHNICAL_FAILURE]: 'Technical issues may cause site functionality problems',
      [RiskCategory.CONTENT_QUALITY]: 'Content quality scores may decrease',
      [RiskCategory.OVER_OPTIMIZATION]: 'Over-optimization may trigger ranking filters',
    };
    
    return descriptions[category] || 'Potential negative outcome';
  }
  
  /**
   * Get estimated recovery time
   */
  private getRecoveryTime(category: RiskCategory): number {
    const times: Record<RiskCategory, number> = {
      [RiskCategory.RANKING_DROP]: 45,
      [RiskCategory.TRAFFIC_LOSS]: 60,
      [RiskCategory.PENALTY_RISK]: 90,
      [RiskCategory.BRAND_DAMAGE]: 30,
      [RiskCategory.TECHNICAL_FAILURE]: 7,
      [RiskCategory.CONTENT_QUALITY]: 30,
      [RiskCategory.OVER_OPTIMIZATION]: 60,
    };
    
    return times[category] || 30;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createRiskSimulator(
  config?: Partial<SimulationConfig>
): RiskSimulator {
  return new RiskSimulator(config);
}
