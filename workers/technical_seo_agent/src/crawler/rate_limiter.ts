/**
 * Rate Limiter
 * Controls request rate for polite crawling
 */

import pLimit from 'p-limit';

export interface RateLimiter {
  /**
   * Execute a function with rate limiting
   */
  execute<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Wait for the configured delay before next request
   */
  delay(): Promise<void>;
}

/**
 * Create a rate limiter with concurrent request limiting and delay between requests
 */
export function createRateLimiter(
  delayMs: number,
  maxConcurrent = 1
): RateLimiter {
  const limiter = pLimit(maxConcurrent);
  let lastRequestTime = 0;

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return limiter(async () => {
        await this.delay();
        const result = await fn();
        lastRequestTime = Date.now();
        return result;
      });
    },

    async delay(): Promise<void> {
      const elapsed = Date.now() - lastRequestTime;
      const waitTime = Math.max(0, delayMs - elapsed);
      if (waitTime > 0) {
        await sleep(waitTime);
      }
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
