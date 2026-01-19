/**
 * Goal Interpreter
 * 
 * v1.0 - Translates high-level SEO goals into measurable objectives
 * 
 * Responsibilities:
 * - Parse natural language goals
 * - Map to SEO goal types
 * - Define measurable KPIs
 * - Set realistic targets based on current state
 */

import {
  SEOGoal,
  SEOGoalType,
  MeasurableObjective,
  AggregatedObservation,
} from './models';

// Goal type to metrics mapping
const GOAL_METRICS: Record<SEOGoalType, { metric: string; unit: string; trackingMethod: string }[]> = {
  [SEOGoalType.INCREASE_ORGANIC_TRAFFIC]: [
    { metric: 'organic_sessions', unit: 'sessions/month', trackingMethod: 'Google Analytics' },
    { metric: 'organic_users', unit: 'users/month', trackingMethod: 'Google Analytics' },
    { metric: 'click_through_rate', unit: '%', trackingMethod: 'Google Search Console' },
  ],
  [SEOGoalType.IMPROVE_KEYWORD_COVERAGE]: [
    { metric: 'keywords_ranking_top10', unit: 'keywords', trackingMethod: 'Rank Tracker' },
    { metric: 'keywords_ranking_top3', unit: 'keywords', trackingMethod: 'Rank Tracker' },
    { metric: 'keyword_visibility_score', unit: 'score', trackingMethod: 'Keyword Agent' },
  ],
  [SEOGoalType.REDUCE_SEO_RISK]: [
    { metric: 'seo_health_score', unit: 'score', trackingMethod: 'Technical SEO Agent' },
    { metric: 'critical_issues_count', unit: 'issues', trackingMethod: 'Technical SEO Agent' },
    { metric: 'core_web_vitals_pass_rate', unit: '%', trackingMethod: 'PageSpeed Insights' },
  ],
  [SEOGoalType.IMPROVE_CONTENT_QUALITY]: [
    { metric: 'average_content_score', unit: 'score', trackingMethod: 'Content Engine' },
    { metric: 'thin_content_pages', unit: 'pages', trackingMethod: 'Content Engine' },
    { metric: 'content_freshness_score', unit: 'score', trackingMethod: 'Content Engine' },
  ],
  [SEOGoalType.FIX_TECHNICAL_ISSUES]: [
    { metric: 'technical_errors_count', unit: 'errors', trackingMethod: 'Technical SEO Agent' },
    { metric: 'pages_with_issues', unit: 'pages', trackingMethod: 'Technical SEO Agent' },
    { metric: 'indexation_rate', unit: '%', trackingMethod: 'Google Search Console' },
  ],
  [SEOGoalType.BOOST_ENTITY_AUTHORITY]: [
    { metric: 'entity_coverage_score', unit: 'score', trackingMethod: 'Entity Agent' },
    { metric: 'internal_link_score', unit: 'score', trackingMethod: 'Entity Agent' },
    { metric: 'topical_authority_score', unit: 'score', trackingMethod: 'Entity Agent' },
  ],
};

// Default improvement targets by goal type
const DEFAULT_IMPROVEMENT_TARGETS: Record<SEOGoalType, number> = {
  [SEOGoalType.INCREASE_ORGANIC_TRAFFIC]: 0.20, // 20% increase
  [SEOGoalType.IMPROVE_KEYWORD_COVERAGE]: 0.30, // 30% more keywords
  [SEOGoalType.REDUCE_SEO_RISK]: 0.50, // 50% reduction in issues
  [SEOGoalType.IMPROVE_CONTENT_QUALITY]: 0.25, // 25% improvement
  [SEOGoalType.FIX_TECHNICAL_ISSUES]: 0.80, // 80% issues fixed
  [SEOGoalType.BOOST_ENTITY_AUTHORITY]: 0.25, // 25% improvement
};

export class GoalInterpreter {
  private logger: Console;

  constructor() {
    this.logger = console;
  }

  /**
   * Interpret a high-level goal and create measurable objectives
   */
  async interpretGoal(
    goal: SEOGoal,
    currentObservation: AggregatedObservation
  ): Promise<MeasurableObjective[]> {
    this.logger.log(`[GoalInterpreter] Interpreting goal: ${goal.type}`);
    
    const metrics = GOAL_METRICS[goal.type];
    if (!metrics) {
      throw new Error(`Unknown goal type: ${goal.type}`);
    }

    const objectives: MeasurableObjective[] = [];

    for (const metricDef of metrics) {
      const baseline = this.extractCurrentMetric(
        metricDef.metric,
        currentObservation
      );
      
      const target = this.calculateTarget(
        goal,
        metricDef.metric,
        baseline
      );

      objectives.push({
        goalId: goal.id,
        metric: metricDef.metric,
        baseline,
        target,
        currentProgress: baseline,
        unit: metricDef.unit,
        trackingMethod: metricDef.trackingMethod,
      });

      this.logger.log(
        `[GoalInterpreter] Objective: ${metricDef.metric} | Baseline: ${baseline} | Target: ${target}`
      );
    }

    return objectives;
  }

