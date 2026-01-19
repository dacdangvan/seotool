/**
 * Integration Tests for Rate Limiter
 */

import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../src/crawler/rate_limiter';

describe('RateLimiter', () => {
  it('respects delay between requests', async () => {
    const delayMs = 100;
    const limiter = createRateLimiter(delayMs);
    
    const start = Date.now();
    
    await limiter.execute(async () => 'first');
    await limiter.execute(async () => 'second');
    
    const elapsed = Date.now() - start;
    
    // Should take at least delayMs between requests
    expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10); // Small tolerance
  });

  it('returns results from executed functions', async () => {
    const limiter = createRateLimiter(10);
    
    const result = await limiter.execute(async () => {
      return { data: 'test' };
    });
    
    expect(result).toEqual({ data: 'test' });
  });

  it('handles errors gracefully', async () => {
    const limiter = createRateLimiter(10);
    
    await expect(
      limiter.execute(async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });
});
