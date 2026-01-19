/**
 * Autonomous SEO Agent - Main Entry Point
 * 
 * v1.0 - Meta-agent orchestrating SEO agents v0.2-v0.6
 * 
 * Pipeline: Goals → Observations → Reasoning → Actions → Execution
 * 
 * Key principles:
 * - Human-in-the-loop approval required
 * - No destructive actions without explicit approval
 * - Explainable reasoning at every step
 * - Idempotent execution
 */

import {
  SEOGoal,
  AgentRunRequest,
  AgentRunResponse,
  AutonomousAgentState,
  AggregatedObservation,
  ReasoningResult,
  ActionPlan,
  ExecutionStatus,
} from './models';

import { GoalInterpreter } from './goal_interpreter';
import { ObservationAggregator } from './observation_aggregator';
import { ReasoningEngine } from './reasoning_engine';
import { ActionPlanner } from './action_planner';
import { ExecutionCoordinator } from './execution_coordinator';
import { MemoryStore } from './memory_store';
import { SafetyGate } from './safety_gate';

// Agent configuration
interface AgentConfig {
  // LLM configuration
  llmEndpoint?: string;
  llmApiKey?: string;

  // Agent endpoints
  agentEndpoints?: Record<string, { baseUrl: string; healthEndpoint: string; taskEndpoint: string }>;

  // Safety configuration
  safetyConfig?: {
    maxActionsPerHour?: number;
    maxActionsPerDay?: number;
    blockHighRiskActions?: boolean;
  };

  // Execution mode
  dryRun?: boolean;

  // Memory persistence
  memoryPersistPath?: string;
}

export class AutonomousSEOAgent {
  private goalInterpreter: GoalInterpreter;
  private observationAggregator: ObservationAggregator;
  private reasoningEngine: ReasoningEngine;
  private actionPlanner: ActionPlanner;
  private executionCoordinator: ExecutionCoordinator;
  private memoryStore: MemoryStore;
  private safetyGate: SafetyGate;
  
  private state: Map<string, AutonomousAgentState> = new Map();
  private logger: Console;

  constructor(config?: AgentConfig) {
    this.logger = console;
    
    // Initialize components
    this.goalInterpreter = new GoalInterpreter();

    this.observationAggregator = new ObservationAggregator();

    this.reasoningEngine = new ReasoningEngine();

    this.actionPlanner = new ActionPlanner();

    this.executionCoordinator = new ExecutionCoordinator({
      agentEndpoints: config?.agentEndpoints,
      dryRun: config?.dryRun ?? true,
    });

    this.memoryStore = new MemoryStore({
      persistPath: config?.memoryPersistPath,
    });

    this.safetyGate = new SafetyGate(config?.safetyConfig);

    this.logger.log('[AutonomousSEOAgent] Initialized');
  }

