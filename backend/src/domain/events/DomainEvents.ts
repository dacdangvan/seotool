/**
 * Domain Events
 * Event-driven architecture for loose coupling
 */

export enum DomainEventType {
  // Goal events
  GOAL_CREATED = 'goal.created',
  GOAL_UPDATED = 'goal.updated',
  GOAL_COMPLETED = 'goal.completed',
  GOAL_FAILED = 'goal.failed',
  
  // Plan events
  PLAN_CREATED = 'plan.created',
  PLAN_STARTED = 'plan.started',
  PLAN_PAUSED = 'plan.paused',
  PLAN_RESUMED = 'plan.resumed',
  PLAN_COMPLETED = 'plan.completed',
  PLAN_FAILED = 'plan.failed',
  
  // Task events
  TASK_CREATED = 'task.created',
  TASK_QUEUED = 'task.queued',
  TASK_STARTED = 'task.started',
  TASK_PROGRESS = 'task.progress',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_RETRYING = 'task.retrying',
  TASK_CANCELLED = 'task.cancelled',
  
  // Agent events
  AGENT_REGISTERED = 'agent.registered',
  AGENT_UNREGISTERED = 'agent.unregistered',
  AGENT_HEALTH_CHANGED = 'agent.health_changed',
}

export interface DomainEvent<T = unknown> {
  id: string;
  type: DomainEventType;
  timestamp: Date;
  aggregateId: string;
  aggregateType: 'goal' | 'plan' | 'task' | 'agent';
  payload: T;
  metadata?: Record<string, unknown>;
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

/**
 * Event Bus Interface
 */
export interface IEventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(eventType: DomainEventType, handler: EventHandler<T>): void;
  unsubscribe(eventType: DomainEventType, handler: EventHandler): void;
}

/**
 * Simple in-memory event bus for MVP
 * Replace with Redis/RabbitMQ for production
 */
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<DomainEventType, Set<EventHandler>> = new Map();

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const eventHandlers = this.handlers.get(event.type);
    if (!eventHandlers) return;

    const promises = Array.from(eventHandlers).map((handler) =>
      handler(event).catch((error) => {
        console.error(`Event handler error for ${event.type}:`, error);
      })
    );

    await Promise.all(promises);
  }

  subscribe<T>(eventType: DomainEventType, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
  }

  unsubscribe(eventType: DomainEventType, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }
}

/**
 * Helper to create domain events
 */
export function createDomainEvent<T>(
  type: DomainEventType,
  aggregateId: string,
  aggregateType: DomainEvent['aggregateType'],
  payload: T,
  metadata?: Record<string, unknown>
): DomainEvent<T> {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date(),
    aggregateId,
    aggregateType,
    payload,
    metadata,
  };
}
