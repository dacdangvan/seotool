/**
 * Reasoning Engine
 * 
 * v1.0 - Analyzes SEO state, identifies gaps/risks/opportunities, prioritizes problems
 * 
 * Responsibilities:
 * - Analyze aggregated observations
 * - Identify gaps between current and desired state
 * - Assess risks and their probability/impact
 * - Discover opportunities
 * - Prioritize based on impact, effort, risk
 * - Provide explainable reasoning steps
 */

import {
  SEOGoal,
  SEOGoalType,
  AggregatedObservation,
  AgentObservation,
  AgentSource,
  SEOGap,
  SEORisk,
  SEOOpportunity,
  ReasoningResult,
  PrioritizedProblem,
  ReasoningStep,
} from './models';
import { LearningRule } from './models';

// Priority calculation weights
const PRIORITY_WEIGHTS = {
  impact: 0.4,
  effort: 0.3, // Lower effort = higher priority
  risk: 0.3,
};

// Impact score mapping
const IMPACT_SCORES = {
  high: 3,
  medium: 2,
  low: 1,
};

// Effort score mapping (inverted - low effort is better)
const EFFORT_SCORES = {
  high: 1,
  medium: 2,
  low: 3,
};

// Risk urgency scores
const RISK_URGENCY = {
  high: 3,
  medium: 2,
  low: 1,
};

export class ReasoningEngine {
  private logger: Console;
  private learningRules: LearningRule[];

  constructor(learningRules: LearningRule[] = []) {
    this.logger = console;
    this.learningRules = learningRules;
  }

  /**
   * Perform full reasoning analysis
   */
  async analyze(
    projectId: string,
    goals: SEOGoal[],
    observation: AggregatedObservation
  ): Promise<ReasoningResult> {
    this.logger.log(`[ReasoningEngine] Starting analysis for project: ${projectId}`);
    
    const reasoningSteps: ReasoningStep[] = [];
    let stepCounter = 1;

    // Step 1: Identify gaps
    this.logger.log('[ReasoningEngine] Step 1: Identifying gaps...');
    const gaps = this.identifyGaps(goals, observation);
    reasoningSteps.push({
      step: stepCounter++,
      action: 'Identify Gaps',
      input: `${goals.length} goals, ${observation.observations.length} agent observations`,
      output: `Found ${gaps.length} gaps`,
      confidence: 0.85,
    });

    // Step 2: Assess risks
    this.logger.log('[ReasoningEngine] Step 2: Assessing risks...');
    const risks = this.assessRisks(observation);
    reasoningSteps.push({
      step: stepCounter++,
      action: 'Assess Risks',
      input: `${observation.topIssues.length} issues from observations`,
      output: `Identified ${risks.length} risks`,
      confidence: 0.80,
    });

    // Step 3: Discover opportunities
    this.logger.log('[ReasoningEngine] Step 3: Discovering opportunities...');
    const opportunities = this.discoverOpportunities(observation, goals);
    reasoningSteps.push({
      step: stepCounter++,
      action: 'Discover Opportunities',
      input: `${observation.topOpportunities.length} potential opportunities`,
      output: `Found ${opportunities.length} actionable opportunities`,
      confidence: 0.75,
    });

    // Step 4: Prioritize all problems
    this.logger.log('[ReasoningEngine] Step 4: Prioritizing problems...');
    const prioritizedProblems = this.prioritizeProblems(gaps, risks, opportunities);
    reasoningSteps.push({
      step: stepCounter++,
      action: 'Prioritize Problems',
      input: `${gaps.length} gaps, ${risks.length} risks, ${opportunities.length} opportunities`,
      output: `Ranked ${prioritizedProblems.length} problems by priority`,
      confidence: 0.85,
    });

    // Step 5: Apply learning rules
    this.logger.log('[ReasoningEngine] Step 5: Applying learning rules...');
    const adjustedProblems = this.applyLearningRules(prioritizedProblems);
    reasoningSteps.push({
      step: stepCounter++,
      action: 'Apply Learning Rules',
      input: `${this.learningRules.length} active rules`,
      output: `Adjusted priorities based on historical learnings`,
      confidence: 0.90,
    });

    const result: ReasoningResult = {
      projectId,
      timestamp: new Date().toISOString(),
      gaps,
      risks,
      opportunities,
      prioritizedProblems: adjustedProblems,
      reasoning: reasoningSteps,
    };

    this.logger.log(
      `[ReasoningEngine] Analysis complete. Gaps: ${gaps.length}, Risks: ${risks.length}, Opportunities: ${opportunities.length}`
    );

    return result;
  }

