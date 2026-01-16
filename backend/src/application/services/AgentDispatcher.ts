/**
 * AgentDispatcher - Stub/Interface for agent communication
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 * 
 * This is a stub implementation for MVP.
 * Real implementation will use BullMQ to dispatch tasks to agent workers.
 */

import { SeoTask, TaskType, TaskStatus } from '../../domain/index.js';
import { Logger } from '../../shared/Logger.js';

/**
 * Agent contract interface
 * All agents must implement this interface
 */
export interface IAgent {
  readonly name: string;
  readonly supportedTaskTypes: TaskType[];
  execute(task: SeoTask): Promise<AgentResult>;
  healthCheck(): Promise<boolean>;
}

export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  metrics?: Record<string, number>;
}

export interface AgentRegistration {
  agent: IAgent;
  priority: number;
  maxConcurrency: number;
}

/**
 * Mock Agent for development/testing
 */
export class MockAgent implements IAgent {
  readonly name = 'MockAgent';
  readonly supportedTaskTypes = Object.values(TaskType);

  async execute(task: SeoTask): Promise<AgentResult> {
    // Simulate execution time (1-3 seconds)
    const executionTimeMs = Math.random() * 2000 + 1000;
    await new Promise((resolve) => setTimeout(resolve, executionTimeMs));

    // 90% success rate for mock
    const success = Math.random() > 0.1;

    return {
      success,
      data: success
        ? { mockResult: true, taskType: task.type, message: 'Mock execution completed' }
        : undefined,
      error: success ? undefined : 'Mock agent simulated failure',
      executionTimeMs,
      metrics: {
        itemsProcessed: Math.floor(Math.random() * 100),
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

/**
 * AgentDispatcher - Routes tasks to appropriate agents
 */
export class AgentDispatcher {
  private readonly agents: Map<TaskType, AgentRegistration[]> = new Map();
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('AgentDispatcher');

    // Register mock agent for all task types in MVP
    this.registerDefaultMockAgent();
  }

  /**
   * Register a mock agent for development
   */
  private registerDefaultMockAgent(): void {
    const mockAgent = new MockAgent();
    this.registerAgent(mockAgent, { priority: 0, maxConcurrency: 10 });
    this.logger.info('Registered MockAgent for all task types');
  }

  /**
   * Register an agent for handling specific task types
   */
  registerAgent(
    agent: IAgent,
    options: { priority: number; maxConcurrency: number }
  ): void {
    for (const taskType of agent.supportedTaskTypes) {
      const registrations = this.agents.get(taskType) || [];
      registrations.push({
        agent,
        priority: options.priority,
        maxConcurrency: options.maxConcurrency,
      });
      // Sort by priority (higher priority first)
      registrations.sort((a, b) => b.priority - a.priority);
      this.agents.set(taskType, registrations);
    }

    this.logger.info(`Registered agent: ${agent.name} for ${agent.supportedTaskTypes.length} task types`);
  }

  /**
   * Dispatch a task to the appropriate agent
   */
  async dispatch(task: SeoTask): Promise<AgentResult> {
    const registrations = this.agents.get(task.type);

    if (!registrations || registrations.length === 0) {
      this.logger.error(`No agent registered for task type: ${task.type}`);
      return {
        success: false,
        error: `No agent available for task type: ${task.type}`,
        executionTimeMs: 0,
      };
    }

    // Get highest priority available agent
    const registration = registrations[0];
    const agent = registration.agent;

    this.logger.info(`Dispatching task ${task.id} (${task.type}) to agent: ${agent.name}`);

    try {
      const result = await agent.execute(task);

      if (result.success) {
        this.logger.info(`Task ${task.id} completed successfully in ${result.executionTimeMs}ms`);
      } else {
        this.logger.warn(`Task ${task.id} failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Task ${task.id} threw exception: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        executionTimeMs: 0,
      };
    }
  }

  /**
   * Check health of all registered agents
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const checkedAgents = new Set<string>();

    for (const registrations of this.agents.values()) {
      for (const reg of registrations) {
        if (checkedAgents.has(reg.agent.name)) continue;
        checkedAgents.add(reg.agent.name);

        try {
          const healthy = await reg.agent.healthCheck();
          results.set(reg.agent.name, healthy);
        } catch {
          results.set(reg.agent.name, false);
        }
      }
    }

    return results;
  }

  /**
   * Get list of supported task types
   */
  getSupportedTaskTypes(): TaskType[] {
    return Array.from(this.agents.keys());
  }
}
