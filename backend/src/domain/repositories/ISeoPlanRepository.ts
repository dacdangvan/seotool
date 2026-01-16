/**
 * Repository Interface for SeoPlan
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Clean Architecture
 */

import { SeoPlan, CreateSeoPlanInput } from '../entities/SeoPlan.js';

export interface ISeoPlanRepository {
  create(input: CreateSeoPlanInput): Promise<SeoPlan>;
  findById(id: string): Promise<SeoPlan | null>;
  findByGoalId(goalId: string): Promise<SeoPlan[]>;
  findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<SeoPlan[]>;
  update(id: string, data: Partial<SeoPlan>): Promise<SeoPlan>;
  delete(id: string): Promise<boolean>;
}