  /**
   * Parse natural language goal description into structured goal
   */
  parseNaturalLanguageGoal(
    projectId: string,
    description: string
  ): Partial<SEOGoal> {
    this.logger.log(`[GoalInterpreter] Parsing: "${description}"`);

    // Simple keyword-based classification
    const lowerDesc = description.toLowerCase();
    
    let goalType: SEOGoalType;
    let priority: SEOGoal['priority'] = 'medium';

    if (lowerDesc.includes('traffic') || lowerDesc.includes('visitor')) {
      goalType = SEOGoalType.INCREASE_ORGANIC_TRAFFIC;
    } else if (lowerDesc.includes('keyword') || lowerDesc.includes('ranking')) {
      goalType = SEOGoalType.IMPROVE_KEYWORD_COVERAGE;
    } else if (lowerDesc.includes('risk') || lowerDesc.includes('penalty') || lowerDesc.includes('safe')) {
      goalType = SEOGoalType.REDUCE_SEO_RISK;
      priority = 'high';
    } else if (lowerDesc.includes('content') || lowerDesc.includes('quality')) {
      goalType = SEOGoalType.IMPROVE_CONTENT_QUALITY;
    } else if (lowerDesc.includes('technical') || lowerDesc.includes('speed') || lowerDesc.includes('error')) {
      goalType = SEOGoalType.FIX_TECHNICAL_ISSUES;
    } else if (lowerDesc.includes('authority') || lowerDesc.includes('entity') || lowerDesc.includes('link')) {
      goalType = SEOGoalType.BOOST_ENTITY_AUTHORITY;
    } else {
      // Default to traffic improvement
      goalType = SEOGoalType.INCREASE_ORGANIC_TRAFFIC;
    }

    // Extract priority from description
    if (lowerDesc.includes('urgent') || lowerDesc.includes('critical') || lowerDesc.includes('asap')) {
      priority = 'critical';
    } else if (lowerDesc.includes('important') || lowerDesc.includes('high priority')) {
      priority = 'high';
    } else if (lowerDesc.includes('low priority') || lowerDesc.includes('when possible')) {
      priority = 'low';
    }

    // Extract target metric if mentioned
    const percentMatch = lowerDesc.match(/(\d+)\s*%/);
    const targetValue = percentMatch ? parseInt(percentMatch[1]) : undefined;

    return {
      projectId,
      type: goalType,
      description,
      priority,
      targetValue,
      status: 'active',
    };
  }

  /**
   * Validate that a goal is achievable and well-defined
   */
  validateGoal(goal: SEOGoal): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!goal.projectId) {
      issues.push('Project ID is required');
    }

    if (!goal.type || !Object.values(SEOGoalType).includes(goal.type)) {
      issues.push('Invalid goal type');
    }

    if (!goal.description || goal.description.length < 10) {
      issues.push('Goal description must be at least 10 characters');
    }

    if (goal.targetValue !== undefined && goal.targetValue <= 0) {
      issues.push('Target value must be positive');
    }

    if (goal.currentValue !== undefined && goal.targetValue !== undefined) {
      if (goal.type === SEOGoalType.REDUCE_SEO_RISK || 
          goal.type === SEOGoalType.FIX_TECHNICAL_ISSUES) {
        // For reduction goals, target should be less than current
        if (goal.targetValue > goal.currentValue) {
          issues.push('For reduction goals, target should be less than current value');
        }
      } else {
        // For improvement goals, target should be greater than current
        if (goal.targetValue < goal.currentValue) {
          issues.push('For improvement goals, target should be greater than current value');
        }
      }
    }

    if (goal.deadline) {
      const deadlineDate = new Date(goal.deadline);
      if (deadlineDate < new Date()) {
        issues.push('Deadline cannot be in the past');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Suggest realistic targets based on industry benchmarks
   */
  suggestTargets(
    goal: SEOGoal,
    currentObservation: AggregatedObservation
  ): { metric: string; suggestedTarget: number; reasoning: string }[] {
    const metrics = GOAL_METRICS[goal.type];
    const suggestions: { metric: string; suggestedTarget: number; reasoning: string }[] = [];

    for (const metricDef of metrics) {
      const current = this.extractCurrentMetric(metricDef.metric, currentObservation);
      const improvementRate = DEFAULT_IMPROVEMENT_TARGETS[goal.type];

      let suggestedTarget: number;
      let reasoning: string;

      if (goal.type === SEOGoalType.REDUCE_SEO_RISK || 
          goal.type === SEOGoalType.FIX_TECHNICAL_ISSUES) {
        // Reduction target
        suggestedTarget = Math.round(current * (1 - improvementRate));
        reasoning = `Reduce ${metricDef.metric} by ${improvementRate * 100}% from ${current} to ${suggestedTarget}`;
      } else {
        // Improvement target
        suggestedTarget = Math.round(current * (1 + improvementRate));
        reasoning = `Increase ${metricDef.metric} by ${improvementRate * 100}% from ${current} to ${suggestedTarget}`;
      }

      suggestions.push({
        metric: metricDef.metric,
        suggestedTarget,
        reasoning,
      });
    }

    return suggestions;
  }

  /**
   * Extract current metric value from observation
   */
  private extractCurrentMetric(
    metric: string,
    observation: AggregatedObservation
  ): number {
    // Search through all agent observations for the metric
    for (const obs of observation.observations) {
      if (obs.metrics && obs.metrics[metric] !== undefined) {
        return obs.metrics[metric];
      }
    }

    // Return default value if metric not found
    this.logger.warn(`[GoalInterpreter] Metric ${metric} not found in observation, using default`);
    return 0;
  }

  /**
   * Calculate target value based on goal and baseline
   */
  private calculateTarget(
    goal: SEOGoal,
    metric: string,
    baseline: number
  ): number {
    // If goal has explicit target, use it
    if (goal.targetValue !== undefined && goal.targetMetric === metric) {
      return goal.targetValue;
    }

    // Calculate based on default improvement rates
    const improvementRate = DEFAULT_IMPROVEMENT_TARGETS[goal.type];

    if (goal.type === SEOGoalType.REDUCE_SEO_RISK || 
        goal.type === SEOGoalType.FIX_TECHNICAL_ISSUES) {
      return Math.round(baseline * (1 - improvementRate));
    }

    return Math.round(baseline * (1 + improvementRate));
  }
}

export default GoalInterpreter;