  /**
   * Main entry point - run the full agent pipeline
   */
  async run(request: AgentRunRequest): Promise<AgentRunResponse> {
    const { projectId, goals, forceRefresh, dryRun } = request;
    
    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log(`[AutonomousSEOAgent] Starting run for project: ${projectId}`);
    this.logger.log(`${'='.repeat(60)}\n`);

    // Initialize or get state
    let state = this.getOrCreateState(projectId);
    const errors: string[] = [];

    try {
      // Step 1: Interpret goals
      this.updateState(projectId, { status: 'observing' });
      const interpretedGoals = await this.interpretGoals(projectId, goals);
      this.logger.log(`[Step 1] Interpreted ${interpretedGoals.length} goals`);

      // Step 2: Aggregate observations
      const observation = await this.aggregateObservations(projectId, interpretedGoals, forceRefresh);
      this.updateState(projectId, { 
        lastObservationAt: new Date().toISOString(),
        healthScore: observation.healthScore,
      });
      this.logger.log(`[Step 2] Aggregated observations. Health score: ${observation.healthScore}`);

      // Step 3: Reason about the situation
      this.updateState(projectId, { status: 'reasoning' });
      const reasoning = await this.performReasoning(projectId, observation, interpretedGoals);
      this.updateState(projectId, { lastReasoningAt: new Date().toISOString() });
      this.logger.log(`[Step 3] Reasoning complete. Found ${reasoning.prioritizedProblems.length} problems`);

      // Step 4: Plan actions
      this.updateState(projectId, { status: 'planning' });
      const plan = await this.planActions(projectId, interpretedGoals, reasoning);
      this.updateState(projectId, { 
        lastPlanAt: new Date().toISOString(),
        currentPlanId: plan.id,
      });
      this.logger.log(`[Step 4] Plan created with ${plan.actions.length} actions`);

      // Step 5: Safety validation
      const safetyCheck = await this.safetyGate.validatePlan(plan);
      if (!safetyCheck.passed) {
        this.logger.warn(`[Step 5] Safety check FAILED:`, safetyCheck.warnings);
        errors.push(...safetyCheck.warnings);
      } else {
        this.logger.log(`[Step 5] Safety check passed`);
      }

      // Step 6: Await approval (human-in-the-loop)
      this.updateState(projectId, { status: 'awaiting_approval' });
      this.logger.log(`[Step 6] Awaiting human approval for plan: ${plan.id}`);

      // Return state without execution - human must approve first
      state = this.getState(projectId)!;

      return {
        success: true,
        state,
        observation,
        reasoning,
        plan,
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AutonomousSEOAgent] Error:`, errorMessage);
      errors.push(errorMessage);

      state = this.getState(projectId)!;
      this.updateState(projectId, { status: 'idle' });

      return {
        success: false,
        state,
        errors,
      };
    }
  }

  /**
   * Execute an approved plan
   */
  async executePlan(projectId: string, planId: string, approvedBy: string): Promise<ExecutionStatus> {
    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log(`[AutonomousSEOAgent] Executing plan: ${planId}`);
    this.logger.log(`[AutonomousSEOAgent] Approved by: ${approvedBy}`);
    this.logger.log(`${'='.repeat(60)}\n`);

    const state = this.getState(projectId);
    if (!state || state.currentPlanId !== planId) {
      throw new Error(`Plan ${planId} not found or not current for project ${projectId}`);
    }

    this.updateState(projectId, { status: 'executing' });

    // In a real implementation, we'd retrieve the plan from storage
    // For now, we simulate with a placeholder
    throw new Error('Plan storage not implemented - call run() first and store the plan');
  }

  /**
   * Approve specific actions in a plan
   */
  async approveActions(
    projectId: string,
    planId: string,
    actionIds: string[],
    approvedBy: string,
    comments?: string
  ): Promise<void> {
    this.logger.log(`[AutonomousSEOAgent] Approving ${actionIds.length} actions in plan ${planId}`);

    // Store approval decision in memory
    await this.memoryStore.store({
      projectId,
      type: 'approval',
      planId,
      description: `Approved ${actionIds.length} actions: ${actionIds.slice(0, 3).join(', ')}${actionIds.length > 3 ? '...' : ''}`,
      context: {},
      learnings: comments ? [comments] : undefined,
      tags: ['approval', `actions_${actionIds.length}`],
    });
  }

  /**
   * Reject a plan or specific actions
   */
  async rejectActions(
    projectId: string,
    planId: string,
    actionIds: string[],
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    this.logger.log(`[AutonomousSEOAgent] Rejecting ${actionIds.length} actions in plan ${planId}`);
    this.logger.log(`[AutonomousSEOAgent] Reason: ${reason}`);

    // Store rejection decision in memory for learning
    await this.memoryStore.store({
      projectId,
      type: 'rejection',
      planId,
      description: `Rejected ${actionIds.length} actions: ${reason}`,
      context: {},
      learnings: [reason],
      tags: ['rejection', `actions_${actionIds.length}`],
    });

    this.updateState(projectId, { status: 'idle' });
  }

  // ============================================================================
  // PIPELINE STEPS
  // ============================================================================

  /**
   * Step 1: Interpret goals
   */
  private async interpretGoals(projectId: string, goals?: SEOGoal[]): Promise<SEOGoal[]> {
    if (goals && goals.length > 0) {
      return goals;
    }

    // Default goal if none provided
    return [{
      id: `default-${projectId}`,
      projectId,
      type: 'increase_organic_traffic' as any,
      description: 'General SEO health improvement',
      targetMetric: 'organic_traffic',
      targetValue: 10, // 10% improvement
      currentValue: 0,
      priority: 'medium',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }

  /**
   * Step 2: Aggregate observations
   */
  private async aggregateObservations(
    projectId: string,
    goals: SEOGoal[],
    forceRefresh?: boolean
  ): Promise<AggregatedObservation> {
    return this.observationAggregator.aggregate(projectId);
  }

  /**
   * Step 3: Perform reasoning
   */
  private async performReasoning(
    projectId: string,
    observation: AggregatedObservation,
    goals: SEOGoal[]
  ): Promise<ReasoningResult> {
    return this.reasoningEngine.analyze(projectId, goals, observation);
  }

  /**
   * Step 4: Plan actions
   */
  private async planActions(
    projectId: string,
    goals: SEOGoal[],
    reasoning: ReasoningResult
  ): Promise<ActionPlan> {
    const plan = await this.actionPlanner.generatePlan(projectId, goals, reasoning);

    // Apply learning-based priority adjustments
    for (const action of plan.actions) {
      const adjustment = await this.memoryStore.applyPriorityAdjustments(
        action,
        goals[0]?.type as any
      );
      action.priority = adjustment.adjustedPriority;
      
      if (adjustment.appliedRules.length > 0) {
        action.reasoning += `\n\nLearning adjustments: ${adjustment.appliedRules.join('; ')}`;
      }
    }

    // Re-sort actions by adjusted priority
    plan.actions.sort((a, b) => b.priority - a.priority);

    return plan;
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  private getOrCreateState(projectId: string): AutonomousAgentState {
    if (!this.state.has(projectId)) {
      this.state.set(projectId, {
        projectId,
        healthScore: 0,
        status: 'idle',
      });
    }
    return this.state.get(projectId)!;
  }

  private getState(projectId: string): AutonomousAgentState | undefined {
    return this.state.get(projectId);
  }

  private updateState(projectId: string, updates: Partial<AutonomousAgentState>): void {
    const current = this.getOrCreateState(projectId);
    this.state.set(projectId, { ...current, ...updates });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get agent health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
    memory: { entries: number; rules: number };
    execution: { lastHour: number; last24Hours: number };
  }> {
    const agentHealth = await this.executionCoordinator.checkAgentHealth();
    const memorySize = this.memoryStore.getMemorySize();
    const executionStats = this.safetyGate.getExecutionStats();

    const healthyAgents = Object.values(agentHealth).filter(a => a.healthy).length;
    const totalAgents = Object.keys(agentHealth).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyAgents === totalAgents) {
      status = 'healthy';
    } else if (healthyAgents >= totalAgents / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      components: Object.fromEntries(
        Object.entries(agentHealth).map(([k, v]) => [k, v.healthy])
      ),
      memory: memorySize,
      execution: {
        lastHour: executionStats.lastHour,
        last24Hours: executionStats.last24Hours,
      },
    };
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(projectId?: string): Promise<unknown> {
    return this.memoryStore.getStats(projectId);
  }

  /**
   * Set dry run mode
   */
  setDryRun(enabled: boolean): void {
    this.executionCoordinator.setDryRun(enabled);
  }

  /**
   * Get safety configuration
   */
  getSafetyConfig(): unknown {
    return this.safetyGate.getConfig();
  }

  /**
   * Update safety configuration
   */
  updateSafetyConfig(config: Parameters<typeof this.safetyGate.updateConfig>[0]) {
    this.safetyGate.updateConfig(config);
  }
}

// ============================================================================
// CLI RUNNER (for local testing)
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Autonomous SEO Agent v1.0');
  console.log('='.repeat(60));
  console.log('');

  const agent = new AutonomousSEOAgent({
    dryRun: true, // Always start in dry run mode
    llmEndpoint: process.env.LLM_ENDPOINT || 'http://localhost:11434/v1',
    llmApiKey: process.env.LLM_API_KEY,
  });

  // Check health
  const health = await agent.getHealth();
  console.log('Agent Health:', health.status);
  console.log('Components:', health.components);
  console.log('');

  // Example run
  const projectId = process.env.PROJECT_ID || 'demo-project';
  
  console.log(`Running agent for project: ${projectId}`);
  console.log('');

  const response = await agent.run({
    projectId,
    dryRun: true,
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('Agent Response');
  console.log('='.repeat(60));
  console.log('');
  console.log('Success:', response.success);
  console.log('State:', response.state.status);
  
  if (response.observation) {
    console.log('Health Score:', response.observation.healthScore);
    console.log('Top Issues:', response.observation.topIssues.slice(0, 3));
  }

  if (response.plan) {
    console.log('');
    console.log('Proposed Actions:');
    for (const action of response.plan.actions.slice(0, 5)) {
      console.log(`  - [P${action.priority}] ${action.title}`);
      console.log(`    Category: ${action.category}, Risk: ${action.riskLevel}`);
    }
  }

  if (response.errors && response.errors.length > 0) {
    console.log('');
    console.log('Errors:', response.errors);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('NOTE: Human approval required before execution');
  console.log('Call agent.approveActions() to approve specific actions');
  console.log('Call agent.executePlan() to execute approved actions');
  console.log('='.repeat(60));
}

// Export for use as module
export default AutonomousSEOAgent;

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
