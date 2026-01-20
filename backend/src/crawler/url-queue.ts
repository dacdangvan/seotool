/**
 * URL Queue
 * 
 * Manages the queue of URLs to crawl with deduplication
 */

export interface QueuedUrl {
  url: string;
  depth: number;
  priority: number;
  addedAt: Date;
}

export class UrlQueue {
  private queue: QueuedUrl[] = [];
  private seen: Set<string> = new Set();
  private baseUrl: URL;
  private includePatterns: RegExp[] = [];
  private excludePatterns: RegExp[] = [];
  private sameDomainOnly: boolean;
  
  constructor(
    baseUrl: string,
    options: {
      includePatterns?: string[];
      excludePatterns?: string[];
      sameDomainOnly?: boolean;
    } = {}
  ) {
    this.baseUrl = new URL(baseUrl);
    this.sameDomainOnly = options.sameDomainOnly ?? true;
    
    if (options.includePatterns) {
      this.includePatterns = options.includePatterns.map(p => new RegExp(p));
    }
    
    if (options.excludePatterns) {
      this.excludePatterns = options.excludePatterns.map(p => new RegExp(p));
    }
    
    // Default exclude patterns for non-content URLs
    this.excludePatterns.push(
      /\.(jpg|jpeg|png|gif|svg|webp|ico|bmp)$/i,
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
      /\.(zip|rar|tar|gz)$/i,
      /\.(css|js|json|xml)$/i,
      /\.(mp3|mp4|wav|avi|mov)$/i,
      /\?(.*&)?utm_/i, // UTM parameters
      /#.*/i, // Fragments
    );
  }
  
  /**
   * Add a URL to the queue
   */
  add(url: string, depth: number, priority: number = 0): boolean {
    const normalized = this.normalizeUrl(url);
    if (!normalized) return false;
    
    // Check if already seen
    if (this.seen.has(normalized)) {
      return false;
    }
    
    // Check domain restriction
    if (this.sameDomainOnly) {
      try {
        const parsedUrl = new URL(normalized);
        if (parsedUrl.hostname !== this.baseUrl.hostname) {
          return false;
        }
      } catch {
        return false;
      }
    }
    
    // Check include patterns
    if (this.includePatterns.length > 0) {
      const matches = this.includePatterns.some(p => p.test(normalized));
      if (!matches) return false;
    }
    
    // Check exclude patterns
    if (this.excludePatterns.some(p => p.test(normalized))) {
      return false;
    }
    
    // Mark as seen and add to queue
    this.seen.add(normalized);
    this.queue.push({
      url: normalized,
      depth,
      priority,
      addedAt: new Date(),
    });
    
    // Sort by priority (higher first) and depth (lower first)
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.depth - b.depth;
    });
    
    return true;
  }
  
  /**
   * Get next URL to crawl
   */
  next(): QueuedUrl | undefined {
    return this.queue.shift();
  }
  
  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
  
  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }
  
  /**
   * Get total URLs seen
   */
  totalSeen(): number {
    return this.seen.size;
  }
  
  /**
   * Check if URL was already seen
   */
  hasSeen(url: string): boolean {
    const normalized = this.normalizeUrl(url);
    return normalized ? this.seen.has(normalized) : false;
  }
  
  /**
   * Normalize URL for deduplication
   */
  private normalizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url, this.baseUrl.href);
      
      // Remove trailing slash
      let path = parsed.pathname;
      if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      
      // Sort query parameters
      const params = new URLSearchParams(parsed.search);
      const sortedParams = new URLSearchParams();
      [...params.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([key, value]) => sortedParams.set(key, value));
      
      // Remove common tracking parameters
      sortedParams.delete('utm_source');
      sortedParams.delete('utm_medium');
      sortedParams.delete('utm_campaign');
      sortedParams.delete('utm_term');
      sortedParams.delete('utm_content');
      sortedParams.delete('fbclid');
      sortedParams.delete('gclid');
      sortedParams.delete('ref');
      
      const search = sortedParams.toString();
      return parsed.origin + path + (search ? '?' + search : '');
    } catch {
      return null;
    }
  }
  
  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.seen.clear();
  }
}
