/**
 * Debate Orchestrator
 * 
 * v1.2 - Coordinates the Multi-Agent Debate System
 * 
 * Responsibilities:
 * - Orchestrate the debate pipeline
 * - Run all evaluators in parallel
 * - Coordinate conflict analysis
 * - Aggregate votes
 * - Generate final decision
 * - Return complete DebateOutput
 * 
 * Principles:
 * - No free-form chat between agents
 * - Every argument must be explicit
 * - Deterministic output schema
 * - No execution without clear APPROVE
 * - Full explainability required
 */

import { SEOAction } from '../autonomous_agent/models';
import { RiskClassification } from '../autonomous_agent_v1_1/models';
import {
  AgentRole,
  AgentEvaluation,
  DebateInput,
  DebateOutput,
  DebateConfig,
  DebateDecision,
  DEFAULT_AGENT_CONFIGS,
  DEFAULT_VOTING_WEIGHTS,
  DEFAULT_DEBATE_THRESHOLDS,
} from './models';
import { SEOEvaluator } from './seo_evaluator';
import { RiskEvaluator } from './risk_evaluator';
import { BrandEvaluator } from './brand_evaluator';
import { ConflictAnalyzer } from './conflict_analyzer';
import { VoteAggregator } from './vote_aggregator';
import { DecisionExplainer } from './decision_explainer';

export class DebateOrchestrator {
  private logger: Console;
  private config: DebateConfig;
  
  // Evaluators
  private seoEvaluator: SEOEvaluator;
  private riskEvaluator: RiskEvaluator;
  private brandEvaluator: BrandEvaluator;
  
  // Analyzers
  private conflictAnalyzer: ConflictAnalyzer;
  private voteAggregator: VoteAggregator;
  private decisionExplainer: DecisionExplainer;

  constructor(projectId: string, customConfig?: Partial<DebateConfig>) {
    this.logger = console;
    
    // Build configuration
    this.config = {
      projectId,
      enabled: true,
      agentConfigs: DEFAULT_AGENT_CONFIGS,
      votingWeights: { projectId, ...DEFAULT_VOTING_WEIGHTS },
      thresholds: DEFAULT_DEBATE_THRESHOLDS,
      ...customConfig,
    };

    // Initialize evaluators
    this.seoEvaluator = new SEOEvaluator(this.config.agentConfigs[AgentRole.SEO]);
    this.riskEvaluator = new RiskEvaluator(this.config.agentConfigs[AgentRole.RISK]);
    this.brandEvaluator = new BrandEvaluator(this.config.agentConfigs[AgentRole.BRAND]);

    // Initialize analyzers
    this.conflictAnalyzer = new ConflictAnalyzer();
    this.voteAggregator = new VoteAggregator(projectId, this.config.votingWeights);
    this.decisionExplainer = new DecisionExplainer(this.config.thresholds);

    this.logger.log(`[DebateOrchestrator] Initialized for project: ${projectId}`);
  }

  /**
   * Run the complete debate process
   * 
   * This is the main entry point for the Multi-Agent Debate System.
   * Returns a complete DebateOutput with decision and full explainability.
   */
  async debate(input: DebateInput): Promise<DebateOutput> {
    const debateStartedAt = new Date().toISOString();
    const startTime = Date.now();

    this.logger.log('='.repeat(60));
    this.logger.log('[DebateOrchestrator] DEBATE STARTED');
    this.logger.log(`  Action ID: ${input.action.id}`);
    this.logger.log(`  Action Type: ${input.action.type}`);
    this.logger.log(`  Risk Level: ${input.riskClassification.level}`);
    this.logger.log('='.repeat(60));

    // Validate debate is enabled
    if (!this.config.enabled) {
      throw new Error('Debate system is disabled for this project');
    }

    // Phase 1: Run all evaluators in parallel
    this.logger.log('\n[Phase 1] Running agent evaluations...');
    const evaluations = await this.runEvaluators(input);

    // Phase 2: Analyze conflicts
    this.logger.log('\n[Phase 2] Analyzing conflicts...');
    const evaluationArray = Object.values(evaluations);
    const conflictAnalysis = this.conflictAnalyzer.analyze(evaluationArray);

    // Phase 3: Aggregate votes
    this.logger.log('\n[Phase 3] Aggregating votes...');
    const aggregatedVote = this.voteAggregator.aggregate(
      evaluationArray,
      input.action.type,
      input.riskClassification.level,
      conflictAnalysis
    );

    // Phase 4: Generate decision and explanation
    this.logger.log('\n[Phase 4] Generating decision...');
    const decision = this.decisionExplainer.explain(
      evaluationArray,
      aggregatedVote,
      conflictAnalysis
    );

    // Build output
    const debateCompletedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    const output: DebateOutput = {
      id: `debate_${input.id}_${Date.now()}`,
      inputId: input.id,
      projectId: input.projectId,
      actionId: input.action.id,
      evaluations,
      conflictAnalysis,
      aggregatedVote,
      decision,
      debateStartedAt,
      debateCompletedAt,
      durationMs,
    };

    // Log summary
    this.logDebateSummary(output);

    return output;
  }

  // ============================================================================
  // EVALUATOR ORCHESTRATION
  // ============================================================================

