/**
 * Health Check Controller
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { checkConnection } from '../../../infrastructure/database/connection.js';
import { AgentDispatcher } from '../../../application/services/AgentDispatcher.js';
import { Logger } from '../../../shared/Logger.js';

export class HealthController {
  private readonly logger: Logger;

  constructor(private readonly agentDispatcher: AgentDispatcher) {
    this.logger = new Logger('HealthController');
  }

  registerRoutes(app: FastifyInstance): void {
    app.get('/health', this.healthCheck.bind(this));
    app.get('/health/ready', this.readinessCheck.bind(this));
    app.get('/health/live', this.livenessCheck.bind(this));
  }

  /**
   * GET /health
   * Basic health check
   */
  async healthCheck(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  }

  /**
   * GET /health/ready
   * Readiness check - checks all dependencies
   */
  async readinessCheck(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const checks: Record<string, boolean> = {};

    // Check database
    try {
      checks.database = await checkConnection();
    } catch {
      checks.database = false;
    }

    // Check agents
    try {
      const agentHealth = await this.agentDispatcher.healthCheck();
      checks.agents = Array.from(agentHealth.values()).every((v) => v);
    } catch {
      checks.agents = false;
    }

    const allHealthy = Object.values(checks).every((v) => v);

    reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /health/live
   * Liveness check - basic alive check
   */
  async livenessCheck(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  }
}
