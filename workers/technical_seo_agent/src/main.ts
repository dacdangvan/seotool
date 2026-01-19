/**
 * Technical SEO Agent - HTTP Server
 * Exposes audit functionality via REST API
 */

import http from 'http';
import { createLogger } from './logger';
import { loadConfig } from './config';
import { AuditRunner } from './audit_runner';
import { TechnicalAuditTaskSchema, TechnicalAuditTask } from './models';

const logger = createLogger('TechnicalSEOAgent');
const config = loadConfig();
const auditRunner = new AuditRunner(config, logger);

// Simple JSON body parser
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Request handler
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  logger.debug({ method, path }, 'Request received');

  try {
    // Health check
    if (path === '/health' && method === 'GET') {
      sendJson(res, 200, {
        status: 'healthy',
        version: '0.4.0',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Run audit
    if (path === '/audit' && method === 'POST') {
      const body = await parseBody(req);
      
      // Validate input
      const parseResult = TechnicalAuditTaskSchema.safeParse(body);
      if (!parseResult.success) {
        sendJson(res, 400, {
          error: 'Validation failed',
          details: parseResult.error.errors,
        });
        return;
      }

      const task: TechnicalAuditTask = parseResult.data;
      logger.info({ taskId: task.id, url: task.targetUrl }, 'Audit requested');

      // Run the audit
      const result = await auditRunner.run(task);

      sendJson(res, 200, result);
      return;
    }

    // API info
    if (path === '/' && method === 'GET') {
      sendJson(res, 200, {
        name: 'Technical SEO Agent',
        version: '0.4.0',
        endpoints: {
          'GET /': 'API information',
          'GET /health': 'Health check',
          'POST /audit': 'Run technical SEO audit',
        },
      });
      return;
    }

    // 404 for unknown routes
    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    logger.error({ error }, 'Request handler error');
    sendJson(res, 500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Create and start server
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    logger.error({ error }, 'Unhandled error');
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });
});

server.listen(config.port, config.host, () => {
  logger.info({ port: config.port, host: config.host }, 'Technical SEO Agent started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