  /**
   * Identify gaps between current state and goals
   */
  private identifyGaps(
    goals: SEOGoal[],
    observation: AggregatedObservation
  ): SEOGap[] {
    const gaps: SEOGap[] = [];

    // Goal-based gaps
    for (const goal of goals) {
      const gap = this.analyzeGoalGap(goal, observation);
      if (gap) {
        gaps.push(gap);
      }
    }

    // Observation-based gaps (issues that don't map to explicit goals)
    const contentGaps = this.identifyContentGaps(observation);
    const technicalGaps = this.identifyTechnicalGaps(observation);
    const linkingGaps = this.identifyLinkingGaps(observation);

    gaps.push(...contentGaps, ...technicalGaps, ...linkingGaps);

    return gaps;
  }

  private analyzeGoalGap(goal: SEOGoal, observation: AggregatedObservation): SEOGap | null {
    const current = goal.currentValue;
    const target = goal.targetValue;
    
    if (current >= target && goal.type !== SEOGoalType.REDUCE_SEO_RISK) {
      return null; // Goal already met
    }
    if (current <= target && goal.type === SEOGoalType.REDUCE_SEO_RISK) {
      return null; // Risk reduction goal met
    }

    const progress = goal.type === SEOGoalType.REDUCE_SEO_RISK
      ? (goal.currentValue - current) / (goal.currentValue - target)
      : (current - 0) / (target - 0);

    const impact = progress < 0.3 ? 'high' : progress < 0.7 ? 'medium' : 'low';

    return {
      id: `gap-goal-${goal.id}`,
      area: this.goalTypeToArea(goal.type),
      description: `Goal "${goal.description}" is ${Math.round((1 - progress) * 100)}% away from target`,
      currentState: `Current: ${current} ${goal.targetMetric}`,
      desiredState: `Target: ${target} ${goal.targetMetric}`,
      impact,
      evidence: [`Goal tracking: ${current}/${target}`],
      relatedGoals: [goal.id],
    };
  }

  private identifyContentGaps(observation: AggregatedObservation): SEOGap[] {
    const gaps: SEOGap[] = [];
    const contentObs = observation.observations.find(o => o.source === AgentSource.CONTENT_ENGINE);
    
    if (!contentObs) return gaps;

    // Thin content gap
    if (contentObs.metrics.thin_content_pages > 5) {
      gaps.push({
        id: 'gap-thin-content',
        area: 'content',
        description: `${contentObs.metrics.thin_content_pages} pages have thin content (<500 words)`,
        currentState: `${contentObs.metrics.thin_content_pages} thin content pages`,
        desiredState: 'Less than 5 thin content pages',
        impact: contentObs.metrics.thin_content_pages > 15 ? 'high' : 'medium',
        evidence: ['Content Engine analysis'],
        relatedGoals: [],
      });
    }

    // Content freshness gap
    if (contentObs.metrics.content_freshness_score < 70) {
      gaps.push({
        id: 'gap-content-freshness',
        area: 'content',
        description: 'Content freshness score below target',
        currentState: `Freshness score: ${contentObs.metrics.content_freshness_score}`,
        desiredState: 'Freshness score > 70',
        impact: 'medium',
        evidence: ['Content Engine analysis'],
        relatedGoals: [],
      });
    }

    return gaps;
  }

