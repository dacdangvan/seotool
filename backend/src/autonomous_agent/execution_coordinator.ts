/**
 * Execution Coordinator
 * 
 * v1.0 - Coordinates action execution across SEO agents
 * 
 * Responsibilities:
 * - Convert approved actions to agent-specific tasks
 * - Dispatch tasks to appropriate agents (v0.2-v0.6)
 * - Track execution status and collect results
 * - Enforce human approval before execution
 * - Provide execution logs for transparency
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SEOAction,
  ActionType,
  ActionPlan,
  ActionExecutionStatus,
  ActionResult,
  AgentSource,
  ExecutionStatus,
} from './models';

// Agent endpoint configuration
interface AgentEndpoint {
  baseUrl: string;
  healthEndpoint: string;
  taskEndpoint: string;
}

// Agent task interface (internal to coordinator)
interface AgentTask {
  id: string;
  actionId: string;
  projectId: string;
  agentSource: AgentSource;
  taskType: ActionType;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// Execution log entry
interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  actionId?: string;
  agentSource?: AgentSource;
  details?: Record<string, unknown>;
}

const DEFAULT_AGENT_ENDPOINTS: Record<string, AgentEndpoint> = {
  [AgentSource.KEYWORD_INTELLIGENCE]: {
    baseUrl: process.env.KEYWORD_AGENT_URL || 'http://localhost:3001',
    healthEndpoint: '/health',
    taskEndpoint: '/api/tasks',
  },
  [AgentSource.CONTENT_ENGINE]: {
    baseUrl: process.env.CONTENT_AGENT_URL || 'http://localhost:3002',
    healthEndpoint: '/health',
    taskEndpoint: '/api/tasks',
  },
  [AgentSource.TECHNICAL_SEO]: {
    baseUrl: process.env.TECHNICAL_AGENT_URL || 'http://localhost:3003',
    healthEndpoint: '/health',
    taskEndpoint: '/api/tasks',
  },
  [AgentSource.ENTITY_LINKING]: {
    baseUrl: process.env.ENTITY_AGENT_URL || 'http://localhost:3004',
    healthEndpoint: '/health',
    taskEndpoint: '/api/tasks',
  },
  [AgentSource.MONITORING_ANALYTICS]: {
    baseUrl: process.env.MONITORING_AGENT_URL || 'http://localhost:3005',
    healthEndpoint: '/health',
    taskEndpoint: '/api/tasks',
  },
};

// Action to agent mapping
const ACTION_AGENT_MAPPING: Record<ActionType, AgentSource> = {
  [ActionType.CREATE_CONTENT]: AgentSource.CONTENT_ENGINE,
  [ActionType.UPDATE_CONTENT]: AgentSource.CONTENT_ENGINE,
  [ActionType.OPTIMIZE_CONTENT]: AgentSource.CONTENT_ENGINE,
  [ActionType.ADD_INTERNAL_LINK]: AgentSource.ENTITY_LINKING,
  [ActionType.OPTIMIZE_ANCHOR_TEXT]: AgentSource.ENTITY_LINKING,
  [ActionType.FIX_TECHNICAL_ISSUE]: AgentSource.TECHNICAL_SEO,
  [ActionType.IMPROVE_PAGE_SPEED]: AgentSource.TECHNICAL_SEO,
  [ActionType.FIX_SCHEMA_MARKUP]: AgentSource.TECHNICAL_SEO,
  [ActionType.TARGET_NEW_KEYWORD]: AgentSource.KEYWORD_INTELLIGENCE,
  [ActionType.IMPROVE_KEYWORD_RANKING]: AgentSource.KEYWORD_INTELLIGENCE,
  [ActionType.SET_UP_ALERT]: AgentSource.MONITORING_ANALYTICS,
  [ActionType.INVESTIGATE_ANOMALY]: AgentSource.MONITORING_ANALYTICS,
};

export class ExecutionCoordinator {
  private agentEndpoints: Record<string, AgentEndpoint>;
  private executionLogs: ExecutionLog[] = [];
  private logger: Console;
  private dryRun: boolean;

  constructor(config?: {
    agentEndpoints?: Record<string, AgentEndpoint>;
    dryRun?: boolean;
  }) {
    this.agentEndpoints = config?.agentEndpoints || DEFAULT_AGENT_ENDPOINTS;
    this.dryRun = config?.dryRun ?? true; // Default to dry run for safety
    this.logger = console;
  }

  /**
   * Execute approved actions from a plan
   */
  async executePlan(plan: ActionPlan): Promise<ExecutionStatus> {
    this.log('info', `Starting execution for plan: ${plan.id}`);
    this.log('info', `Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);

    const actionStatuses: ActionExecutionStatus[] = [];
    const startedAt = new Date().toISOString();

    // Filter to only approved actions
    const approvedActions = plan.actions.filter(
      action => plan.approvalStatus.approvedActionIds.includes(action.id)
    );

    if (approvedActions.length === 0) {
      this.log('warn', 'No approved actions to execute');
      return {
        planId: plan.id,
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'completed',
        actionStatuses: [],
        errors: [],
      };
    }

    this.log('info', `Executing ${approvedActions.length} approved actions`);

    // Check agent health before execution
    const healthStatus = await this.checkAgentHealth();
    this.log('info', 'Agent health check completed', undefined, undefined, healthStatus);

    // Execute actions in priority order
    const sortedActions = [...approvedActions].sort((a, b) => b.priority - a.priority);

    let hasBlockingFailure = false;

    for (const action of sortedActions) {
      if (hasBlockingFailure) {
        // Mark remaining actions as skipped
        actionStatuses.push({
          actionId: action.id,
          status: 'skipped',
          error: 'Skipped due to blocking failure in previous action',
        });
        continue;
      }

      const result = await this.executeAction(action, plan.projectId);
      actionStatuses.push(result);

      // If action failed and is blocking, stop execution
      if (result.status === 'failed' && this.isBlockingFailure(action)) {
        this.log('error', `Blocking failure encountered. Stopping execution.`, action.id);
        hasBlockingFailure = true;
      }
    }

    const successCount = actionStatuses.filter(r => r.status === 'completed').length;
    this.log('info', `Execution completed. Success: ${successCount}/${actionStatuses.length}`);

    return {
      planId: plan.id,
      startedAt,
      completedAt: new Date().toISOString(),
      status: hasBlockingFailure ? 'failed' : 'completed',
      actionStatuses,
      errors: actionStatuses
        .filter(s => s.error)
        .map(s => ({
          actionId: s.actionId,
          timestamp: new Date().toISOString(),
          errorType: 'execution_error',
          message: s.error || 'Unknown error',
          recoverable: true,
        })),
    };
  }

  /**
   * Execute a single action
   */
  async executeAction(action: SEOAction, projectId: string): Promise<ActionExecutionStatus> {
    const startTime = new Date().toISOString();
    const agentSource = ACTION_AGENT_MAPPING[action.type];

    this.log('info', `Executing action: ${action.title}`, action.id, agentSource);

    // Convert action to agent task
    const task = this.actionToTask(action, projectId);

    try {
      // Check dependencies
      const unmetDeps = await this.checkDependencies(action);
      if (unmetDeps.length > 0) {
        this.log('warn', `Unmet dependencies: ${unmetDeps.join(', ')}`, action.id);
        return {
          actionId: action.id,
          status: 'skipped',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          error: `Blocked by unmet dependencies: ${unmetDeps.join(', ')}`,
        };
      }

      // Execute task (or simulate in dry run mode)
      let taskResult: ActionResult;
      if (this.dryRun) {
        taskResult = await this.simulateExecution(task);
        this.log('info', `[DRY RUN] Simulated execution completed`, action.id, agentSource);
      } else {
        taskResult = await this.dispatchToAgent(task, agentSource);
        this.log('info', `Execution completed`, action.id, agentSource);
      }

      return {
        actionId: action.id,
        status: taskResult.success ? 'completed' : 'failed',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        agentTaskId: task.id,
        result: taskResult,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('error', `Execution failed: ${errorMessage}`, action.id, agentSource);

      return {
        actionId: action.id,
        status: 'failed',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  /**
   * Convert an SEO action to an agent-specific task
   */
  private actionToTask(action: SEOAction, projectId: string): AgentTask {
    const agentSource = ACTION_AGENT_MAPPING[action.type];

    // Create task payload based on action type
    const payload = this.createTaskPayload(action);

    return {
      id: uuidv4(),
      actionId: action.id,
      projectId,
      agentSource,
      taskType: action.type,
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
  }

  /**
   * Create task-specific payload based on action type
   */
  private createTaskPayload(action: SEOAction): Record<string, unknown> {
    switch (action.type) {
      case ActionType.CREATE_CONTENT:
        return {
          operation: 'create',
          title: action.title,
          description: action.description,
          keywords: this.extractKeywordsFromEvidence(action.evidence),
          targetWordCount: 1500,
          format: 'blog_post',
        };

      case ActionType.UPDATE_CONTENT:
      case ActionType.OPTIMIZE_CONTENT:
        return {
          operation: 'optimize',
          description: action.description,
          focusAreas: ['readability', 'keyword_density', 'structure'],
          suggestions: action.evidence.map(e => e.description),
        };

      case ActionType.ADD_INTERNAL_LINK:
        return {
          operation: 'suggest_links',
          context: action.description,
          maxSuggestions: 10,
        };

      case ActionType.OPTIMIZE_ANCHOR_TEXT:
        return {
          operation: 'analyze_anchors',
          description: action.description,
        };

      case ActionType.FIX_TECHNICAL_ISSUE:
      case ActionType.FIX_SCHEMA_MARKUP:
        return {
          operation: 'diagnose_and_suggest',
          issueDescription: action.description,
          evidence: action.evidence.map(e => e.description),
        };

      case ActionType.IMPROVE_PAGE_SPEED:
        return {
          operation: 'performance_audit',
          description: action.description,
        };

      case ActionType.TARGET_NEW_KEYWORD:
        return {
          operation: 'keyword_research',
          seedKeywords: this.extractKeywordsFromEvidence(action.evidence),
          intent: 'informational',
        };

      case ActionType.IMPROVE_KEYWORD_RANKING:
        return {
          operation: 'optimization_suggestions',
          description: action.description,
          currentEvidence: action.evidence.map(e => e.description),
        };

      case ActionType.INVESTIGATE_ANOMALY:
        return {
          operation: 'anomaly_investigation',
          description: action.description,
          evidence: action.evidence.map(e => e.description),
        };

      case ActionType.SET_UP_ALERT:
        return {
          operation: 'create_alert',
          description: action.description,
          threshold: 0.1, // 10% change threshold
        };

      default:
        return {
          operation: 'custom',
          description: action.description,
          evidence: action.evidence.map(e => e.description),
        };
    }
  }

  /**
   * Dispatch task to the appropriate agent
   */
  private async dispatchToAgent(
    task: AgentTask,
    agentSource: AgentSource
  ): Promise<ActionResult> {
    const endpoint = this.agentEndpoints[agentSource];
    if (!endpoint) {
      throw new Error(`No endpoint configured for agent: ${agentSource}`);
    }

    const url = `${endpoint.baseUrl}${endpoint.taskEndpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`Agent responded with status ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Task dispatched successfully',
      outputData: data,
    };
  }

  /**
   * Simulate execution for dry run mode
   */
  private async simulateExecution(task: AgentTask): Promise<ActionResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      message: `[DRY RUN] Would execute ${task.taskType} on ${task.agentSource}`,
      outputData: {
        simulated: true,
        taskId: task.id,
        agentSource: task.agentSource,
        taskType: task.taskType,
        payload: task.payload,
      },
    };
  }

  /**
   * Check health of all agents
   */
  async checkAgentHealth(): Promise<Record<string, { healthy: boolean; latency?: number }>> {
    const results: Record<string, { healthy: boolean; latency?: number }> = {};

    for (const [agent, endpoint] of Object.entries(this.agentEndpoints)) {
      const start = Date.now();
      try {
        const response = await fetch(`${endpoint.baseUrl}${endpoint.healthEndpoint}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        results[agent] = {
          healthy: response.ok,
          latency: Date.now() - start,
        };
      } catch {
        results[agent] = { healthy: false };
      }
    }

    return results;
  }

  /**
   * Check if action dependencies are met
   */
  private async checkDependencies(action: SEOAction): Promise<string[]> {
    // For v1.0, we assume dependencies are met if they exist in the same plan
    // In a real implementation, we'd check execution status
    return [];
  }

  /**
   * Determine if a failure should block further execution
   */
  private isBlockingFailure(action: SEOAction): boolean {
    // Technical issues and high-priority actions are blocking
    return action.category === 'technical' || action.priority >= 8;
  }

  /**
   * Extract keywords from action evidence
   */
  private extractKeywordsFromEvidence(evidence: SEOAction['evidence']): string[] {
    const keywords: string[] = [];
    for (const e of evidence) {
      // Simple extraction - look for quoted strings
      const matches = e.description.match(/"([^"]+)"/g);
      if (matches) {
        keywords.push(...matches.map(m => m.replace(/"/g, '')));
      }
    }
    return keywords.slice(0, 5); // Limit to 5 keywords
  }

  /**
   * Log execution event
   */
  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    actionId?: string,
    agentSource?: AgentSource,
    details?: Record<string, unknown>
  ): void {
    const entry: ExecutionLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      actionId,
      agentSource,
      details,
    };

    this.executionLogs.push(entry);

    // Also log to console
    const prefix = `[ExecutionCoordinator]`;
    const actionInfo = actionId ? ` [${actionId.substring(0, 8)}]` : '';
    const agentInfo = agentSource ? ` (${agentSource})` : '';

    switch (level) {
      case 'info':
        this.logger.log(`${prefix}${actionInfo}${agentInfo} ${message}`);
        break;
      case 'warn':
        this.logger.warn(`${prefix}${actionInfo}${agentInfo} ${message}`);
        break;
      case 'error':
        this.logger.error(`${prefix}${actionInfo}${agentInfo} ${message}`);
        break;
    }
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(): ExecutionLog[] {
    return [...this.executionLogs];
  }

  /**
   * Clear execution logs
   */
  clearLogs(): void {
    this.executionLogs = [];
  }

  /**
   * Set dry run mode
   */
  setDryRun(enabled: boolean): void {
    this.dryRun = enabled;
    this.log('info', `Dry run mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if in dry run mode
   */
  isDryRun(): boolean {
    return this.dryRun;
  }
}

export default ExecutionCoordinator;
