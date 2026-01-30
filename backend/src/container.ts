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
  PostgresKeywordRankingsRepository,
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
  ProjectsController,
  AuthController,
  DashboardController,
} from './interfaces/http/controllers/index';

// Crawler (new auto-crawl system)
import { CrawlController } from './crawler/crawl_controller';
import { KeywordController } from './interfaces/http/controllers/KeywordController';

// Jobs
import { JobScheduler, createJobScheduler } from './jobs';
import { JobsController } from './interfaces/http/controllers/JobsController';

import { Logger } from './shared/Logger';

export interface Container {
  // Infrastructure
  pool: Pool;
  
  // Repositories
  goalRepository: PostgresSeoGoalRepository;
  planRepository: PostgresSeoPlanRepository;
  taskRepository: PostgresSeoTaskRepository;
  keywordRepository: PostgresKeywordRankingsRepository;
  
  // Services
  taskPlanner: TaskPlannerService;
  agentDispatcher: AgentDispatcher;
  statusTracker: TaskStatusTracker;
  goalService: SeoGoalService;
  planService: SeoPlanService;
  
  // Jobs
  jobScheduler: JobScheduler;
  
  // Controllers
  goalsController: GoalsController;
  plansController: PlansController;
  healthController: HealthController;
  projectsController: ProjectsController;
  crawlerController: CrawlController;
  keywordController: KeywordController;
  authController: AuthController;
  dashboardController: DashboardController;
  jobsController: JobsController;
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
  const keywordRepository = new PostgresKeywordRankingsRepository(pool);

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
  const projectsController = new ProjectsController(pool);
  const crawlerController = new CrawlController(pool);
  const authController = new AuthController(pool);
  const dashboardController = new DashboardController(pool);
  const keywordController = new KeywordController(keywordRepository);

  // Jobs
  const jobScheduler = createJobScheduler(pool, {
    recommendationGenerator: {
      enabled: process.env.ENABLE_SCHEDULED_JOBS !== 'false',
      schedule: process.env.RECOMMENDATION_JOB_SCHEDULE || '0 6 * * *', // 6:00 AM daily
      config: {
        maxRecommendationsPerProject: 20,
        cleanupOldDays: 30,
      },
    },
  });
  const jobsController = new JobsController(jobScheduler);

  logger.info('Dependency container initialized');

  return {
    // Infrastructure
    pool,

    // Repositories
    goalRepository,
    planRepository,
    taskRepository,
    keywordRepository,

    // Services
    taskPlanner,
    agentDispatcher,
    statusTracker,
    goalService,
    planService,

    // Jobs
    jobScheduler,

    // Controllers
    goalsController,
    plansController,
    healthController,
    projectsController,
    crawlerController,
    authController,
    dashboardController,
    keywordController,
    jobsController,
  };
}