  private identifyTechnicalGaps(observation: AggregatedObservation): SEOGap[] {
    const gaps: SEOGap[] = [];
    const techObs = observation.observations.find(o => o.source === AgentSource.TECHNICAL_SEO);
    
    if (!techObs) return gaps;

    // Core Web Vitals gap
    if (techObs.metrics.core_web_vitals_pass_rate < 75) {
      gaps.push({
        id: 'gap-cwv',
        area: 'technical',
        description: 'Core Web Vitals pass rate below threshold',
        currentState: `CWV pass rate: ${techObs.metrics.core_web_vitals_pass_rate}%`,
        desiredState: 'CWV pass rate > 75%',
        impact: 'high',
        evidence: ['Technical SEO audit', 'Google ranking factor'],
        relatedGoals: [],
      });
    }

    // Indexation gap
    if (techObs.metrics.indexation_rate < 90) {
      gaps.push({
        id: 'gap-indexation',
        area: 'technical',
        description: 'Pages not being indexed',
        currentState: `Indexation rate: ${techObs.metrics.indexation_rate}%`,
        desiredState: 'Indexation rate > 90%',
        impact: 'high',
        evidence: ['Technical SEO audit'],
        relatedGoals: [],
      });
    }

    return gaps;
  }

  private identifyLinkingGaps(observation: AggregatedObservation): SEOGap[] {
    const gaps: SEOGap[] = [];
    const linkObs = observation.observations.find(o => o.source === AgentSource.ENTITY_LINKING);
    
    if (!linkObs) return gaps;

    // Orphan pages gap
    if (linkObs.metrics.orphan_pages > 5) {
      gaps.push({
        id: 'gap-orphan-pages',
        area: 'links',
        description: `${linkObs.metrics.orphan_pages} orphan pages lack internal links`,
        currentState: `${linkObs.metrics.orphan_pages} orphan pages`,
        desiredState: 'Less than 5 orphan pages',
        impact: 'medium',
        evidence: ['Entity Linking analysis'],
        relatedGoals: [],
      });
    }

    return gaps;
  }

  /**
   * Assess risks based on observations
   */
  private assessRisks(observation: AggregatedObservation): SEORisk[] {
    const risks: SEORisk[] = [];

    // Analyze critical alerts
    for (const obs of observation.observations) {
      for (const alert of obs.alerts) {
        if (alert.severity === 'critical') {
          risks.push(this.alertToRisk(obs.source, alert));
        }
      }
    }

    // Check for ranking drop risk
    const keywordObs = observation.observations.find(o => o.source === AgentSource.KEYWORD_INTELLIGENCE);
    if (keywordObs && keywordObs.metrics.position_changes < -2) {
      risks.push({
        id: 'risk-ranking-drop',
        type: 'ranking_drop',
        description: 'Keywords showing downward trend in rankings',
        probability: 'high',
        impact: 'high',
        mitigationSuggestion: 'Review content quality and competitor analysis',
        evidence: [`Average position change: ${keywordObs.metrics.position_changes}`],
      });
    }

    // Check for technical failure risk
    const techObs = observation.observations.find(o => o.source === AgentSource.TECHNICAL_SEO);
    if (techObs && techObs.metrics.critical_issues_count > 5) {
      risks.push({
        id: 'risk-technical-failure',
        type: 'technical_failure',
        description: 'Multiple critical technical issues may impact rankings',
        probability: 'medium',
        impact: 'high',
        mitigationSuggestion: 'Prioritize fixing critical technical issues',
        evidence: [`${techObs.metrics.critical_issues_count} critical issues`],
      });
    }

    return risks;
  }

  private alertToRisk(source: AgentSource, alert: { severity: string; message: string; metric?: string; value?: number }): SEORisk {
    return {
      id: `risk-${source}-${alert.metric || 'alert'}`,
      type: this.inferRiskType(alert.message),
      description: alert.message,
      probability: 'medium',
      impact: alert.severity === 'critical' ? 'high' : 'medium',
      mitigationSuggestion: `Address ${alert.metric || 'issue'} from ${source}`,
      evidence: [alert.value !== undefined ? `Current value: ${alert.value}` : 'Alert triggered'],
    };
  }

