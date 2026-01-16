/**
 * Agent Contract Interface
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * This interface defines the contract all SEO agents must implement.
 * Placed in domain layer as it represents core business contracts.
 */

import { TaskType } from '../entities/SeoTask';

/**
 * Result returned by an agent after task execution
 */
export interface AgentResult {
  /** Whether the task completed successfully */
  success: boolean;
  
  /** Result data (agent-specific structure) */
  data?: unknown;
  
  /** Error message if failed */
  error?: string;
  
  /** Execution time in milliseconds */
  executionTimeMs: number;
  
  /** Optional metrics collected during execution */
  metrics?: Record<string, number>;
  
  /** Explanation of what the agent did (for explainability) */
  explanation?: string;
}

/**
 * Agent capabilities descriptor
 */
export interface AgentCapabilities {
  /** Maximum concurrent tasks this agent can handle */
  maxConcurrency: number;
  
  /** Average execution time in ms (for planning) */
  avgExecutionTimeMs: number;
  
  /** Whether agent supports cancellation */
  supportsCancellation: boolean;
  
  /** Whether agent supports progress reporting */
  supportsProgress: boolean;
}

/**
 * Progress update from agent during execution
 */
export interface AgentProgress {
  taskId: string;
  progress: number; // 0-100
  message?: string;
  estimatedRemainingMs?: number;
}

/**
 * Agent contract interface
 * All SEO agents must implement this interface
 */
export interface IAgent {
  /** Unique agent name */
  readonly name: string;
  
  /** Agent version for compatibility tracking */
  readonly version: string;
  
  /** Task types this agent can handle */
  readonly supportedTaskTypes: TaskType[];
  
  /** Agent capabilities */
  readonly capabilities: AgentCapabilities;
  
  /**
   * Execute a task
   * @param task - The task to execute
   * @param onProgress - Optional callback for progress updates
   */
  execute(
    task: { id: string; type: TaskType; input: Record<string, unknown> },
    onProgress?: (progress: AgentProgress) => void
  ): Promise<AgentResult>;
  
  /**
   * Check if agent is healthy and ready
   */
  healthCheck(): Promise<boolean>;
  
  /**
   * Cancel a running task (if supported)
   */
  cancel?(taskId: string): Promise<boolean>;
  
  /**
   * Validate task input before execution
   */
  validateInput?(input: Record<string, unknown>): { valid: boolean; errors?: string[] };
}

/**
 * Agent registry for discovering available agents
 */
export interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentName: string): void;
  getAgent(taskType: TaskType): IAgent | undefined;
  getAllAgents(): IAgent[];
  getAgentByName(name: string): IAgent | undefined;
}
