/**
 * Fastify Server Configuration
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Container } from './container';
import { Logger } from './shared/Logger';

export async function createServer(container: Container): Promise<FastifyInstance> {
  const logger = new Logger('Server');

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
              },
            }
          : undefined,
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // Register Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AI SEO Tool API',
        description: 'Backend Orchestrator for AI-powered SEO Tool',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 3000}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Goals', description: 'SEO Goals management' },
        { name: 'Plans', description: 'SEO Plans management' },
        { name: 'Projects', description: 'Projects and SEO Metrics management' },
        { name: 'Crawler', description: 'Web Crawler operations' },
        { name: 'Health', description: 'Health checks' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Register routes
  container.goalsController.registerRoutes(app);
  container.plansController.registerRoutes(app);
  container.healthController.registerRoutes(app);
  container.projectsController.registerRoutes(app);
  container.crawlerController.registerRoutes(app);

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  // Not found handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  logger.info('Server configured successfully');

  return app;
}
