/**
 * Request/Response Schemas - Zod validation
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
 */

import { z } from 'zod';
import { GoalType, GoalPriority, GoalStatus } from '../../domain/entities/SeoGoal';

// Goal Metrics Schema
export const GoalMetricsSchema = z.object({
  targetValue: z.number().positive('Target value must be positive'),
  currentValue: z.number().optional(),
  unit: z.string().min(1, 'Unit is required'),
});

// Create Goal Request Schema
export const CreateGoalRequestSchema = z.object({
  type: z.nativeEnum(GoalType, {
    errorMap: () => ({ message: 'Invalid goal type' }),
  }),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  targetUrl: z.string().url('Invalid URL format'),
  keywords: z.array(z.string()).optional(),
  metrics: GoalMetricsSchema,
  priority: z.nativeEnum(GoalPriority).optional(),
  deadline: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
});

export type CreateGoalRequest = z.infer<typeof CreateGoalRequestSchema>;

// Goal Response Schema
export const GoalResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(GoalType),
  title: z.string(),
  description: z.string(),
  targetUrl: z.string(),
  keywords: z.array(z.string()).optional(),
  metrics: GoalMetricsSchema,
  priority: z.nativeEnum(GoalPriority),
  status: z.nativeEnum(GoalStatus),
  deadline: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Create Goal Response
export const CreateGoalResponseSchema = z.object({
  goal: GoalResponseSchema,
  planId: z.string().uuid(),
});

// List Goals Query
export const ListGoalsQuerySchema = z.object({
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 20),
  offset: z.string().optional().transform((val) => val ? parseInt(val, 10) : 0),
  status: z.nativeEnum(GoalStatus).optional(),
});

export type ListGoalsQuery = z.infer<typeof ListGoalsQuerySchema>;

// Plan Params
export const PlanParamsSchema = z.object({
  id: z.string().uuid('Invalid plan ID'),
});

export type PlanParams = z.infer<typeof PlanParamsSchema>;

// Error Response Schema
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
