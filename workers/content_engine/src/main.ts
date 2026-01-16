/**
 * Content Engine - Main Entry Point
 * 
 * HTTP server for content generation tasks.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from './config';
import { Logger } from './logger';
import { createLLMAdapter } from './adapters';
import { ContentGenerator } from './content_generator';
import {
  ContentGenerationTaskSchema,
  ContentStatus,
  type ContentGenerationTask,
  type ContentGenerationResult,
} from './models';
import {
  PostgresContentRepository,
  InMemoryContentRepository,
  type ContentRepository,
} from './repositories';

const logger = new Logger('main');
const config = loadConfig();

// Initialize components
let repository: ContentRepository;
let generator: ContentGenerator;

async function initializeComponents(): Promise<void> {
  // Initialize LLM adapter
  const llmProvider = config.llmProvider === 'openai' || config.llmProvider === 'anthropic'
    ? config.llmProvider
    : 'openai';
  
  const llmAdapter = createLLMAdapter(config.debug ? 'mock' : llmProvider);
  generator = new ContentGenerator(llmAdapter);

  // Initialize repository
  if (config.databaseUrl && config.databaseUrl !== 'mock') {
    const pgRepo = new PostgresContentRepository(config.databaseUrl);
    await pgRepo.initialize();
    repository = pgRepo;
    logger.info('Using PostgreSQL repository');
  } else {
    repository = new InMemoryContentRepository();
    logger.info('Using in-memory repository');
  }
}

/**
 * Parse JSON body from request
 */
async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJSON(
  res: ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Health check endpoint
 */
function handleHealth(res: ServerResponse): void {
  sendJSON(res, 200, {
    status: 'healthy',
    service: 'content-engine',
    version: '0.3.0',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Generate content endpoint
 */
async function handleGenerate(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseBody(req);
    
    // Validate input
    const parseResult = ContentGenerationTaskSchema.safeParse(body);
    if (!parseResult.success) {
      sendJSON(res, 400, {
        error: 'Validation failed',
        details: parseResult.error.issues,
      });
      return;
    }

    const task = parseResult.data;
    
    logger.info('Content generation request received', {
      taskId: task.id,
      primaryKeyword: task.primaryKeyword.text,
    });

    // Generate content
    const result = await generator.generate(task);

    // Store result if successful
    if (result.status === ContentStatus.COMPLETED && result.content) {
      await repository.save({
        id: uuidv4(),
        taskId: task.id,
        planId: task.planId,
        primaryKeyword: task.primaryKeyword.text,
        outline: result.content.outline,
        markdownContent: result.content.markdownContent,
        seoMetadata: result.content.seoMetadata,
        faqSchema: result.content.faqSchema,
        wordCount: result.content.wordCount,
        status: ContentStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    sendJSON(res, result.status === ContentStatus.COMPLETED ? 200 : 500, result);
  } catch (error) {
    logger.error('Content generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    sendJSON(res, 500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get content by task ID
 */
async function handleGetByTaskId(
  taskId: string,
  res: ServerResponse
): Promise<void> {
  try {
    const content = await repository.findByTaskId(taskId);
    
    if (!content) {
      sendJSON(res, 404, { error: 'Content not found' });
      return;
    }

    sendJSON(res, 200, content);
  } catch (error) {
    logger.error('Failed to retrieve content', { taskId, error });
    sendJSON(res, 500, { error: 'Internal server error' });
  }
}

/**
 * Request handler
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route handling
  if (path === '/health' && method === 'GET') {
    handleHealth(res);
    return;
  }

  if (path === '/generate' && method === 'POST') {
    await handleGenerate(req, res);
    return;
  }

  // GET /content/:taskId
  const contentMatch = path.match(/^\/content\/([a-f0-9-]+)$/);
  if (contentMatch && method === 'GET') {
    await handleGetByTaskId(contentMatch[1], res);
    return;
  }

  // 404
  sendJSON(res, 404, { error: 'Not found' });
}

/**
 * Start server
 */
async function main(): Promise<void> {
  try {
    await initializeComponents();

    const server = createServer(async (req, res) => {
      try {
        await handleRequest(req, res);
      } catch (error) {
        logger.error('Unhandled request error', { error });
        sendJSON(res, 500, { error: 'Internal server error' });
      }
    });

    server.listen(config.port, config.host, () => {
      logger.info(`Content Engine v0.3.0 started`, {
        host: config.host,
        port: config.port,
        debug: config.debug,
        llmProvider: config.debug ? 'mock' : config.llmProvider,
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('Shutting down...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

main();
