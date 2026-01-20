import Redis from 'ioredis';

let redisClient: Redis | null = null;

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get Redis client instance
 */
export async function getRedisClient(): Promise<Redis> {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = new Redis(redisUrl, {
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error('Redis: Max reconnection attempts reached');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    maxRetriesPerRequest: 3,
  });

  redisClient.on('error', (err: Error) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis connection closed');
  }
}

/**
 * Check Redis connection health
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

// =============================================================================
// CACHE SERVICE
// =============================================================================

/**
 * Cache key prefixes for different data types
 */
export const CacheKeys = {
  PROJECT: 'project',
  PROJECT_LIST: 'projects:list',
  SEO_TRAFFIC: 'seo:traffic',
  SEO_KEYWORDS: 'seo:keywords',
  SEO_HEALTH: 'seo:health',
  SEO_BACKLINKS: 'seo:backlinks',
  SEO_KPI: 'seo:kpi',
  SEO_FORECASTS: 'seo:forecasts',
  SEO_RECOMMENDATIONS: 'seo:recommendations',
  DASHBOARD_SUMMARY: 'dashboard:summary',
} as const;

/**
 * Build cache key with optional suffix
 */
export function buildCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return [prefix, ...parts].join(':');
}

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(
  key: string, 
  value: T, 
  options: CacheOptions = {}
): Promise<void> {
  try {
    const client = await getRedisClient();
    const ttl = options.ttl ?? DEFAULT_TTL;
    await client.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(key);
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
  }
}

/**
 * Delete all cached values matching pattern
 */
export async function deleteCachedPattern(pattern: string): Promise<void> {
  try {
    const client = await getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error(`Cache delete pattern error for ${pattern}:`, error);
  }
}

/**
 * Get or set cached value (cache-aside pattern)
 */
export async function getOrSetCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache first
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const freshData = await fetchFn();
  
  // Store in cache
  await setCached(key, freshData, options);
  
  return freshData;
}

/**
 * Invalidate project-related caches
 */
export async function invalidateProjectCache(projectId: string): Promise<void> {
  await Promise.all([
    deleteCached(buildCacheKey(CacheKeys.PROJECT, projectId)),
    deleteCached(CacheKeys.PROJECT_LIST),
    deleteCachedPattern(`${CacheKeys.SEO_TRAFFIC}:${projectId}:*`),
    deleteCachedPattern(`${CacheKeys.SEO_KEYWORDS}:${projectId}:*`),
    deleteCachedPattern(`${CacheKeys.SEO_HEALTH}:${projectId}:*`),
    deleteCachedPattern(`${CacheKeys.SEO_BACKLINKS}:${projectId}:*`),
    deleteCachedPattern(`${CacheKeys.SEO_KPI}:${projectId}:*`),
    deleteCachedPattern(`${CacheKeys.DASHBOARD_SUMMARY}:${projectId}:*`),
  ]);
}
