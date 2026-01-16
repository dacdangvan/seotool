/**
 * Application Error classes
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export class AgentError extends AppError {
  constructor(message: string, agentName: string, details?: Record<string, unknown>) {
    super(message, 'AGENT_ERROR', 500, { agentName, ...details });
    this.name = 'AgentError';
  }
}

// Domain-specific errors
export class InvalidStateTransitionError extends AppError {
  constructor(from: string, to: string, entity: string) {
    super(
      `Invalid ${entity} state transition: ${from} -> ${to}`,
      'INVALID_STATE_TRANSITION',
      400,
      { from, to, entity }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class TaskExecutionError extends AppError {
  constructor(taskId: string, reason: string, details?: Record<string, unknown>) {
    super(
      `Task execution failed: ${reason}`,
      'TASK_EXECUTION_ERROR',
      500,
      { taskId, reason, ...details }
    );
    this.name = 'TaskExecutionError';
  }
}

export class PlanningError extends AppError {
  constructor(message: string, goalId: string, details?: Record<string, unknown>) {
    super(message, 'PLANNING_ERROR', 400, { goalId, ...details });
    this.name = 'PlanningError';
  }
}
