/**
 * Jobs Controller
 * 
 * API endpoints for managing scheduled jobs:
 * - GET /jobs - List all jobs and their statuses
 * - GET /jobs/:id - Get specific job status
 * - POST /jobs/:id/trigger - Manually trigger a job
 * - POST /jobs/:id/enable - Enable a job
 * - POST /jobs/:id/disable - Disable a job
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '../../../shared/Logger';
import { JobScheduler } from '../../../jobs';

export class JobsController {
  private readonly logger: Logger;
  private readonly jobScheduler: JobScheduler;

  constructor(jobScheduler: JobScheduler) {
    this.logger = new Logger('JobsController');
    this.jobScheduler = jobScheduler;
  }

  registerRoutes(app: FastifyInstance): void {
    // List all jobs
    app.get('/jobs', this.getAllJobs.bind(this));
    
    // Get specific job status
    app.get('/jobs/:id', this.getJobStatus.bind(this));
    
    // Trigger job manually
    app.post('/jobs/:id/trigger', this.triggerJob.bind(this));
    
    // Enable job
    app.post('/jobs/:id/enable', this.enableJob.bind(this));
    
    // Disable job
    app.post('/jobs/:id/disable', this.disableJob.bind(this));
  }

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  private async getAllJobs(
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const jobs = this.jobScheduler.getAllJobStatuses();
      
      reply.send({
        success: true,
        data: {
          jobs: jobs.map(job => ({
            id: this.getJobId(job.name),
            name: job.name,
            schedule: job.schedule,
            enabled: job.enabled,
            isRunning: job.isRunning,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            lastResult: job.lastResult,
          })),
          count: jobs.length,
        },
      });
    } catch (error: any) {
      this.logger.error('Failed to get jobs', { error: error.message });
      reply.status(500).send({
        success: false,
        error: 'Failed to get jobs',
      });
    }
  }

  private async getJobStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const job = this.jobScheduler.getJobStatus(id);

      if (!job) {
        reply.status(404).send({
          success: false,
          error: `Job not found: ${id}`,
        });
        return;
      }

      reply.send({
        success: true,
        data: {
          id,
          name: job.name,
          schedule: job.schedule,
          enabled: job.enabled,
          isRunning: job.isRunning,
          lastRun: job.lastRun,
          nextRun: job.nextRun,
          lastResult: job.lastResult,
        },
      });
    } catch (error: any) {
      this.logger.error('Failed to get job status', { error: error.message });
      reply.status(500).send({
        success: false,
        error: 'Failed to get job status',
      });
    }
  }

  private async triggerJob(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;

    try {
      this.logger.info(`Manual job trigger requested: ${id}`);
      
      const result = await this.jobScheduler.triggerJob(id);

      reply.send({
        success: true,
        data: {
          jobId: id,
          triggeredAt: new Date(),
          result,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to trigger job: ${id}`, { error: error.message });
      
      if (error.message.includes('not found')) {
        reply.status(404).send({
          success: false,
          error: error.message,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: `Failed to trigger job: ${error.message}`,
        });
      }
    }
  }

  private async enableJob(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;

    try {
      this.jobScheduler.enableJob(id);
      const job = this.jobScheduler.getJobStatus(id);

      reply.send({
        success: true,
        data: {
          jobId: id,
          enabled: true,
          nextRun: job?.nextRun,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to enable job: ${id}`, { error: error.message });
      
      if (error.message.includes('not found')) {
        reply.status(404).send({
          success: false,
          error: error.message,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: `Failed to enable job: ${error.message}`,
        });
      }
    }
  }

  private async disableJob(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;

    try {
      this.jobScheduler.disableJob(id);

      reply.send({
        success: true,
        data: {
          jobId: id,
          enabled: false,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to disable job: ${id}`, { error: error.message });
      
      if (error.message.includes('not found')) {
        reply.status(404).send({
          success: false,
          error: error.message,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: `Failed to disable job: ${error.message}`,
        });
      }
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private getJobId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }
}
