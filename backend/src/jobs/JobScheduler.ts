/**
 * Job Scheduler
 * 
 * Manages scheduled jobs using node-cron
 * Supports:
 * - Cron-based scheduling
 * - Manual job triggering
 * - Job status monitoring
 * - Graceful shutdown
 */

import { Pool } from 'pg';
import { Logger } from '../shared/Logger';
import { RecommendationGeneratorJob, GeneratorConfig, GenerationResult } from './RecommendationGeneratorJob';

// =============================================================================
// TYPES
// =============================================================================

export interface ScheduledJob {
  name: string;
  schedule: string; // Cron expression
  enabled: boolean;
  lastRun?: Date;
  lastResult?: any;
  nextRun?: Date;
  isRunning: boolean;
}

export interface JobSchedulerConfig {
  recommendationGenerator: {
    enabled: boolean;
    schedule: string; // Cron expression, e.g., "0 6 * * *" (6:00 AM daily)
    config: Partial<GeneratorConfig>;
  };
}

interface CronTask {
  stop: () => void;
  start: () => void;
}

// =============================================================================
// SIMPLE CRON IMPLEMENTATION
// =============================================================================

/**
 * Simple cron parser and scheduler
 * Supports: minute, hour, day of month, month, day of week
 * Format: "minute hour dayOfMonth month dayOfWeek"
 */
class SimpleCron {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly schedule: string;
  private readonly callback: () => void;
  private readonly logger: Logger;

  constructor(schedule: string, callback: () => void) {
    this.schedule = schedule;
    this.callback = callback;
    this.logger = new Logger('SimpleCron');
  }

  start(): void {
    // Check every minute
    this.intervalId = setInterval(() => {
      if (this.shouldRun()) {
        this.callback();
      }
    }, 60000); // Check every minute

    this.logger.info(`Cron job started with schedule: ${this.schedule}`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Cron job stopped');
    }
  }

  private shouldRun(): boolean {
    const now = new Date();
    const [minute, hour, dayOfMonth, month, dayOfWeek] = this.schedule.split(' ');

    return (
      this.matches(minute, now.getMinutes()) &&
      this.matches(hour, now.getHours()) &&
      this.matches(dayOfMonth, now.getDate()) &&
      this.matches(month, now.getMonth() + 1) &&
      this.matches(dayOfWeek, now.getDay())
    );
  }

  private matches(pattern: string, value: number): boolean {
    if (pattern === '*') return true;
    
    // Handle */n syntax (every n)
    if (pattern.startsWith('*/')) {
      const interval = parseInt(pattern.substring(2));
      return value % interval === 0;
    }

    // Handle comma-separated values
    if (pattern.includes(',')) {
      return pattern.split(',').map(Number).includes(value);
    }

    // Handle range (e.g., 1-5)
    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(Number);
      return value >= start && value <= end;
    }

    return parseInt(pattern) === value;
  }

  getNextRun(): Date {
    const now = new Date();
    const [minute, hour] = this.schedule.split(' ');
    
    const nextRun = new Date(now);
    
    // Simple estimation for daily jobs
    if (minute !== '*' && hour !== '*') {
      nextRun.setMinutes(parseInt(minute));
      nextRun.setHours(parseInt(hour));
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }
    
    return nextRun;
  }
}

// =============================================================================
// JOB SCHEDULER
// =============================================================================

export class JobScheduler {
  private readonly logger: Logger;
  private readonly pool: Pool;
  private readonly config: JobSchedulerConfig;
  private readonly jobs: Map<string, ScheduledJob> = new Map();
  private readonly cronTasks: Map<string, SimpleCron> = new Map();
  private isInitialized = false;

  constructor(pool: Pool, config?: Partial<JobSchedulerConfig>) {
    this.logger = new Logger('JobScheduler');
    this.pool = pool;
    this.config = {
      recommendationGenerator: {
        enabled: config?.recommendationGenerator?.enabled ?? true,
        schedule: config?.recommendationGenerator?.schedule ?? '0 6 * * *', // 6:00 AM daily
        config: config?.recommendationGenerator?.config ?? {},
      },
    };
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('JobScheduler already initialized');
      return;
    }

    this.logger.info('Initializing JobScheduler');

