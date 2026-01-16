/**
 * Logger - Structured logging utility
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
 * 
 * Uses Pino for production-grade logging
 */

import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
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
    (childLogger as { logger: pino.Logger }).logger = this.logger.child(bindings);
    return childLogger;
  }
}

// Export singleton for app-wide logging
export const logger = new Logger('app');
