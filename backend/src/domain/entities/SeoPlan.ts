/**
 * SEO Plan - Decomposed from SeoGoal
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 */

import type { SeoTask } from './SeoTask.js';

export enum PlanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface PlanMetadata {
  estimatedDurationDays: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export interface SeoPlan {
  id: string;
  goalId: string;
  name: string;
  description: string;
  status: PlanStatus;
  tasks: SeoTask[];
  metadata: PlanMetadata;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateSeoPlanInput {
  goalId: string;
  name: string;
  description: string;
  tasks: SeoTask[];
}
