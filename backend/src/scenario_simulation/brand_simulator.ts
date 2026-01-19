/**
 * Brand Impact Simulator v1.5
 * 
 * Simulates brand consistency impact for scenarios.
 * Integrates with v1.4 Brand Style Guardrail system.
 * 
 * Evaluates:
 * - Brand voice consistency
 * - Messaging alignment
 * - Terminology compliance
 * - Visual/format consistency
 * 
 * Design Principles:
 * - Leverage existing brand profiles
 * - Quantifiable compliance scores
 * - Explainable deviations
 */

import { ActionType } from '../autonomous_agent/models';
import {
  Scenario,
  ScenarioType,
  BrandImpact,
  BrandViolationRisk,
  HistoricalData,
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
  SimulationAssumption,
  TimeHorizon,
  ConfidenceInterval,
} from './models';
import {
  BrandStyleProfile,
  StyleAttributes,
} from '../brand_guardrail/models';

// ============================================================================
// BRAND DIMENSION TYPES (local to this module)
// ============================================================================

enum BrandDimension {
  VOICE_CONSISTENCY = 'voice_consistency',
  MESSAGING_ALIGNMENT = 'messaging_alignment',
  TERMINOLOGY_COMPLIANCE = 'terminology_compliance',
  FORMAT_ADHERENCE = 'format_adherence',
}

interface BrandDimensionImpact {
  dimension: BrandDimension;
  currentScore: number;
  projectedScore: number;
  delta: number;
  confidence: number;
  drivers: string[];
}

// ============================================================================
// ACTION BRAND IMPACT WEIGHTS
// ============================================================================

interface BrandImpactWeight {
  voiceConsistency: number;
  messagingAlignment: number;
  terminologyCompliance: number;
  formatAdherence: number;
}

const ACTION_BRAND_WEIGHTS: Record<string, BrandImpactWeight> = {
  [ActionType.CREATE_CONTENT]: {
    voiceConsistency: 0.4,
    messagingAlignment: 0.3,
    terminologyCompliance: 0.2,
    formatAdherence: 0.1,
  },
  [ActionType.UPDATE_CONTENT]: {
    voiceConsistency: 0.35,
    messagingAlignment: 0.3,
    terminologyCompliance: 0.25,
    formatAdherence: 0.1,
  },
  [ActionType.OPTIMIZE_CONTENT]: {
    voiceConsistency: 0.3,
    messagingAlignment: 0.2,
    terminologyCompliance: 0.4,
    formatAdherence: 0.1,
  },
  [ActionType.TARGET_NEW_KEYWORD]: {
    voiceConsistency: 0.1,
    messagingAlignment: 0.2,
    terminologyCompliance: 0.6,
    formatAdherence: 0.1,
  },
  default: {
    voiceConsistency: 0.25,
    messagingAlignment: 0.25,
    terminologyCompliance: 0.25,
    formatAdherence: 0.25,
  },
};

// ============================================================================
// BRAND SIMULATOR
// ============================================================================