  private inferRiskType(message: string): SEORisk['type'] {
    const lower = message.toLowerCase();
    if (lower.includes('penalty') || lower.includes('manual action')) return 'penalty';
    if (lower.includes('rank') || lower.includes('position')) return 'ranking_drop';
    if (lower.includes('traffic') || lower.includes('session')) return 'traffic_loss';
    if (lower.includes('error') || lower.includes('fail')) return 'technical_failure';
    if (lower.includes('competitor')) return 'competitor';
    return 'technical_failure';
  }

  /**
   * Discover opportunities from observations
   */
  private discoverOpportunities(
    observation: AggregatedObservation,
    goals: SEOGoal[]
  ): SEOOpportunity[] {
    const opportunities: SEOOpportunity[] = [];

    // Quick wins from keyword data
    const keywordObs = observation.observations.find(o => o.source === AgentSource.KEYWORD_INTELLIGENCE);
    if (keywordObs) {
      // Keywords close to page 1
      if (keywordObs.metrics.keywords_ranking_top10 < keywordObs.metrics.keywords_tracked * 0.5) {
        opportunities.push({
          id: 'opp-page1-keywords',
          type: 'quick_win',
          description: 'Push keywords ranking 11-20 to page 1',
          potentialImpact: 20, // 20% traffic increase estimate
          effort: 'medium',
          timeToResult: '4-8 weeks',
          evidence: ['Keyword Intelligence analysis'],
        });
      }
    }

    // Content update opportunities
    const contentObs = observation.observations.find(o => o.source === AgentSource.CONTENT_ENGINE);
    if (contentObs) {
      for (const insight of contentObs.insights) {
        if (insight.toLowerCase().includes('update') || insight.toLowerCase().includes('outdated')) {
          opportunities.push({
            id: 'opp-content-update',
            type: 'quick_win',
            description: 'Update outdated content for quick ranking improvements',
            potentialImpact: 15,
            effort: 'low',
            timeToResult: '2-4 weeks',
            evidence: [insight],
          });
          break;
        }
      }
    }

    // CTR improvement opportunities
    const monitorObs = observation.observations.find(o => o.source === AgentSource.MONITORING_ANALYTICS);
    if (monitorObs && monitorObs.metrics.click_through_rate < 4) {
      opportunities.push({
        id: 'opp-ctr-improvement',
        type: 'quick_win',
        description: 'Improve meta titles/descriptions to boost CTR',
        potentialImpact: 10,
        effort: 'low',
        timeToResult: '2-3 weeks',
        evidence: [`Current CTR: ${monitorObs.metrics.click_through_rate}%`],
      });
    }

    // Topic cluster opportunity
    const linkObs = observation.observations.find(o => o.source === AgentSource.ENTITY_LINKING);
    if (linkObs) {
      opportunities.push({
        id: 'opp-topic-cluster',
        type: 'growth',
        description: 'Build topic clusters to establish topical authority',
        potentialImpact: 30,
        effort: 'high',
        timeToResult: '3-6 months',
        evidence: ['Entity analysis shows opportunity for hub pages'],
      });
    }

    return opportunities;
  }

