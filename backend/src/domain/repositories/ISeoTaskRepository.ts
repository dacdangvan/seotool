/**
 * Repository Interface for SeoTask
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Clean Architecture
 */

import { SeoTask, CreateSeoTaskInput, TaskStatus } from '../entities/SeoTask.js';

export interface ISeoTaskRepository {
  create(input: CreateSeoTaskInput): Promise<SeoTask>;
  createMany(inputs: CreateSeoTaskInput[]): Promise<SeoTask[]>;
  findById(id: string): Promise<SeoTask | null>;
  findByPlanId(planId: string): Promise<SeoTask[]>;
  findPendingTasks(limit?: number): Promise<SeoTask[]>;
  findByStatus(status: TaskStatus, limit?: number): Promise<SeoTask[]>;
  update(id: string, data: Partial<SeoTask>): Promise<SeoTask>;
  updateStatus(id: string, status: TaskStatus): Promise<SeoTask>;
  delete(id: string): Promise<boolean>;
}
