/**
 * Standalone Crawler Worker Process
 * 
 * Section 18: SCHEDULED & MANUAL FULL CRAWL EXECUTION
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * This is an INDEPENDENT, CONTINUOUSLY RUNNING process that:
 * - Runs DECOUPLED from backend API
 * - Polls for pending crawl jobs
 * - Executes scheduled and manual crawls
 * - Never exits unless explicitly stopped
 * 
 * Usage:
 *   npm run worker:crawler
 *   tsx src/crawler/standalone_worker.ts
 * 
 * Architecture:
 *   Backend API → Creates jobs → Queue (PostgreSQL)
 *   Standalone Worker → Polls queue → Executes crawls
 *   Frontend → Triggers and observes, never crawls
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import { CrawlScheduler } from './crawl_scheduler';

// Load environment variables
config();

// ===========================================================================
// CONFIGURATION
// ===========================================================================

interface WorkerConfig {
  /** Poll interval in milliseconds */
  pollInterval: number;
  /** Maximum concurrent crawl jobs */
  maxConcurrentCrawls: number;
  /** Enable scheduled crawl processing */
  enableScheduling: boolean;
  /** Graceful shutdown timeout in ms */
  shutdownTimeout: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  pollInterval: parseInt(process.env.CRAWLER_POLL_INTERVAL || '10000', 10),
  maxConcurrentCrawls: parseInt(process.env.CRAWLER_MAX_CONCURRENT || '2', 10),
  enableScheduling: process.env.CRAWLER_ENABLE_SCHEDULING !== 'false',
  shutdownTimeout: parseInt(process.env.CRAWLER_SHUTDOWN_TIMEOUT || '30000', 10),
};

// ===========================================================================
// DATABASE CONNECTION
// ===========================================================================

function createDatabasePool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

// ===========================================================================
// STANDALONE WORKER CLASS
// ===========================================================================

class StandaloneCrawlerWorker {
  private pool: Pool;
  private scheduler: CrawlScheduler;
  private config: WorkerConfig;
  private isRunning: boolean = false;
  private isShuttingDown: boolean = false;
  
  constructor(pool: Pool, config: WorkerConfig) {
    this.pool = pool;
    this.config = config;
    this.scheduler = new CrawlScheduler(pool, {
      pollInterval: config.pollInterval,
      maxConcurrentCrawls: config.maxConcurrentCrawls,
      enableScheduling: config.enableScheduling,
    });
  }
  
  /**
   * Start the worker process
   * This runs continuously until stopped
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[StandaloneWorker] Already running');
      return;
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🕷️  STANDALONE CRAWLER WORKER');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Poll Interval:      ${this.config.pollInterval}ms`);
    console.log(`  Max Concurrent:     ${this.config.maxConcurrentCrawls}`);
    console.log(`  Scheduling:         ${this.config.enableScheduling ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  Shutdown Timeout:   ${this.config.shutdownTimeout}ms`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    
    // Test database connection
    try {
      await this.testDatabaseConnection();
    } catch (error) {
      console.error('[StandaloneWorker] Database connection failed:', error);
      process.exit(1);
    }
    
    this.isRunning = true;
    
    // Start the scheduler (handles polling internally)
    this.scheduler.start();
    
    console.log('[StandaloneWorker] Started and waiting for jobs...');
    console.log('[StandaloneWorker] Press Ctrl+C to stop gracefully');
    console.log('');
    
    // Keep process alive and log status periodically
    this.startStatusLogging();
  }
  
  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[StandaloneWorker] Shutdown already in progress...');
      return;
    }
    
    this.isShuttingDown = true;
    console.log('');
    console.log('[StandaloneWorker] Initiating graceful shutdown...');
    
    // Stop scheduler (will stop accepting new jobs)
    this.scheduler.stop();
    
    // Wait for active jobs to complete (with timeout)
    const startTime = Date.now();
    while (this.scheduler.getStatus().activeCrawls > 0) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.config.shutdownTimeout) {
        console.log('[StandaloneWorker] Shutdown timeout reached, forcing stop');
        break;
      }
      
      const status = this.scheduler.getStatus();
      console.log(`[StandaloneWorker] Waiting for ${status.activeCrawls} active crawls to complete...`);
      await this.sleep(2000);
    }
    
    // Close database pool
    await this.pool.end();
    
    this.isRunning = false;
    console.log('[StandaloneWorker] Shutdown complete');
  }
  
  /**
   * Test database connection
   */
  private async testDatabaseConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as time, current_database() as db');
      console.log(`[StandaloneWorker] Database connected: ${result.rows[0].db} at ${result.rows[0].time}`);
      
      // Check for pending jobs
      const pendingResult = await client.query(
        `SELECT COUNT(*) as count FROM crawl_queue WHERE status = 'pending'`
      );
      console.log(`[StandaloneWorker] Pending jobs in queue: ${pendingResult.rows[0].count}`);
      
      // Check for scheduled crawls due
      const scheduledResult = await client.query(
        `SELECT COUNT(*) as count FROM projects 
         WHERE crawl_schedule IS NOT NULL 
         AND next_scheduled_crawl <= NOW()`
      );
      console.log(`[StandaloneWorker] Scheduled crawls due: ${scheduledResult.rows[0].count}`);
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Log status periodically
   */
  private startStatusLogging(): void {
    const logInterval = setInterval(() => {
      if (!this.isRunning || this.isShuttingDown) {
        clearInterval(logInterval);
        return;
      }
      
      const status = this.scheduler.getStatus();
      if (status.activeCrawls > 0) {
        console.log(
          `[StandaloneWorker] Status: ${status.activeCrawls}/${status.maxConcurrentCrawls} active crawls | ` +
          `Projects: ${status.activeProjects.join(', ') || 'none'}`
        );
      }
    }, 60000); // Log every minute
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===========================================================================
// MAIN ENTRY POINT
// ===========================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('Starting Standalone Crawler Worker...');
  console.log('');
  
  // Create database pool
  const pool = createDatabasePool();
  
  // Create worker
  const worker = new StandaloneCrawlerWorker(pool, DEFAULT_CONFIG);
  
  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Main] Received ${signal}, shutting down...`);
    await worker.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
  });
  
  // Start worker
  try {
    await worker.start();
    
    // Keep process alive
    // The worker runs indefinitely until SIGINT/SIGTERM
    await new Promise(() => {});
    
  } catch (error) {
    console.error('[Main] Failed to start worker:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export { StandaloneCrawlerWorker, WorkerConfig };