export class BrandImpactSimulator {
  private config: SimulationConfig;
  private brandProfile: BrandStyleProfile | null = null;
  private logger: Console;
  
  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.logger = console;
  }
  
  /**
   * Set the brand profile to use for simulation
   */
  setBrandProfile(profile: BrandStyleProfile): void {
    this.brandProfile = profile;
    this.logger.log(`[BrandSimulator] Brand profile set: ${profile.projectId}`);
  }
  
  /**
   * Simulate brand impact for a scenario
   */
  simulateBrandImpact(
    scenario: Scenario,
    historicalData: HistoricalData
  ): { impact: BrandImpact; assumptions: SimulationAssumption[] } {
    this.logger.log(`[BrandSimulator] Simulating brand impact for: ${scenario.name}`);
    
    const assumptions: SimulationAssumption[] = [];
    
    // Baseline scenario has no brand impact change
    if (scenario.type === ScenarioType.BASELINE) {
      return this.createBaselineBrandImpact(historicalData, assumptions);
    }
    
    // Check if we have brand profile
    if (!this.brandProfile) {
      assumptions.push({
        id: 'no-brand-profile',
        category: 'brand',
        description: 'No brand profile available - using default brand impact assumptions',
        basis: 'Default neutral impact when brand guidelines unknown',
        sensitivity: 'high',
      });
      
      return this.createDefaultBrandImpact(assumptions);
    }
    
    // Calculate dimension impacts
    const dimensionImpacts = this.calculateDimensionImpacts(scenario, assumptions);
    
    // Calculate overall brand score
    const projectedBrandScore = this.calculateProjectedBrandScore(dimensionImpacts);
    
    // Identify potential violations
    const potentialViolations = this.identifyPotentialViolations(scenario, dimensionImpacts);
    
    // Determine consistency trend
    const consistencyTrend = this.determineConsistencyTrend(dimensionImpacts);
    
    // Calculate drift risk
    const driftRisk = this.calculateDriftRisk(dimensionImpacts);
    
    // Get current score
    const currentScore = this.getCurrentBrandScore();
    
    const impact: BrandImpact = {
      currentBrandScore: currentScore,
      projectedBrandScore,
      driftRisk,
      potentialViolations,
      consistencyTrend,
    };
    
    return { impact, assumptions };
  }
  
  /**
   * Create baseline brand impact (no change)
   */
  private createBaselineBrandImpact(
    historicalData: HistoricalData,
    assumptions: SimulationAssumption[]
  ): { impact: BrandImpact; assumptions: SimulationAssumption[] } {
    const currentScore = this.getCurrentBrandScore();
    
    assumptions.push({
      id: 'baseline-brand',
      category: 'brand',
      description: 'Baseline assumes brand consistency maintained at current level',
      basis: `Current brand compliance score: ${currentScore.toFixed(1)}`,
      sensitivity: 'low',
    });
    
    const stableProjection: Record<TimeHorizon, ConfidenceInterval> = {
      30: { low: currentScore - 2, mid: currentScore, high: currentScore + 2, confidenceLevel: 0.95 },
      60: { low: currentScore - 3, mid: currentScore, high: currentScore + 3, confidenceLevel: 0.90 },
      90: { low: currentScore - 5, mid: currentScore, high: currentScore + 5, confidenceLevel: 0.85 },
    };
    
    const impact: BrandImpact = {
      currentBrandScore: currentScore,
      projectedBrandScore: stableProjection,
      driftRisk: 0.1,
      potentialViolations: [],
      consistencyTrend: 'stable',
    };
    
    return { impact, assumptions };
  }
  
  /**
   * Create default brand impact when no profile available
   */
  private createDefaultBrandImpact(
    assumptions: SimulationAssumption[]
  ): { impact: BrandImpact; assumptions: SimulationAssumption[] } {
    const neutralProjection: Record<TimeHorizon, ConfidenceInterval> = {
      30: { low: 60, mid: 70, high: 80, confidenceLevel: 0.6 },
      60: { low: 55, mid: 70, high: 85, confidenceLevel: 0.5 },
      90: { low: 50, mid: 70, high: 90, confidenceLevel: 0.4 },
    };
    
    const impact: BrandImpact = {
      currentBrandScore: 70,
      projectedBrandScore: neutralProjection,
      driftRisk: 0.3,
      potentialViolations: [],
      consistencyTrend: 'stable',
    };
    
    return { impact, assumptions };
  }
  
  /**
   * Calculate impact for each brand dimension
   */
  private calculateDimensionImpacts(
    scenario: Scenario,
    assumptions: SimulationAssumption[]
  ): BrandDimensionImpact[] {
    const impacts: BrandDimensionImpact[] = [];
    const includedActions = scenario.actions.filter(a => a.included);
    
    // Get current scores from brand profile
    const currentScores = this.getCurrentDimensionScores();
    
    // Calculate impact per dimension
    for (const dimension of Object.values(BrandDimension)) {
      const currentScore = currentScores[dimension as BrandDimension] || 70;
      
      // Aggregate action impacts
      let totalImpact = 0;
      let totalWeight = 0;
      const drivers: string[] = [];
      
      for (const action of includedActions) {
        const actionType = action.action.type.toString();
        const weights = ACTION_BRAND_WEIGHTS[actionType] || ACTION_BRAND_WEIGHTS.default;
        const dimensionWeight = this.getDimensionWeight(dimension as BrandDimension, weights);
        
        // Estimate impact based on action type and scope
        const actionImpact = this.estimateActionBrandImpact(
          action.action.type,
          dimension as BrandDimension,
          action.scopeModifier
        );
        
        totalImpact += actionImpact * dimensionWeight;
        totalWeight += dimensionWeight;
        
        if (Math.abs(actionImpact) > 5) {
          drivers.push(`${action.action.type}: ${actionImpact > 0 ? '+' : ''}${actionImpact.toFixed(0)} points`);
        }
      }
      
      // Calculate projected score
      const avgImpact = totalWeight > 0 ? totalImpact / totalWeight : 0;
      const projectedScore = Math.max(0, Math.min(100, currentScore + avgImpact));
      
      // Calculate confidence based on data availability
      const confidence = this.calculateDimensionConfidence(dimension as BrandDimension, includedActions.length);
      
      impacts.push({
        dimension: dimension as BrandDimension,
        currentScore,
        projectedScore,
        delta: projectedScore - currentScore,
        confidence,
        drivers: drivers.length > 0 ? drivers : ['No significant drivers identified'],
      });
    }
    
    assumptions.push({
      id: 'brand-dimension-impact',
      category: 'brand',
      description: 'Brand dimension impacts based on action type and historical patterns',
      basis: `Analyzed ${includedActions.length} actions against brand profile`,
      sensitivity: 'medium',
    });
    
    return impacts;
  }
  
  /**
   * Get current brand score
   */
  private getCurrentBrandScore(): number {
    if (!this.brandProfile) return 70;
    
    // Calculate from style attributes
    const attrs = this.brandProfile.styleAttributes;
    // Higher confidence in defined attributes = higher score
    const definedCount = Object.values(attrs).filter(v => v !== 0.5).length;
    return 60 + (definedCount * 5);
  }
  
  /**
   * Get current dimension scores from brand profile
   */
  private getCurrentDimensionScores(): Record<BrandDimension, number> {
    if (!this.brandProfile) {
      return {
        [BrandDimension.VOICE_CONSISTENCY]: 70,
        [BrandDimension.MESSAGING_ALIGNMENT]: 70,
        [BrandDimension.TERMINOLOGY_COMPLIANCE]: 70,
        [BrandDimension.FORMAT_ADHERENCE]: 70,
      };
    }
    
    // Map brand profile data to dimension scores
    const voiceScore = this.calculateVoiceScore();
    const messagingScore = 75; // Default when no key messages
    const terminologyScore = this.brandProfile.vocabulary.preferredTerms 
      ? (Object.keys(this.brandProfile.vocabulary.preferredTerms).length > 0 ? 80 : 60)
      : 60;
    const formatScore = 75; // Default format score
    
    return {
      [BrandDimension.VOICE_CONSISTENCY]: voiceScore,
      [BrandDimension.MESSAGING_ALIGNMENT]: messagingScore,
      [BrandDimension.TERMINOLOGY_COMPLIANCE]: terminologyScore,
      [BrandDimension.FORMAT_ADHERENCE]: formatScore,
    };
  }
  
  /**
   * Calculate voice score from brand profile
   */
  private calculateVoiceScore(): number {
    if (!this.brandProfile) return 70;
    
    const attrs = this.brandProfile.styleAttributes;
    // Count how many attributes are clearly defined (not neutral 0.5)
    const definedAttrs = Object.values(attrs).filter(v => Math.abs(v - 0.5) > 0.1);
    return 60 + (definedAttrs.length * 6);
  }
  
  /**
   * Get dimension weight from action weights
   */
  private getDimensionWeight(
    dimension: BrandDimension,
    weights: BrandImpactWeight
  ): number {
    switch (dimension) {
      case BrandDimension.VOICE_CONSISTENCY:
        return weights.voiceConsistency;
      case BrandDimension.MESSAGING_ALIGNMENT:
        return weights.messagingAlignment;
      case BrandDimension.TERMINOLOGY_COMPLIANCE:
        return weights.terminologyCompliance;
      case BrandDimension.FORMAT_ADHERENCE:
        return weights.formatAdherence;
      default:
        return 0.25;
    }
  }
  
  /**
   * Estimate brand impact of an action on a dimension
   */
  private estimateActionBrandImpact(
    actionType: ActionType,
    dimension: BrandDimension,
    scopeModifier: number
  ): number {
    // Base impact ranges by action type
    const baseImpacts: Record<string, Record<BrandDimension, { min: number; max: number }>> = {
      [ActionType.CREATE_CONTENT]: {
        [BrandDimension.VOICE_CONSISTENCY]: { min: -10, max: -2 },
        [BrandDimension.MESSAGING_ALIGNMENT]: { min: -8, max: 2 },
        [BrandDimension.TERMINOLOGY_COMPLIANCE]: { min: -5, max: 5 },
        [BrandDimension.FORMAT_ADHERENCE]: { min: -3, max: 3 },
      },
      [ActionType.UPDATE_CONTENT]: {
        [BrandDimension.VOICE_CONSISTENCY]: { min: -8, max: 5 },
        [BrandDimension.MESSAGING_ALIGNMENT]: { min: -5, max: 5 },
        [BrandDimension.TERMINOLOGY_COMPLIANCE]: { min: -3, max: 5 },
        [BrandDimension.FORMAT_ADHERENCE]: { min: -2, max: 3 },
      },
      [ActionType.OPTIMIZE_CONTENT]: {
        [BrandDimension.VOICE_CONSISTENCY]: { min: -5, max: 3 },
        [BrandDimension.MESSAGING_ALIGNMENT]: { min: -3, max: 3 },
        [BrandDimension.TERMINOLOGY_COMPLIANCE]: { min: -8, max: -2 }, // Optimization often affects terms
        [BrandDimension.FORMAT_ADHERENCE]: { min: -2, max: 2 },
      },
    };
    
    const actionImpacts = baseImpacts[actionType] || {
      [BrandDimension.VOICE_CONSISTENCY]: { min: -3, max: 3 },
      [BrandDimension.MESSAGING_ALIGNMENT]: { min: -3, max: 3 },
      [BrandDimension.TERMINOLOGY_COMPLIANCE]: { min: -3, max: 3 },
      [BrandDimension.FORMAT_ADHERENCE]: { min: -2, max: 2 },
    };
    
    const impact = actionImpacts[dimension] || { min: -2, max: 2 };
    
    // Use midpoint adjusted by scope (deterministic)
    const midpoint = (impact.min + impact.max) / 2;
    return midpoint * scopeModifier;
  }
  
  /**
   * Calculate confidence for dimension projection
   */
  private calculateDimensionConfidence(
    dimension: BrandDimension,
    actionCount: number
  ): number {
    let baseConfidence = 0.7;
    
    // Higher confidence with brand profile
    if (this.brandProfile) {
      baseConfidence += 0.15;
    }
    
    // More actions = lower confidence (more complexity)
    baseConfidence -= actionCount * 0.02;
    
    // Dimension-specific adjustments
    if (dimension === BrandDimension.TERMINOLOGY_COMPLIANCE && this.brandProfile?.vocabulary.preferredTerms) {
      baseConfidence += 0.1; // More confidence when terms are defined
    }
    
    return Math.max(0.3, Math.min(0.95, baseConfidence));
  }
  
  /**
   * Calculate projected overall brand score
   */
  private calculateProjectedBrandScore(
    dimensionImpacts: BrandDimensionImpact[]
  ): Record<TimeHorizon, ConfidenceInterval> {
    // Weight dimensions differently for overall score
    const dimensionWeights: Record<BrandDimension, number> = {
      [BrandDimension.VOICE_CONSISTENCY]: 0.35,
      [BrandDimension.MESSAGING_ALIGNMENT]: 0.30,
      [BrandDimension.TERMINOLOGY_COMPLIANCE]: 0.20,
      [BrandDimension.FORMAT_ADHERENCE]: 0.15,
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    let avgConfidence = 0;
    
    for (const impact of dimensionImpacts) {
      const weight = dimensionWeights[impact.dimension] || 0.25;
      weightedSum += impact.projectedScore * weight;
      totalWeight += weight;
      avgConfidence += impact.confidence;
    }
    
    const midScore = totalWeight > 0 ? weightedSum / totalWeight : 70;
    avgConfidence = dimensionImpacts.length > 0 ? avgConfidence / dimensionImpacts.length : 0.5;
    
    // Create confidence intervals that widen over time
    const variance = (1 - avgConfidence) * 15;
    
    return {
      30: {
        low: Math.max(0, midScore - variance),
        mid: midScore,
        high: Math.min(100, midScore + variance),
        confidenceLevel: avgConfidence,
      },
      60: {
        low: Math.max(0, midScore - variance * 1.5),
        mid: midScore,
        high: Math.min(100, midScore + variance * 1.5),
        confidenceLevel: avgConfidence * 0.9,
      },
      90: {
        low: Math.max(0, midScore - variance * 2),
        mid: midScore,
        high: Math.min(100, midScore + variance * 2),
        confidenceLevel: avgConfidence * 0.8,
      },
    };
  }
  
  /**
   * Identify potential brand violations
   */
  private identifyPotentialViolations(
    scenario: Scenario,
    dimensionImpacts: BrandDimensionImpact[]
  ): BrandViolationRisk[] {
    const violations: BrandViolationRisk[] = [];
    
    for (const impact of dimensionImpacts) {
      if (impact.delta < -10) {
        violations.push({
          type: `${impact.dimension}_degradation`,
          probability: Math.min(0.8, Math.abs(impact.delta) / 20),
          severity: 'warning',
          affectedContent: scenario.actions.filter(a => a.included).map(a => a.action.targetUrl || a.action.id),
        });
      }
      
      if (impact.projectedScore < 50) {
        violations.push({
          type: `${impact.dimension}_critical_low`,
          probability: 0.9,
          severity: 'blocking',
          affectedContent: scenario.actions.filter(a => a.included).map(a => a.action.targetUrl || a.action.id),
        });
      }
    }
    
    return violations;
  }
  
  /**
   * Determine consistency trend
   */
  private determineConsistencyTrend(
    dimensionImpacts: BrandDimensionImpact[]
  ): 'improving' | 'stable' | 'declining' {
    const totalDelta = dimensionImpacts.reduce((sum, d) => sum + d.delta, 0);
    
    if (totalDelta > 5) return 'improving';
    if (totalDelta < -5) return 'declining';
    return 'stable';
  }
  
  /**
   * Calculate drift risk
   */
  private calculateDriftRisk(dimensionImpacts: BrandDimensionImpact[]): number {
    const negativeDeltas = dimensionImpacts.filter(d => d.delta < 0);
    if (negativeDeltas.length === 0) return 0.1;
    
    const avgNegativeDelta = negativeDeltas.reduce((sum, d) => sum + Math.abs(d.delta), 0) / negativeDeltas.length;
    return Math.min(0.9, avgNegativeDelta / 20);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBrandImpactSimulator(
  config?: Partial<SimulationConfig>,
  brandProfile?: BrandStyleProfile
): BrandImpactSimulator {
  const simulator = new BrandImpactSimulator(config);
  if (brandProfile) {
    simulator.setBrandProfile(brandProfile);
  }
  return simulator;
}