  /**
   * Prioritize all problems (gaps, risks, opportunities)
   */
  private prioritizeProblems(
    gaps: SEOGap[],
    risks: SEORisk[],
    opportunities: SEOOpportunity[]
  ): PrioritizedProblem[] {
    const problems: PrioritizedProblem[] = [];

    // Convert gaps to prioritized problems
    for (const gap of gaps) {
      const impactScore = IMPACT_SCORES[gap.impact];
      const effortScore = 2; // Default medium effort for gaps
      const riskScore = 2; // Gaps have moderate urgency

      const priorityScore = this.calculatePriorityScore(impactScore, effortScore, riskScore);

      problems.push({
        id: gap.id,
        type: 'gap',
        referenceId: gap.id,
        priority: Math.round(priorityScore),
        priorityScore,
        impactScore,
        effortScore,
        riskScore,
        explanation: `Gap in ${gap.area}: ${gap.description}. Impact: ${gap.impact}`,
      });
    }

    // Convert risks to prioritized problems
    for (const risk of risks) {
      const impactScore = IMPACT_SCORES[risk.impact];
      const effortScore = 2; // Mitigation effort varies
      const riskScore = RISK_URGENCY[risk.probability] * IMPACT_SCORES[risk.impact];

      const priorityScore = this.calculatePriorityScore(impactScore, effortScore, riskScore);

      problems.push({
        id: risk.id,
        type: 'risk',
        referenceId: risk.id,
        priority: Math.round(priorityScore),
        priorityScore,
        impactScore,
        effortScore,
        riskScore,
        explanation: `Risk: ${risk.description}. Probability: ${risk.probability}, Impact: ${risk.impact}`,
      });
    }

    // Convert opportunities to prioritized problems
    for (const opp of opportunities) {
      const impactScore = opp.potentialImpact / 10; // Normalize to 1-3 scale
      const effortScore = EFFORT_SCORES[opp.effort];
      const riskScore = opp.type === 'quick_win' ? 3 : 1; // Quick wins get priority

      const priorityScore = this.calculatePriorityScore(impactScore, effortScore, riskScore);

      problems.push({
        id: opp.id,
        type: 'opportunity',
        referenceId: opp.id,
        priority: Math.round(priorityScore),
        priorityScore,
        impactScore,
        effortScore,
        riskScore,
        explanation: `Opportunity: ${opp.description}. Potential: +${opp.potentialImpact}%, Effort: ${opp.effort}`,
      });
    }

    // Sort by priority score (descending)
    return problems.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  private calculatePriorityScore(impact: number, effort: number, risk: number): number {
    return (
      impact * PRIORITY_WEIGHTS.impact +
      effort * PRIORITY_WEIGHTS.effort +
      risk * PRIORITY_WEIGHTS.risk
    ) * 10 / 3; // Normalize to 1-10 scale
  }

  /**
   * Apply learning rules to adjust priorities
   */
  private applyLearningRules(problems: PrioritizedProblem[]): PrioritizedProblem[] {
    if (this.learningRules.length === 0) {
      return problems;
    }

    return problems.map(problem => {
      let adjustedScore = problem.priorityScore;

      for (const rule of this.learningRules) {
        if (this.ruleMatchesProblem(rule, problem)) {
          switch (rule.adjustment.type) {
            case 'priority_boost':
              adjustedScore *= (1 + rule.adjustment.value);
              break;
            case 'priority_reduce':
              adjustedScore *= (1 - rule.adjustment.value);
              break;
            case 'avoid':
              adjustedScore = 0;
              break;
            case 'prefer':
              adjustedScore *= 1.5;
              break;
          }
        }
      }

      return {
        ...problem,
        priorityScore: adjustedScore,
        priority: Math.round(adjustedScore),
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  private ruleMatchesProblem(rule: LearningRule, problem: PrioritizedProblem): boolean {
    // Simple pattern matching for v1.0
    if (rule.condition.contextPattern) {
      return problem.explanation.toLowerCase().includes(rule.condition.contextPattern.toLowerCase());
    }
    return false;
  }

  private goalTypeToArea(goalType: SEOGoalType): SEOGap['area'] {
    switch (goalType) {
      case SEOGoalType.INCREASE_ORGANIC_TRAFFIC:
      case SEOGoalType.IMPROVE_KEYWORD_COVERAGE:
        return 'keywords';
      case SEOGoalType.IMPROVE_CONTENT_QUALITY:
        return 'content';
      case SEOGoalType.FIX_TECHNICAL_ISSUES:
      case SEOGoalType.REDUCE_SEO_RISK:
        return 'technical';
      case SEOGoalType.BOOST_ENTITY_AUTHORITY:
        return 'authority';
      default:
        return 'content';
    }
  }
}

export default ReasoningEngine;
