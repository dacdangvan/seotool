/**
 * Application Entry Point
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * AI SEO Tool - Backend Orchestrator
 */

import 'dotenv/config';
import { createContainer } from './container';
import { createServer } from './server';
import { closePool } from './infrastructure/database/connection';
import { closeRedis } from './infrastructure/cache/redis';
import { Logger } from './shared/Logger';

const logger = new Logger('Main');

async function main(): Promise<void> {
  logger.info('Starting AI SEO Tool - Backend Orchestrator');

  try {
    // Create dependency container
    const container = createContainer();

    // Create Fastify server
    const server = await createServer(container);

    // Get port from environment
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    // Start server
    await server.listen({ port, host });

    logger.info(`Server listening on http://${host}:${port}`);
    logger.info(`API Documentation available at http://${host}:${port}/docs`);

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await server.close();
        await closePool();
        await closeRedis();
        logger.info('Server shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.fatal('Failed to start server', { error });
    process.exit(1);
  }
}

main();
