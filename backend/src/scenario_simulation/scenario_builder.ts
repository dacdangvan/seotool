/**
 * Scenario Builder v1.5
 * 
 * Generates multiple scenarios from proposed SEO actions.
 * 
 * Scenario Types:
 * - Baseline (do nothing)
 * - Proposed (as-is)
 * - Reduced scope
 * - Delayed execution
 * - Phased rollout
 * 
 * Design Principles:
 * - Always include baseline for comparison
 * - Generate meaningful variants
 * - Explain modifications clearly
 */

import { SEOAction } from '../autonomous_agent/models';
import {
  Scenario,
  ScenarioType,
  ScenarioAction,
  ScenarioModification,
  ScenarioParameters,
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
} from './models';

// ============================================================================
// SCENARIO BUILDER
// ============================================================================

export class ScenarioBuilder {
  private config: SimulationConfig;
  private logger: Console;
  
  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.logger = console;
  }
  
  /**
   * Build scenarios from proposed actions
   */
  buildScenarios(
    projectId: string,
    actions: SEOAction[],
    requestedTypes?: ScenarioType[]
  ): Scenario[] {
    this.logger.log(`[ScenarioBuilder] Building scenarios for ${actions.length} actions`);
    
    const scenarios: Scenario[] = [];
    
    // Determine which scenario types to generate
    const typesToGenerate = requestedTypes || this.getDefaultScenarioTypes(actions);
    
    // Always include baseline first
    if (this.config.alwaysIncludeBaseline || typesToGenerate.includes(ScenarioType.BASELINE)) {
      scenarios.push(this.buildBaselineScenario(projectId, actions));
    }
    
    // Build other scenarios
    for (const type of typesToGenerate) {
      if (type === ScenarioType.BASELINE) continue; // Already added
      
      const scenario = this.buildScenarioByType(projectId, actions, type);
      if (scenario) {
        scenarios.push(scenario);
      }
      
      // Respect max scenarios limit
      if (scenarios.length >= this.config.maxScenarios) {
        break;
      }
    }
    
    this.logger.log(`[ScenarioBuilder] Generated ${scenarios.length} scenarios`);
    return scenarios;
  }
  
  /**
   * Build baseline scenario (do nothing)
   */
  private buildBaselineScenario(projectId: string, actions: SEOAction[]): Scenario {
    const scenarioActions: ScenarioAction[] = actions.map(action => ({
      actionId: action.id,
      action,
      included: false,
      executionDelay: 0,
      scopeModifier: 0,
    }));
    
    return {
      id: this.generateScenarioId(projectId, ScenarioType.BASELINE),
      projectId,
      name: 'Baseline (Do Nothing)',
      description: 'Maintain current state without executing any proposed actions. Used as comparison baseline.',
      type: ScenarioType.BASELINE,
      actions: scenarioActions,
      modifications: actions.map(action => ({
        type: 'exclude' as const,
        targetActionId: action.id,
        originalValue: true,
        modifiedValue: false,
        reason: 'Baseline scenario excludes all actions',
      })),
      createdAt: new Date().toISOString(),
      parameters: {},
    };
  }
  
  /**
   * Build proposed scenario (execute as-is)
   */
  private buildProposedScenario(projectId: string, actions: SEOAction[]): Scenario {
    const scenarioActions: ScenarioAction[] = actions.map(action => ({
      actionId: action.id,
      action,
      included: true,
      executionDelay: 0,
      scopeModifier: 1.0,
    }));
    
    return {
      id: this.generateScenarioId(projectId, ScenarioType.PROPOSED),
      projectId,
      name: 'Proposed (Full Execution)',
      description: 'Execute all proposed actions immediately with full scope.',
      type: ScenarioType.PROPOSED,
      actions: scenarioActions,
      modifications: [],
      createdAt: new Date().toISOString(),
      parameters: {},
    };
  }
  
  /**
   * Build reduced scope scenario
   */
  private buildReducedScopeScenario(
    projectId: string,
    actions: SEOAction[],
    scopePercentage: number = 50
  ): Scenario {
    const scopeModifier = scopePercentage / 100;
    
    const scenarioActions: ScenarioAction[] = actions.map(action => ({
      actionId: action.id,
      action,
      included: true,
      executionDelay: 0,
      scopeModifier,
    }));
    
    const modifications: ScenarioModification[] = actions.map(action => ({
      type: 'reduce_scope' as const,
      targetActionId: action.id,
      originalValue: 1.0,
      modifiedValue: scopeModifier,
      reason: `Reduced to ${scopePercentage}% scope for risk mitigation`,
    }));
    
    return {
      id: this.generateScenarioId(projectId, ScenarioType.REDUCED_SCOPE),
      projectId,
      name: `Reduced Scope (${scopePercentage}%)`,
      description: `Execute actions with ${scopePercentage}% of original scope. Affects fewer pages/elements to reduce risk.`,
      type: ScenarioType.REDUCED_SCOPE,
      actions: scenarioActions,
      modifications,
      createdAt: new Date().toISOString(),
      parameters: {
        scopePercentage,
      },
    };
  }
  
  /**
   * Build delayed execution scenario
   */
  private buildDelayedScenario(
    projectId: string,
    actions: SEOAction[],
    delayDays: number = 14
  ): Scenario {
    const scenarioActions: ScenarioAction[] = actions.map(action => ({
      actionId: action.id,
      action,
      included: true,
      executionDelay: delayDays,
      scopeModifier: 1.0,
    }));
    
    const modifications: ScenarioModification[] = actions.map(action => ({
      type: 'delay' as const,
      targetActionId: action.id,
      originalValue: 0,
      modifiedValue: delayDays,
      reason: `Delayed by ${delayDays} days to gather more data or await favorable conditions`,
    }));
    
    return {
      id: this.generateScenarioId(projectId, ScenarioType.DELAYED),
      projectId,
      name: `Delayed Execution (${delayDays} days)`,
      description: `Execute all actions after ${delayDays} day delay. Allows time for more data collection or market timing.`,
      type: ScenarioType.DELAYED,
      actions: scenarioActions,
      modifications,
      createdAt: new Date().toISOString(),
      parameters: {
        delayDays,
      },
    };
  }
  
  /**
   * Build phased rollout scenario
   */
  private buildPhasedScenario(
    projectId: string,
    actions: SEOAction[],
    phaseCount: number = 3,
    daysBetweenPhases: number = 7
  ): Scenario {
    const actionsPerPhase = Math.ceil(actions.length / phaseCount);
    
    const scenarioActions: ScenarioAction[] = actions.map((action, index) => {
      const phase = Math.floor(index / actionsPerPhase);
      const delay = phase * daysBetweenPhases;
      
      return {
        actionId: action.id,
        action,
        included: true,
        executionDelay: delay,
        scopeModifier: 1.0,
      };
    });
    
    const modifications: ScenarioModification[] = actions.map((action, index) => {
      const phase = Math.floor(index / actionsPerPhase) + 1;
      const delay = (phase - 1) * daysBetweenPhases;
      
      return {
        type: 'delay' as const,
        targetActionId: action.id,
        originalValue: 0,
        modifiedValue: delay,
        reason: `Phase ${phase} of ${phaseCount}: executed on day ${delay}`,
      };
    });
    
    return {
      id: this.generateScenarioId(projectId, ScenarioType.PHASED),
      projectId,
      name: `Phased Rollout (${phaseCount} phases)`,
      description: `Execute actions in ${phaseCount} phases, ${daysBetweenPhases} days apart. Allows monitoring between phases.`,
      type: ScenarioType.PHASED,
      actions: scenarioActions,
      modifications,
      createdAt: new Date().toISOString(),
      parameters: {
        phaseCount,
        daysBetweenPhases,
      },
    };
  }
  
  /**
   * Build scenario by type
   */
  private buildScenarioByType(
    projectId: string,
    actions: SEOAction[],
    type: ScenarioType
  ): Scenario | null {
    switch (type) {
      case ScenarioType.BASELINE:
        return this.buildBaselineScenario(projectId, actions);
      
      case ScenarioType.PROPOSED:
        return this.buildProposedScenario(projectId, actions);
      
      case ScenarioType.REDUCED_SCOPE:
        return this.buildReducedScopeScenario(projectId, actions, 50);
      
      case ScenarioType.DELAYED:
        return this.buildDelayedScenario(projectId, actions, 14);
      
      case ScenarioType.PHASED:
        return this.buildPhasedScenario(projectId, actions, 3, 7);
      
      default:
        this.logger.warn(`[ScenarioBuilder] Unknown scenario type: ${type}`);
        return null;
    }
  }
  
  /**
   * Get default scenario types based on actions
   */
  private getDefaultScenarioTypes(actions: SEOAction[]): ScenarioType[] {
    const types: ScenarioType[] = [
      ScenarioType.BASELINE,
      ScenarioType.PROPOSED,
    ];
    
    // Add reduced scope if any high-impact actions
    const hasHighImpact = actions.some(a => 
      a.expectedImpact?.confidence === 'high' || a.type.toString().includes('REWRITE')
    );
    if (hasHighImpact) {
      types.push(ScenarioType.REDUCED_SCOPE);
    }
    
    // Add phased if multiple actions
    if (actions.length >= 3) {
      types.push(ScenarioType.PHASED);
    }
    
    // Add delayed for risky actions
    const hasRiskyActions = actions.some(a => 
      a.type.toString().includes('DELETE') || a.type.toString().includes('REDIRECT')
    );
    if (hasRiskyActions) {
      types.push(ScenarioType.DELAYED);
    }
    
    return types;
  }
  
  /**
   * Generate unique scenario ID
   */
  private generateScenarioId(projectId: string, type: ScenarioType): string {
    return `scenario-${projectId}-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  
  /**
   * Create custom scenario
   */
  createCustomScenario(
    projectId: string,
    name: string,
    description: string,
    actions: SEOAction[],
    modifications: Array<{
      actionId: string;
      included: boolean;
      delay?: number;
      scopeModifier?: number;
    }>
  ): Scenario {
    const modMap = new Map(modifications.map(m => [m.actionId, m]));
    
    const scenarioActions: ScenarioAction[] = actions.map(action => {
      const mod = modMap.get(action.id);
      return {
        actionId: action.id,
        action,
        included: mod?.included ?? true,
        executionDelay: mod?.delay ?? 0,
        scopeModifier: mod?.scopeModifier ?? 1.0,
      };
    });
    
    const scenarioModifications: ScenarioModification[] = modifications
      .filter(m => !m.included || m.delay || m.scopeModifier !== 1.0)
      .map(m => ({
        type: !m.included ? 'exclude' as const : 
              m.delay ? 'delay' as const : 'reduce_scope' as const,
        targetActionId: m.actionId,
        originalValue: !m.included ? true : (m.delay ? 0 : 1.0),
        modifiedValue: !m.included ? false : (m.delay || m.scopeModifier || 1.0),
        reason: 'Custom modification',
      }));
    
    return {
      id: this.generateScenarioId(projectId, ScenarioType.CUSTOM),
      projectId,
      name,
      description,
      type: ScenarioType.CUSTOM,
      actions: scenarioActions,
      modifications: scenarioModifications,
      createdAt: new Date().toISOString(),
      parameters: { custom: { modifications } },
    };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createScenarioBuilder(
  config?: Partial<SimulationConfig>
): ScenarioBuilder {
  return new ScenarioBuilder(config);
}
