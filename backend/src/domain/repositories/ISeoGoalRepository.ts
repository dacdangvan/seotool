/**
 * Repository Interface for SeoGoal
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Clean Architecture
 */

import { SeoGoal, CreateSeoGoalInput } from '../entities/SeoGoal.js';

export interface ISeoGoalRepository {
  create(input: CreateSeoGoalInput): Promise<SeoGoal>;
  findById(id: string): Promise<SeoGoal | null>;
  findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<SeoGoal[]>;
  update(id: string, data: Partial<SeoGoal>): Promise<SeoGoal>;
  delete(id: string): Promise<boolean>;
}
