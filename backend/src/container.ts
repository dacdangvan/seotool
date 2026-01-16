/**
 * Dependency Injection Container
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Clean Architecture
 * 
 * Simple DI container for wiring dependencies
 */

import { Pool } from 'pg';
import { getPool } from './infrastructure/database/connection';

// Repositories
import {
  PostgresSeoGoalRepository,
  PostgresSeoPlanRepository,
  PostgresSeoTaskRepository,
} from './infrastructure/repositories/index';

// Services
import {
  TaskPlannerService,
  AgentDispatcher,
  TaskStatusTracker,
  SeoGoalService,
  SeoPlanService,
} from './application/services/index';

// Controllers
import {
  GoalsController,
  PlansController,
  HealthController,
} from './interfaces/http/controllers/index';

import { Logger } from './shared/Logger';

export interface Container {
  // Infrastructure
  pool: Pool;
  
  // Repositories
  goalRepository: PostgresSeoGoalRepository;
  planRepository: PostgresSeoPlanRepository;
  taskRepository: PostgresSeoTaskRepository;
  
  // Services
  taskPlanner: TaskPlannerService;
  agentDispatcher: AgentDispatcher;
  statusTracker: TaskStatusTracker;
  goalService: SeoGoalService;
  planService: SeoPlanService;
  
  // Controllers
  goalsController: GoalsController;
  plansController: PlansController;
  healthController: HealthController;
}

/**
 * Create and wire all dependencies
 */
export function createContainer(): Container {
  const logger = new Logger('Container');
  logger.info('Initializing dependency container');

  // Infrastructure
  const pool = getPool();

  // Repositories
  const goalRepository = new PostgresSeoGoalRepository(pool);
  const planRepository = new PostgresSeoPlanRepository(pool);
  const taskRepository = new PostgresSeoTaskRepository(pool);

  // Services
  const agentDispatcher = new AgentDispatcher();
  const taskPlanner = new TaskPlannerService(planRepository, taskRepository);
  const statusTracker = new TaskStatusTracker(taskRepository, planRepository);
  const goalService = new SeoGoalService(goalRepository, taskPlanner);
  const planService = new SeoPlanService(planRepository, taskPlanner);

  // Controllers
  const goalsController = new GoalsController(goalService);
  const plansController = new PlansController(planService);
  const healthController = new HealthController(agentDispatcher);

  logger.info('Dependency container initialized');

  return {
    pool,
    goalRepository,
    planRepository,
    taskRepository,
    taskPlanner,
    agentDispatcher,
    statusTracker,
    goalService,
    planService,
    goalsController,
    plansController,
    healthController,
  };
}