  private async runEvaluators(input: DebateInput): Promise<Record<AgentRole, AgentEvaluation>> {
    const { action, riskClassification, context } = input;

    // Run all evaluators in parallel
    const [seoEval, riskEval, brandEval] = await Promise.all([
      this.config.agentConfigs[AgentRole.SEO].enabled
        ? this.seoEvaluator.evaluate(action, riskClassification, context)
        : this.createDisabledEvaluation(AgentRole.SEO),
      
      this.config.agentConfigs[AgentRole.RISK].enabled
        ? this.riskEvaluator.evaluate(action, riskClassification, context)
        : this.createDisabledEvaluation(AgentRole.RISK),
      
      this.config.agentConfigs[AgentRole.BRAND].enabled
        ? this.brandEvaluator.evaluate(action, riskClassification, context)
        : this.createDisabledEvaluation(AgentRole.BRAND),
    ]);

    return {
      [AgentRole.SEO]: seoEval,
      [AgentRole.RISK]: riskEval,
      [AgentRole.BRAND]: brandEval,
    };
  }

  private createDisabledEvaluation(role: AgentRole): AgentEvaluation {
    return {
      agentRole: role,
      agentName: `${role} Agent (Disabled)`,
      position: 'modify' as any, // Neutral position
      confidence: 0,
      reasoning: [
        {
          type: 'observation',
          statement: `${role} agent is disabled for this project`,
          weight: 'low',
        },
      ],
      assessment: {
        overallScore: 0,
        benefitScore: 50,
        riskScore: 50,
        alignmentScore: 50,
        summary: 'Agent disabled - no evaluation performed.',
      },
      evaluatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // SUMMARY LOGGING
  // ============================================================================

  private logDebateSummary(output: DebateOutput): void {
    this.logger.log('\n' + '='.repeat(60));
    this.logger.log('[DebateOrchestrator] DEBATE COMPLETED');
    this.logger.log('='.repeat(60));
    
    this.logger.log(`\nDECISION: ${output.decision.decision.toUpperCase()}`);
    this.logger.log(`Confidence: ${output.decision.confidence}%`);
    this.logger.log(`Duration: ${output.durationMs}ms`);
    
    this.logger.log('\nAgent Positions:');
    for (const [role, eval_] of Object.entries(output.evaluations)) {
      this.logger.log(
        `  ${role.toUpperCase()}: ${eval_.position.toUpperCase()} ` +
        `(confidence: ${eval_.confidence}%, score: ${eval_.assessment.overallScore})`
      );
    }

    this.logger.log(`\nAggregate Score: ${output.aggregatedVote.aggregateScore.toFixed(2)}`);
    this.logger.log(`Consensus Level: ${output.aggregatedVote.consensusLevel}%`);
    
    if (output.conflictAnalysis.hasConflicts) {
      this.logger.log(`\nConflicts: ${output.conflictAnalysis.conflicts.length}`);
      for (const conflict of output.conflictAnalysis.conflicts) {
        this.logger.log(`  [${conflict.severity.toUpperCase()}] ${conflict.description}`);
      }
    }

    if (output.decision.modifications && output.decision.modifications.length > 0) {
      this.logger.log('\nRequired Modifications:');
      for (const mod of output.decision.modifications) {
        this.logger.log(`  [${mod.priority.toUpperCase()}] ${mod.aspect}: ${mod.suggestedValue}`);
      }
    }

    this.logger.log('\n' + '='.repeat(60) + '\n');
  }

  // ============================================================================
  // QUICK DECISION METHODS
  // ============================================================================

  /**
   * Quick check if action should be executed
   * Returns true only for APPROVE decision
   */
  async shouldExecute(input: DebateInput): Promise<boolean> {
    const output = await this.debate(input);
    return output.decision.decision === DebateDecision.APPROVE;
  }

  /**
   * Quick check if action requires modifications
   */
  async requiresModifications(input: DebateInput): Promise<boolean> {
    const output = await this.debate(input);
    return output.decision.decision === DebateDecision.APPROVE_WITH_MODIFICATIONS;
  }

  /**
   * Quick check if action should be rejected
   */
  async shouldReject(input: DebateInput): Promise<boolean> {
    const output = await this.debate(input);
    return output.decision.decision === DebateDecision.REJECT;
  }

  // ============================================================================
  // CONFIGURATION METHODS
  // ============================================================================

  /**
   * Get current debate configuration
   */
  getConfig(): DebateConfig {
    return { ...this.config };
  }

  /**
   * Update debate configuration
   */
  updateConfig(newConfig: Partial<DebateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize components if needed
    if (newConfig.agentConfigs) {
      this.seoEvaluator = new SEOEvaluator(this.config.agentConfigs[AgentRole.SEO]);
      this.riskEvaluator = new RiskEvaluator(this.config.agentConfigs[AgentRole.RISK]);
      this.brandEvaluator = new BrandEvaluator(this.config.agentConfigs[AgentRole.BRAND]);
    }
    
    if (newConfig.votingWeights) {
      this.voteAggregator = new VoteAggregator(this.config.projectId, this.config.votingWeights);
    }
    
    if (newConfig.thresholds) {
      this.decisionExplainer = new DecisionExplainer(this.config.thresholds);
    }

    this.logger.log('[DebateOrchestrator] Configuration updated');
  }

  /**
   * Enable/disable the debate system
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.logger.log(`[DebateOrchestrator] Debate system ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable specific agent
   */
  setAgentEnabled(role: AgentRole, enabled: boolean): void {
    this.config.agentConfigs[role].enabled = enabled;
    this.logger.log(`[DebateOrchestrator] ${role} agent ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ============================================================================
  // FACTORY METHODS
  // ============================================================================

  /**
   * Create a debate input from action and risk classification
   */
  static createInput(
    projectId: string,
    action: SEOAction,
    riskClassification: RiskClassification,
    projectName: string,
    projectDomain: string
  ): DebateInput {
    return {
      id: `input_${action.id}_${Date.now()}`,
      projectId,
      action,
      riskClassification,
      context: {
        projectName,
        projectDomain,
        recentActions: [],
      },
      requestedAt: new Date().toISOString(),
    };
  }
}

export default DebateOrchestrator;
