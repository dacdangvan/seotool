/**
 * URL Frontier
 * 
 * Manages the crawl queue with:
 * - URL normalization
 * - Deduplication
 * - Priority management
 * - Source tracking (sitemap vs discovered)
 */

export type UrlSource = 'sitemap' | 'discovered' | 'seed';

export interface FrontierUrl {
  url: string;
  normalizedUrl: string;
  source: UrlSource;
  depth: number;
  priority: number;
  discoveredAt: Date;
  parentUrl?: string;
}

export interface FrontierStats {
  totalDiscovered: number;
  totalQueued: number;
  totalProcessed: number;
  totalSkipped: number;
  bySources: Record<UrlSource, number>;
}

export interface UrlNormalizationOptions {
  /** Remove these query params */
  removeParams?: string[];
  /** Keep these query params (if set, removes all others) */
  keepParams?: string[];
  /** Remove trailing slash */
  removeTrailingSlash?: boolean;
  /** Convert to lowercase */
  lowercasePath?: boolean;
  /** Remove fragment/hash */
  removeFragment?: boolean;
  /** Remove default ports (80, 443) */
  removeDefaultPort?: boolean;
}

const DEFAULT_NORMALIZATION: UrlNormalizationOptions = {
  removeParams: [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
    '_ga', '_gl', 'ref', 'source', 'track', 'tracking_id',
  ],
  removeTrailingSlash: false, // Keep trailing slashes - important for SEO
  lowercasePath: false, // Keep case - /vi/ paths matter
  removeFragment: true,
  removeDefaultPort: true,
};

export class UrlFrontier {
  private queue: FrontierUrl[] = [];
  private seen = new Set<string>();
  private processed = new Set<string>();
  private skipped = new Set<string>();
  private domain: string;
  private normalizationOptions: UrlNormalizationOptions;
  private stats: FrontierStats;

