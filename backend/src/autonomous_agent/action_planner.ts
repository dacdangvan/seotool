/**
 * Action Planner
 * 
 * v1.0 - Generates ranked SEO action plans based on reasoning results
 * 
 * Responsibilities:
 * - Convert prioritized problems into actionable tasks
 * - Estimate impact, effort, and risk for each action
 * - Order actions considering dependencies
 * - Generate comprehensive action plan
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SEOGoal,
  ReasoningResult,
  PrioritizedProblem,
  SEOGap,
  SEORisk,
  SEOOpportunity,
  SEOAction,
  ActionType,
  ActionPlan,
  ActionEvidence,
  AgentSource,
} from './models';

// Action templates for different problem types
interface ActionTemplate {
  type: ActionType;
  titleTemplate: string;
  descriptionTemplate: string;
  category: SEOAction['category'];
  defaultEffort: SEOAction['requiredEffort']['level'];
  defaultHours: number;
  requiredSkills: string[];
  timeToResult: string;
}

const GAP_ACTION_TEMPLATES: Record<string, ActionTemplate[]> = {
  content: [
    {
      type: ActionType.CREATE_CONTENT,
      titleTemplate: 'Create new content to fill gap',
      descriptionTemplate: 'Create comprehensive content addressing: {description}',
      category: 'content',
      defaultEffort: 'medium',
      defaultHours: 8,
      requiredSkills: ['Content Writing', 'SEO'],
      timeToResult: '4-6 weeks',
    },
    {
      type: ActionType.UPDATE_CONTENT,
      titleTemplate: 'Update existing content',
      descriptionTemplate: 'Improve and expand existing content: {description}',
      category: 'content',
      defaultEffort: 'low',
      defaultHours: 4,
      requiredSkills: ['Content Writing'],
      timeToResult: '2-4 weeks',
    },
  ],
  technical: [
    {
      type: ActionType.FIX_TECHNICAL_ISSUE,
      titleTemplate: 'Fix technical SEO issue',
      descriptionTemplate: 'Address technical issue: {description}',
      category: 'technical',
      defaultEffort: 'medium',
      defaultHours: 6,
      requiredSkills: ['Technical SEO', 'Web Development'],
      timeToResult: '1-2 weeks',
    },
    {
      type: ActionType.IMPROVE_PAGE_SPEED,
      titleTemplate: 'Improve page speed',
      descriptionTemplate: 'Optimize page performance: {description}',
      category: 'technical',
      defaultEffort: 'medium',
      defaultHours: 8,
      requiredSkills: ['Web Development', 'Performance Optimization'],
      timeToResult: '2-4 weeks',
    },
  ],
  links: [
    {
      type: ActionType.ADD_INTERNAL_LINK,
      titleTemplate: 'Add internal links',
      descriptionTemplate: 'Improve internal linking: {description}',
      category: 'links',
      defaultEffort: 'low',
      defaultHours: 2,
      requiredSkills: ['SEO', 'Content'],
      timeToResult: '1-2 weeks',
    },
  ],
  keywords: [
    {
      type: ActionType.TARGET_NEW_KEYWORD,
      titleTemplate: 'Target new keyword',
      descriptionTemplate: 'Create or optimize content for keyword: {description}',
      category: 'keywords',
      defaultEffort: 'medium',
      defaultHours: 6,
      requiredSkills: ['SEO', 'Content Writing'],
      timeToResult: '4-8 weeks',
    },
    {
      type: ActionType.IMPROVE_KEYWORD_RANKING,
      titleTemplate: 'Improve keyword ranking',
      descriptionTemplate: 'Boost ranking for: {description}',
      category: 'keywords',
      defaultEffort: 'medium',
      defaultHours: 4,
      requiredSkills: ['SEO', 'Content Optimization'],
      timeToResult: '4-6 weeks',
    },
  ],
  authority: [
    {
      type: ActionType.OPTIMIZE_ANCHOR_TEXT,
      titleTemplate: 'Optimize anchor text',
      descriptionTemplate: 'Improve entity signals: {description}',
      category: 'links',
      defaultEffort: 'low',
      defaultHours: 3,
      requiredSkills: ['SEO'],
      timeToResult: '2-4 weeks',
    },
  ],
};

const RISK_MITIGATION_TEMPLATES: Record<SEORisk['type'], ActionTemplate> = {
  penalty: {
    type: ActionType.FIX_TECHNICAL_ISSUE,
    titleTemplate: 'Mitigate penalty risk',
    descriptionTemplate: 'Address potential penalty issue: {description}',
    category: 'technical',
    defaultEffort: 'high',
    defaultHours: 16,
    requiredSkills: ['Technical SEO', 'Compliance'],
    timeToResult: '2-4 weeks',
  },
  ranking_drop: {
    type: ActionType.OPTIMIZE_CONTENT,
    titleTemplate: 'Prevent ranking drop',
    descriptionTemplate: 'Strengthen content to maintain rankings: {description}',
    category: 'content',
    defaultEffort: 'medium',
    defaultHours: 6,
    requiredSkills: ['SEO', 'Content'],
    timeToResult: '2-4 weeks',
  },
  traffic_loss: {
    type: ActionType.INVESTIGATE_ANOMALY,
    titleTemplate: 'Investigate traffic anomaly',
    descriptionTemplate: 'Analyze and address traffic issue: {description}',
    category: 'monitoring',
    defaultEffort: 'medium',
    defaultHours: 4,
    requiredSkills: ['Analytics', 'SEO'],
    timeToResult: '1-2 weeks',
  },
  technical_failure: {
    type: ActionType.FIX_TECHNICAL_ISSUE,
    titleTemplate: 'Fix technical failure',
    descriptionTemplate: 'Resolve critical technical issue: {description}',
    category: 'technical',
    defaultEffort: 'high',
    defaultHours: 8,
    requiredSkills: ['Technical SEO', 'Web Development'],
    timeToResult: '1-2 weeks',
  },
  competitor: {
    type: ActionType.OPTIMIZE_CONTENT,
    titleTemplate: 'Counter competitor action',
    descriptionTemplate: 'Strengthen position against competitor: {description}',
    category: 'content',
    defaultEffort: 'medium',
    defaultHours: 8,
    requiredSkills: ['SEO', 'Content Strategy'],
    timeToResult: '4-8 weeks',
  },
};

const OPPORTUNITY_TEMPLATES: Record<SEOOpportunity['type'], ActionTemplate> = {
  quick_win: {
    type: ActionType.OPTIMIZE_CONTENT,
    titleTemplate: 'Quick win optimization',
    descriptionTemplate: 'Capitalize on quick win: {description}',
    category: 'content',
    defaultEffort: 'low',
    defaultHours: 4,
    requiredSkills: ['SEO'],
    timeToResult: '2-4 weeks',
  },
  growth: {
    type: ActionType.CREATE_CONTENT,
    titleTemplate: 'Growth initiative',
    descriptionTemplate: 'Execute growth opportunity: {description}',
    category: 'content',
    defaultEffort: 'high',
    defaultHours: 16,
    requiredSkills: ['Content Strategy', 'SEO'],
    timeToResult: '2-3 months',
  },
  competitive: {
    type: ActionType.TARGET_NEW_KEYWORD,
    titleTemplate: 'Competitive opportunity',
    descriptionTemplate: 'Capture competitive opportunity: {description}',
    category: 'keywords',
    defaultEffort: 'medium',
    defaultHours: 8,
    requiredSkills: ['SEO', 'Content'],
    timeToResult: '4-8 weeks',
  },
  emerging: {
    type: ActionType.CREATE_CONTENT,
    titleTemplate: 'Emerging trend content',
    descriptionTemplate: 'Create content for emerging trend: {description}',
    category: 'content',
    defaultEffort: 'medium',
    defaultHours: 6,
    requiredSkills: ['Content Writing', 'Research'],
    timeToResult: '2-4 weeks',
  },
};

export class ActionPlanner {
  private logger: Console;

  constructor() {
    this.logger = console;
  }

  /**
   * Generate an action plan from reasoning results
   */
  async generatePlan(
    projectId: string,
    goals: SEOGoal[],
    reasoning: ReasoningResult
  ): Promise<ActionPlan> {
    this.logger.log(`[ActionPlanner] Generating action plan for project: ${projectId}`);

    const actions: SEOAction[] = [];

    // Generate actions for prioritized problems
    for (const problem of reasoning.prioritizedProblems) {
      const action = this.problemToAction(problem, reasoning, goals);
      if (action) {
        actions.push(action);
      }
    }

    // Resolve dependencies between actions
    const orderedActions = this.resolveDependencies(actions);

    // Calculate summary statistics
    const summary = this.calculateSummary(orderedActions);

    const plan: ActionPlan = {
      id: uuidv4(),
      projectId,
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Valid for 7 days
      status: 'draft',
      goalIds: goals.map(g => g.id),
      actions: orderedActions,
      summary,
      approvalStatus: {
        status: 'pending',
        approvedActionIds: [],
        rejectedActionIds: [],
      },
    };

    this.logger.log(
      `[ActionPlanner] Plan generated. ${plan.actions.length} actions, ${summary.estimatedTotalHours}h estimated`
    );

    return plan;
  }

  /**
   * Convert a prioritized problem into an action
   */
  private problemToAction(
    problem: PrioritizedProblem,
    reasoning: ReasoningResult,
    goals: SEOGoal[]
  ): SEOAction | null {
    let action: SEOAction | null = null;

    switch (problem.type) {
      case 'gap':
        action = this.gapToAction(problem, reasoning.gaps, goals);
        break;
      case 'risk':
        action = this.riskToAction(problem, reasoning.risks, goals);
        break;
      case 'opportunity':
        action = this.opportunityToAction(problem, reasoning.opportunities, goals);
        break;
    }

    return action;
  }

  private gapToAction(
    problem: PrioritizedProblem,
    gaps: SEOGap[],
    goals: SEOGoal[]
  ): SEOAction | null {
    const gap = gaps.find(g => g.id === problem.referenceId);
    if (!gap) return null;

    const templates = GAP_ACTION_TEMPLATES[gap.area] || GAP_ACTION_TEMPLATES.content;
    const template = templates[0]; // Use first matching template

    const action: SEOAction = {
      id: uuidv4(),
      type: template.type,
      title: template.titleTemplate,
      description: template.descriptionTemplate.replace('{description}', gap.description),
      expectedImpact: {
        metric: this.areaToMetric(gap.area),
        estimatedChange: this.impactToEstimate(gap.impact),
        confidence: gap.impact === 'high' ? 'high' : 'medium',
        timeToResult: template.timeToResult,
      },
      requiredEffort: {
        level: template.defaultEffort,
        estimatedHours: template.defaultHours,
        requiredSkills: template.requiredSkills,
      },
      riskLevel: 'low',
      evidence: gap.evidence.map(e => ({
        source: this.areaToAgentSource(gap.area),
        type: 'insight' as const,
        description: e,
      })),
      reasoning: problem.explanation,
      dependsOn: [],
      blockedBy: [],
      priority: problem.priority,
      category: template.category,
      relatedGoalIds: gap.relatedGoals,
      relatedProblemIds: [problem.id],
    };

    return action;
  }

  private riskToAction(
    problem: PrioritizedProblem,
    risks: SEORisk[],
    goals: SEOGoal[]
  ): SEOAction | null {
    const risk = risks.find(r => r.id === problem.referenceId);
    if (!risk) return null;

    const template = RISK_MITIGATION_TEMPLATES[risk.type];

    const action: SEOAction = {
      id: uuidv4(),
      type: template.type,
      title: template.titleTemplate,
      description: template.descriptionTemplate.replace('{description}', risk.description),
      expectedImpact: {
        metric: 'risk_reduction',
        estimatedChange: risk.impact === 'high' ? 50 : 30,
        confidence: 'medium',
        timeToResult: template.timeToResult,
      },
      requiredEffort: {
        level: template.defaultEffort,
        estimatedHours: template.defaultHours,
        requiredSkills: template.requiredSkills,
      },
      riskLevel: risk.impact,
      evidence: risk.evidence.map(e => ({
        source: AgentSource.MONITORING_ANALYTICS,
        type: 'alert' as const,
        description: e,
      })),
      reasoning: `${problem.explanation}. Mitigation: ${risk.mitigationSuggestion}`,
      dependsOn: [],
      blockedBy: [],
      priority: problem.priority,
      category: template.category,
      relatedGoalIds: [],
      relatedProblemIds: [problem.id],
    };

    return action;
  }

  private opportunityToAction(
    problem: PrioritizedProblem,
    opportunities: SEOOpportunity[],
    goals: SEOGoal[]
  ): SEOAction | null {
    const opp = opportunities.find(o => o.id === problem.referenceId);
    if (!opp) return null;

    const template = OPPORTUNITY_TEMPLATES[opp.type];

    const action: SEOAction = {
      id: uuidv4(),
      type: template.type,
      title: template.titleTemplate,
      description: template.descriptionTemplate.replace('{description}', opp.description),
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: opp.potentialImpact,
        confidence: opp.effort === 'low' ? 'high' : 'medium',
        timeToResult: opp.timeToResult,
      },
      requiredEffort: {
        level: opp.effort,
        estimatedHours: template.defaultHours,
        requiredSkills: template.requiredSkills,
      },
      riskLevel: 'low',
      evidence: opp.evidence.map(e => ({
        source: AgentSource.MONITORING_ANALYTICS,
        type: 'insight' as const,
        description: e,
      })),
      reasoning: problem.explanation,
      dependsOn: [],
      blockedBy: [],
      priority: problem.priority,
      category: template.category,
      relatedGoalIds: [],
      relatedProblemIds: [problem.id],
    };

    return action;
  }

  /**
   * Resolve dependencies and order actions
   */
  private resolveDependencies(actions: SEOAction[]): SEOAction[] {
    // Simple dependency resolution for v1.0
    // Technical fixes should come before content optimization
    // Content creation should come before internal linking

    const technical = actions.filter(a => a.category === 'technical');
    const content = actions.filter(a => a.category === 'content');
    const links = actions.filter(a => a.category === 'links');
    const keywords = actions.filter(a => a.category === 'keywords');
    const monitoring = actions.filter(a => a.category === 'monitoring');

    // Set dependencies
    for (const linkAction of links) {
      const contentDeps = content.filter(c => c.priority >= linkAction.priority);
      linkAction.dependsOn = contentDeps.slice(0, 2).map(c => c.id);
    }

    // Order: technical > keywords > content > links > monitoring
    const ordered = [
      ...technical.sort((a, b) => b.priority - a.priority),
      ...keywords.sort((a, b) => b.priority - a.priority),
      ...content.sort((a, b) => b.priority - a.priority),
      ...links.sort((a, b) => b.priority - a.priority),
      ...monitoring.sort((a, b) => b.priority - a.priority),
    ];

    // Re-assign priorities based on order
    return ordered.map((action, index) => ({
      ...action,
      priority: ordered.length - index,
    }));
  }

  /**
   * Calculate summary statistics for the plan
   */
  private calculateSummary(actions: SEOAction[]): ActionPlan['summary'] {
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
    let estimatedTotalHours = 0;

    for (const action of actions) {
      // By category
      byCategory[action.category] = (byCategory[action.category] || 0) + 1;

      // By priority
      if (action.priority >= 7) byPriority.high++;
      else if (action.priority >= 4) byPriority.medium++;
      else byPriority.low++;

      // Total hours
      estimatedTotalHours += action.requiredEffort.estimatedHours;
    }

    // Generate impact summary
    const avgImpact = actions.reduce((sum, a) => sum + a.expectedImpact.estimatedChange, 0) / actions.length;
    const expectedOverallImpact = `Estimated ${Math.round(avgImpact)}% improvement across targeted metrics`;

    return {
      totalActions: actions.length,
      byCategory,
      byPriority,
      estimatedTotalHours,
      expectedOverallImpact,
    };
  }

  private areaToMetric(area: SEOGap['area']): string {
    const mapping: Record<string, string> = {
      content: 'content_score',
      technical: 'health_score',
      keywords: 'keyword_visibility',
      links: 'internal_link_score',
      authority: 'topical_authority',
    };
    return mapping[area] || 'seo_score';
  }

  private areaToAgentSource(area: SEOGap['area']): AgentSource {
    const mapping: Record<string, AgentSource> = {
      content: AgentSource.CONTENT_ENGINE,
      technical: AgentSource.TECHNICAL_SEO,
      keywords: AgentSource.KEYWORD_INTELLIGENCE,
      links: AgentSource.ENTITY_LINKING,
      authority: AgentSource.ENTITY_LINKING,
    };
    return mapping[area] || AgentSource.MONITORING_ANALYTICS;
  }

  private impactToEstimate(impact: 'high' | 'medium' | 'low'): number {
    const mapping: Record<string, number> = {
      high: 20,
      medium: 10,
      low: 5,
    };
    return mapping[impact] || 10;
  }
}

export default ActionPlanner;
