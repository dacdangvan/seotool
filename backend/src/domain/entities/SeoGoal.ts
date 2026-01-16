/**
 * SEO Goal Types
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 */

export enum GoalType {
  TRAFFIC = 'TRAFFIC',
  RANKING = 'RANKING',
  LEADS = 'LEADS',
  BRAND_VISIBILITY = 'BRAND_VISIBILITY',
}

export enum GoalStatus {
  PENDING = 'PENDING',
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum GoalPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface GoalMetrics {
  targetValue: number;
  currentValue?: number;
  unit: string; // e.g., 'visitors', 'position', 'conversions'
}

export interface SeoGoal {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  targetUrl: string;
  keywords?: string[];
  metrics: GoalMetrics;
  priority: GoalPriority;
  status: GoalStatus;
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSeoGoalInput {
  type: GoalType;
  title: string;
  description: string;
  targetUrl: string;
  keywords?: string[];
  metrics: GoalMetrics;
  priority?: GoalPriority;
  deadline?: Date;
}
