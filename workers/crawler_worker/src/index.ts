/**
 * Standalone Crawler Worker - Main Entry Point
 * 
 * Independent worker package for processing crawl jobs
 * 
 * Usage:
 *   npm run dev   - Development with hot reload
 *   npm run start - Production mode
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import { CrawlScheduler } from './crawler/crawl_scheduler.js';

// Load environment variables
config();

// ===========================================================================
// CONFIGURATION
// ===========================================================================

interface WorkerConfig {
  pollInterval: number;
  maxConcurrentCrawls: number;
  enableScheduling: boolean;
  shutdownTimeout: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  pollInterval: parseInt(process.env.CRAWLER_POLL_INTERVAL || '10000', 10),
  maxConcurrentCrawls: parseInt(process.env.CRAWLER_MAX_CONCURRENT || '2', 10),
  enableScheduling: process.env.CRAWLER_ENABLE_SCHEDULING !== 'false',
  shutdownTimeout: parseInt(process.env.CRAWLER_SHUTDOWN_TIMEOUT || '30000', 10),
};

// ===========================================================================
// DATABASE
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
// WORKER CLASS
// ===========================================================================

class StandaloneCrawlerWorker {
  private pool: Pool;
  private scheduler: CrawlScheduler;
  private config: WorkerConfig;
  private isRunning = false;
  private isShuttingDown = false;

  constructor(pool: Pool, config: WorkerConfig) {
    this.pool = pool;
    this.config = config;
    this.scheduler = new CrawlScheduler(pool, {
      pollInterval: config.pollInterval,
      maxConcurrentCrawls: config.maxConcurrentCrawls,
      enableScheduling: config.enableScheduling,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Worker] Already running');
      return;
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🕷️  STANDALONE CRAWLER WORKER');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Poll Interval:      ${this.config.pollInterval}ms`);
    console.log(`  Max Concurrent:     ${this.config.maxConcurrentCrawls}`);
    console.log(`  Scheduling:         ${this.config.enableScheduling ? 'ENABLED' : 'DISABLED'}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Test database
    try {
      await this.testDatabase();
    } catch (error) {
      console.error('[Worker] Database connection failed:', error);
      process.exit(1);
    }

    this.isRunning = true;
    this.scheduler.start();

    console.log('[Worker] Started and waiting for jobs...');
    console.log('[Worker] Press Ctrl+C to stop');
    console.log('');

    // Status logging
    setInterval(() => {
      if (!this.isRunning || this.isShuttingDown) return;
      const status = this.scheduler.getStatus();
      if (status.activeCrawls > 0) {
        console.log(`[Worker] Active: ${status.activeCrawls}/${status.maxConcurrentCrawls} | Projects: ${status.activeProjects.join(', ')}`);
      }
    }, 60000);
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('\n[Worker] Shutting down...');
    this.scheduler.stop();

    // Wait for active crawls
    const startTime = Date.now();
    while (this.scheduler.getStatus().activeCrawls > 0) {
      if (Date.now() - startTime >= this.config.shutdownTimeout) {
        console.log('[Worker] Shutdown timeout, forcing stop');
        break;
      }
      console.log(`[Worker] Waiting for ${this.scheduler.getStatus().activeCrawls} crawls...`);
      await this.sleep(2000);
    }

    await this.pool.end();
    this.isRunning = false;
    console.log('[Worker] Shutdown complete');
  }

  private async testDatabase(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as time, current_database() as db');
      console.log(`[Worker] Database: ${result.rows[0].db} at ${result.rows[0].time}`);

      const pending = await client.query(`SELECT COUNT(*) as count FROM crawl_queue WHERE status = 'pending'`);
      console.log(`[Worker] Pending jobs: ${pending.rows[0].count}`);
    } finally {
      client.release();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===========================================================================
// MAIN
// ===========================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('Starting Standalone Crawler Worker...');
  console.log('');

  const pool = createDatabasePool();
  const worker = new StandaloneCrawlerWorker(pool, DEFAULT_CONFIG);

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Main] Received ${signal}`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  try {
    await worker.start();
    // Keep alive
    await new Promise(() => {});
  } catch (error) {
    console.error('[Main] Failed to start:', error);
    await pool.end();
    process.exit(1);
  }
}

main().catch(console.error);

export { StandaloneCrawlerWorker };