  // Patterns to skip
  private skipPatterns: RegExp[] = [
    /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|zip|rar|exe|doc|docx|xls|xlsx|ppt|pptx)$/i,
    /\/(login|logout|signin|signout|register|signup|auth|oauth|api|admin|wp-admin|cgi-bin)\//i,
    /\?(.*&)?(action|do|submit|download|print)=/i,
    /^(javascript|mailto|tel|data):/i,
    /#.*/,
  ];

  // Patterns that must be private/blocked
  private privatePatterns: RegExp[] = [
    /\/my-?account/i,
    /\/cart/i,
    /\/checkout/i,
    /\/order/i,
    /\/profile/i,
    /\/settings/i,
    /\/dashboard/i,
    /\/admin/i,
    /\/(login|signin|auth)/i,
  ];

  constructor(
    domain: string,
    options: Partial<UrlNormalizationOptions> = {}
  ) {
    this.domain = domain.toLowerCase().replace(/^www\./, '');
    this.normalizationOptions = { ...DEFAULT_NORMALIZATION, ...options };
    this.stats = {
      totalDiscovered: 0,
      totalQueued: 0,
      totalProcessed: 0,
      totalSkipped: 0,
      bySources: { sitemap: 0, discovered: 0, seed: 0 },
    };
  }

  /**
   * Add URLs from sitemap (high priority)
   */
  addFromSitemap(urls: Array<{ loc: string; priority?: number }>): number {
    let added = 0;
    for (const item of urls) {
      if (this.addUrl(item.loc, 'sitemap', 0, undefined, item.priority ?? 0.5)) {
        added++;
      }
    }
    console.log(`[UrlFrontier] Added ${added}/${urls.length} URLs from sitemap`);
    return added;
  }

  /**
   * Add seed URL (starting point)
   */
  addSeed(url: string): boolean {
    return this.addUrl(url, 'seed', 0, undefined, 1.0);
  }

  /**
   * Add discovered URL from crawling
   */
  addDiscovered(url: string, depth: number, parentUrl: string): boolean {
    // Lower priority for deeper pages
    const priority = Math.max(0.1, 0.8 - (depth * 0.1));
    return this.addUrl(url, 'discovered', depth, parentUrl, priority);
  }

  /**
   * Add a URL to the frontier
   */
  private addUrl(
    url: string,
    source: UrlSource,
    depth: number,
    parentUrl?: string,
    priority: number = 0.5
  ): boolean {
    this.stats.totalDiscovered++;

    // Validate and normalize URL
    const normalized = this.normalizeUrl(url);
    if (!normalized) {
      this.stats.totalSkipped++;
      return false;
    }

    // Check if already seen
    if (this.seen.has(normalized)) {
      return false;
    }

    // Check if should skip
    if (this.shouldSkip(url)) {
      this.skipped.add(normalized);
      this.stats.totalSkipped++;
      return false;
    }

    // Check if same domain
    if (!this.isSameDomain(url)) {
      this.stats.totalSkipped++;
      return false;
    }

    // Check if private/blocked
    if (this.isPrivatePath(url)) {
      this.skipped.add(normalized);
      this.stats.totalSkipped++;
      return false;
    }

    // Add to frontier
    this.seen.add(normalized);
    this.queue.push({
      url,
      normalizedUrl: normalized,
      source,
      depth,
      priority,
      discoveredAt: new Date(),
      parentUrl,
    });

    this.stats.totalQueued++;
    this.stats.bySources[source]++;

    return true;
  }

  /**
   * Get next URL to crawl (highest priority first)
   */
  getNext(): FrontierUrl | null {
    if (this.queue.length === 0) return null;

    // Sort by priority (desc) then by depth (asc)
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.depth - b.depth;
    });

    const next = this.queue.shift()!;
    this.processed.add(next.normalizedUrl);
    this.stats.totalProcessed++;

    return next;
  }

  /**
   * Check if frontier has more URLs
   */
  hasMore(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if URL was already processed
   */
  isProcessed(url: string): boolean {
    const normalized = this.normalizeUrl(url);
    return normalized ? this.processed.has(normalized) : false;
  }

  /**
   * Mark URL as processed (without actually crawling)
   */
  markProcessed(url: string): void {
    const normalized = this.normalizeUrl(url);
    if (normalized) {
      this.processed.add(normalized);
      this.stats.totalProcessed++;
    }
  }

  /**
   * Get frontier statistics
   */
  getStats(): FrontierStats {
    return { ...this.stats };
  }

  /**
   * Normalize URL
   */
  normalizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      // Must be HTTP(S)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }

      // Remove fragment
      if (this.normalizationOptions.removeFragment) {
        parsed.hash = '';
      }

      // Remove default ports
      if (this.normalizationOptions.removeDefaultPort) {
        if (
          (parsed.protocol === 'https:' && parsed.port === '443') ||
          (parsed.protocol === 'http:' && parsed.port === '80')
        ) {
          parsed.port = '';
        }
      }

      // Handle query params
      if (this.normalizationOptions.removeParams) {
        for (const param of this.normalizationOptions.removeParams) {
          parsed.searchParams.delete(param);
        }
      }

      if (this.normalizationOptions.keepParams) {
        const keepers = new Set(this.normalizationOptions.keepParams);
        const toDelete: string[] = [];
        parsed.searchParams.forEach((_, key) => {
          if (!keepers.has(key)) toDelete.push(key);
        });
        toDelete.forEach(key => parsed.searchParams.delete(key));
      }

      // Sort query params for consistent comparison
      parsed.searchParams.sort();

      // Build normalized URL
      let path = parsed.pathname;
      
      // Optional: lowercase path (disabled by default to preserve /vi/ etc)
      if (this.normalizationOptions.lowercasePath) {
        path = path.toLowerCase();
      }

      // Optional: remove trailing slash
      if (this.normalizationOptions.removeTrailingSlash && path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }

      // Reconstruct URL
      let normalized = `${parsed.protocol}//${parsed.host}${path}`;
      const search = parsed.searchParams.toString();
      if (search) {
        normalized += `?${search}`;
      }

      return normalized;
    } catch {
      return null;
    }
  }

  /**
   * Check if URL should be skipped
   */
  private shouldSkip(url: string): boolean {
    for (const pattern of this.skipPatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if URL is a private path
   */
  private isPrivatePath(url: string): boolean {
    try {
      const parsed = new URL(url);
      for (const pattern of this.privatePatterns) {
        if (pattern.test(parsed.pathname)) {
          return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Check if URL belongs to the same domain
   */
  private isSameDomain(url: string): boolean {
    try {
      const parsed = new URL(url);
      const urlDomain = parsed.hostname.toLowerCase().replace(/^www\./, '');
      return urlDomain === this.domain || urlDomain.endsWith(`.${this.domain}`);
    } catch {
      return false;
    }
  }

  /**
   * Get all discovered URLs (for reporting)
   */
  getAllDiscoveredUrls(): string[] {
    return Array.from(this.seen);
  }

  /**
   * Get all processed URLs
   */
  getAllProcessedUrls(): string[] {
    return Array.from(this.processed);
  }

  /**
   * Reset the frontier
   */
  reset(): void {
    this.queue = [];
    this.seen.clear();
    this.processed.clear();
    this.skipped.clear();
    this.stats = {
      totalDiscovered: 0,
      totalQueued: 0,
      totalProcessed: 0,
      totalSkipped: 0,
      bySources: { sitemap: 0, discovered: 0, seed: 0 },
    };
  }
}

export default UrlFrontier;
