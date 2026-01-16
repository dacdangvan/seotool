/**
 * SEO Task - Atomic unit of work assigned to agents
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 */

export enum TaskType {
  KEYWORD_ANALYSIS = 'KEYWORD_ANALYSIS',
  CONTENT_GENERATION = 'CONTENT_GENERATION',
  CONTENT_OPTIMIZATION = 'CONTENT_OPTIMIZATION',
  TECHNICAL_AUDIT = 'TECHNICAL_AUDIT',
  INTERNAL_LINKING = 'INTERNAL_LINKING',
  BACKLINK_ANALYSIS = 'BACKLINK_ANALYSIS',
  ENTITY_EXTRACTION = 'ENTITY_EXTRACTION',
  SCHEMA_GENERATION = 'SCHEMA_GENERATION',
  RANK_TRACKING = 'RANK_TRACKING',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export interface TaskInput {
  [key: string]: unknown;
}

export interface TaskOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  metrics?: Record<string, number>;
}

export interface TaskDependency {
  taskId: string;
  required: boolean; // If true, this task cannot start until dependency completes
}

export interface SeoTask {
  id: string;
  planId: string;
  type: TaskType;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  input: TaskInput;
  output?: TaskOutput;
  dependencies: TaskDependency[];
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateSeoTaskInput {
  planId: string;
  type: TaskType;
  name: string;
  description: string;
  priority?: TaskPriority;
  input: TaskInput;
  dependencies?: TaskDependency[];
  maxRetries?: number;
  timeoutMs?: number;
}
