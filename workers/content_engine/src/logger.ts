/**
 * Content Engine - Logger
 * 
 * Structured logging using Pino.
 * Follows same pattern as Backend Orchestrator.
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export class Logger {
  private readonly logger: pino.Logger;

  constructor(private readonly context: string) {
    this.logger = baseLogger.child({ context });
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.logger.trace(data, message);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data, message);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data, message);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(data, message);
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    this.logger.fatal(data, message);
  }

  /**
   * Create a child logger with additional context
   */
  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.context);
    (childLogger as unknown as { logger: pino.Logger }).logger = this.logger.child(bindings);
    return childLogger;
  }

  /**
   * Log a step in the content generation pipeline
   */
  step(stepNumber: number, totalSteps: number, message: string, data?: Record<string, unknown>): void {
    this.info(`[Step ${stepNumber}/${totalSteps}] ${message}`, data);
  }
}

// Export singleton for app-wide logging
export const logger = new Logger('content-engine');
