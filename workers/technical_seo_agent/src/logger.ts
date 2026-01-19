/**
 * Technical SEO Agent - Logger
 * Structured logging with Pino
 */

import pino from 'pino';

export function createLogger(name: string, debug = false): pino.Logger {
  return pino({
    name,
    level: debug ? 'debug' : 'info',
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
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}

export type Logger = pino.Logger;
