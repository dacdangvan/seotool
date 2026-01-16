/**
 * Database Connection Pool
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
 */

import { Pool, PoolConfig } from 'pg';
import { Logger } from '../../shared/Logger.js';

let pool: Pool | null = null;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export function getDbConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

export function getPool(): Pool {
  if (!pool) {
    const config = getDbConfig();
    pool = new Pool(config as PoolConfig);
    
    const logger = new Logger('Database');
    
    pool.on('connect', () => {
      logger.debug('New client connected to database');
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    return false;
  }
}