    // Initialize Recommendation Generator Job
    if (this.config.recommendationGenerator.enabled) {
      this.registerJob('recommendation-generator', {
        name: 'Recommendation Generator',
        schedule: this.config.recommendationGenerator.schedule,
        enabled: true,
        isRunning: false,
      });
    }

    this.isInitialized = true;
    this.logger.info('JobScheduler initialized', { 
      jobs: Array.from(this.jobs.keys()) 
    });
  }

  // ===========================================================================
  // JOB MANAGEMENT
  // ===========================================================================

  private registerJob(id: string, job: ScheduledJob): void {
    this.jobs.set(id, job);

    if (job.enabled) {
      const cronTask = new SimpleCron(job.schedule, () => {
        this.executeJob(id).catch(err => {
          this.logger.error(`Scheduled execution of ${id} failed`, { error: err.message });
        });
      });
      
      this.cronTasks.set(id, cronTask);
      job.nextRun = cronTask.getNextRun();
    }

    this.logger.info(`Job registered: ${job.name}`, { 
      id, 
      schedule: job.schedule,
      nextRun: job.nextRun 
    });
  }

  start(): void {
    this.logger.info('Starting all scheduled jobs');
    
    for (const [id, cronTask] of this.cronTasks) {
      const job = this.jobs.get(id);
      if (job?.enabled) {
        cronTask.start();
        this.logger.info(`Started job: ${job.name}`);
      }
    }
  }

  stop(): void {
    this.logger.info('Stopping all scheduled jobs');
    
    for (const [id, cronTask] of this.cronTasks) {
      cronTask.stop();
      const job = this.jobs.get(id);
      if (job) {
        this.logger.info(`Stopped job: ${job.name}`);
      }
    }
  }

  // ===========================================================================
  // JOB EXECUTION
  // ===========================================================================

  async executeJob(jobId: string): Promise<any> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.isRunning) {
      this.logger.warn(`Job ${job.name} is already running, skipping`);
      return { skipped: true, reason: 'already_running' };
    }

    job.isRunning = true;
    job.lastRun = new Date();

    this.logger.info(`Executing job: ${job.name}`);

    try {
      let result: any;

      switch (jobId) {
        case 'recommendation-generator':
          result = await this.executeRecommendationGenerator();
          break;
        default:
          throw new Error(`Unknown job: ${jobId}`);
      }

      job.lastResult = { success: true, data: result, timestamp: new Date() };
      job.nextRun = this.cronTasks.get(jobId)?.getNextRun();

      this.logger.info(`Job ${job.name} completed successfully`);
      return result;

    } catch (error: any) {
      job.lastResult = { 
        success: false, 
        error: error.message, 
        timestamp: new Date() 
      };
      this.logger.error(`Job ${job.name} failed`, { error: error.message });
      throw error;

    } finally {
      job.isRunning = false;
    }
  }

  private async executeRecommendationGenerator(): Promise<GenerationResult[]> {
    const generator = new RecommendationGeneratorJob(
      this.pool,
      this.config.recommendationGenerator.config
    );
    return generator.run();
  }

  // ===========================================================================
  // STATUS & CONTROL
  // ===========================================================================

  getJobStatus(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobStatuses(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  enableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.enabled) {
      this.logger.warn(`Job ${job.name} is already enabled`);
      return;
    }

    job.enabled = true;
    
    const cronTask = this.cronTasks.get(jobId);
    if (cronTask) {
      cronTask.start();
      job.nextRun = cronTask.getNextRun();
    }

    this.logger.info(`Job enabled: ${job.name}`);
  }

  disableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!job.enabled) {
      this.logger.warn(`Job ${job.name} is already disabled`);
      return;
    }

    job.enabled = false;
    job.nextRun = undefined;
    
    const cronTask = this.cronTasks.get(jobId);
    if (cronTask) {
      cronTask.stop();
    }

    this.logger.info(`Job disabled: ${job.name}`);
  }

  /**
   * Trigger a job manually (for testing or on-demand execution)
   */
  async triggerJob(jobId: string): Promise<any> {
    this.logger.info(`Manual trigger requested for job: ${jobId}`);
    return this.executeJob(jobId);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createJobScheduler(
  pool: Pool,
  config?: Partial<JobSchedulerConfig>
): JobScheduler {
  return new JobScheduler(pool, config);
}
