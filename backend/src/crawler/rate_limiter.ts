/**
 * Rate Limiter
 * 
 * SEO-safe Web Crawler - Rate limiting & backoff
 * Ensures respectful crawling with proper delays
 */

export interface RateLimiterConfig {
  /** Minimum delay between requests in ms (default: 1000) */
  minDelay: number;
  
  /** Maximum delay for backoff in ms (default: 30000) */
  maxDelay: number;
  
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  
  /** Reset backoff after successful requests (default: 3) */
  resetAfterSuccesses: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  minDelay: 1000, // 1 second minimum
  maxDelay: 30000, // 30 seconds max
  backoffMultiplier: 2,
  resetAfterSuccesses: 3,
};

export class RateLimiter {
  private config: RateLimiterConfig;
  private currentDelay: number;
  private lastRequestTime: number = 0;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private totalRequests: number = 0;
  private totalWaitTime: number = 0;
  
  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentDelay = this.config.minDelay;
  }
  
  /**
   * Wait before making the next request
   * Call this BEFORE each fetch
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.currentDelay - timeSinceLastRequest);
    
    if (waitTime > 0) {
      console.log(`[RateLimiter] Waiting ${waitTime}ms before next request`);
      await this.sleep(waitTime);
      this.totalWaitTime += waitTime;
    }
    
    this.lastRequestTime = Date.now();
    this.totalRequests++;
  }
  
  /**
   * Report a successful request
   * May decrease delay after consecutive successes
   */
  reportSuccess(): void {
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    
    // Gradually reduce delay after consistent successes
    if (this.consecutiveSuccesses >= this.config.resetAfterSuccesses) {
      const newDelay = Math.max(
        this.config.minDelay,
        Math.floor(this.currentDelay / this.config.backoffMultiplier)
      );
      
      if (newDelay < this.currentDelay) {
        console.log(`[RateLimiter] Reducing delay to ${newDelay}ms after ${this.consecutiveSuccesses} successes`);
        this.currentDelay = newDelay;
      }
    }
  }
  
  /**
   * Report a failed request (4xx, 5xx, timeout)
   * Increases delay using exponential backoff
   */
  reportFailure(statusCode?: number): void {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    
    // Apply backoff
    const newDelay = Math.min(
      this.config.maxDelay,
      this.currentDelay * this.config.backoffMultiplier
    );
    
    console.log(`[RateLimiter] Increasing delay to ${newDelay}ms after failure (status: ${statusCode || 'unknown'})`);
    this.currentDelay = newDelay;
    
    // Extra delay for rate limiting (429) or server errors (5xx)
    if (statusCode === 429) {
      this.currentDelay = Math.min(this.config.maxDelay, this.currentDelay * 2);
      console.log(`[RateLimiter] Rate limited (429)! Extra delay: ${this.currentDelay}ms`);
    } else if (statusCode && statusCode >= 500) {
      this.currentDelay = Math.min(this.config.maxDelay, this.currentDelay * 1.5);
      console.log(`[RateLimiter] Server error (${statusCode})! Increased delay: ${this.currentDelay}ms`);
    }
  }
  
  /**
   * Set delay from robots.txt crawl-delay directive
   */
  setMinDelayFromRobots(delay: number): void {
    if (delay > this.config.minDelay) {
      console.log(`[RateLimiter] Setting min delay from robots.txt: ${delay}ms`);
      this.config.minDelay = delay;
      this.currentDelay = Math.max(this.currentDelay, delay);
    }
  }
  
  /**
   * Get current delay
   */
  getCurrentDelay(): number {
    return this.currentDelay;
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    totalRequests: number;
    totalWaitTime: number;
    currentDelay: number;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
  } {
    return {
      totalRequests: this.totalRequests,
      totalWaitTime: this.totalWaitTime,
      currentDelay: this.currentDelay,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
  
  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.currentDelay = this.config.minDelay;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.lastRequestTime = 0;
    this.totalRequests = 0;
    this.totalWaitTime = 0;
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
