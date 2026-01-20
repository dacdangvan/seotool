/**
 * URL Inventory Store
 * 
 * Manages the URL inventory per § 11.4:
 * - Track URL lifecycle states
 * - Deduplication
 * - State transitions
 * - Query by state/source
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6 Section 11
 */

import {
  UrlInventoryEntry,
  UrlInventoryState,
  UrlDiscoverySource,
  UrlDiscoveryStats,
  UrlDiscoveryPhase
} from './types';

/**
 * § 11.4 URL Inventory Store Interface
 */
export interface IUrlInventoryStore {
  /** Add URL to inventory */
  add(entry: Omit<UrlInventoryEntry, 'discoveredAt' | 'updatedAt' | 'crawlAttempts' | 'lastCrawledAt' | 'errorMessage' | 'renderMode' | 'statusCode' | 'blockReason'>): UrlInventoryEntry | null;
  
  /** Update URL state */
  updateState(normalizedUrl: string, state: UrlInventoryState, details?: Partial<UrlInventoryEntry>): boolean;
  
  /** Get URL by normalized URL */
  get(normalizedUrl: string): UrlInventoryEntry | null;
  
  /** Check if URL exists */
  has(normalizedUrl: string): boolean;
  
  /** Get all URLs by state */
  getByState(state: UrlInventoryState): UrlInventoryEntry[];
  
  /** Get all URLs by source */
  getBySource(source: UrlDiscoverySource): UrlInventoryEntry[];
  
  /** Get next URL to crawl (QUEUED_FOR_CRAWL, ordered by priority/depth) */
  getNextToCrawl(): UrlInventoryEntry | null;
  
  /** Get all URLs */
  getAll(): UrlInventoryEntry[];
  
  /** Get statistics */
  getStats(phase: UrlDiscoveryPhase, startedAt: Date): UrlDiscoveryStats;
  
  /** Clear all entries */
  clear(): void;
  
  /** Get count */
  count(): number;
}

/**
 * In-Memory URL Inventory Store
 * 
 * Fast implementation for single-run crawls.
 * For production persistence, implement a PostgreSQL-backed store.
 */
export class InMemoryUrlInventoryStore implements IUrlInventoryStore {
  private inventory = new Map<string, UrlInventoryEntry>();
  private stateIndex = new Map<UrlInventoryState, Set<string>>();
  private sourceIndex = new Map<UrlDiscoverySource, Set<string>>();
  private crawlQueue: string[] = [];

  constructor() {
    // Initialize state index
    const states: UrlInventoryState[] = [
      'DISCOVERED', 'QUEUED_FOR_CRAWL', 'CRAWLED', 'FAILED', 'BLOCKED_BY_POLICY'
    ];
    for (const state of states) {
      this.stateIndex.set(state, new Set());
    }

    // Initialize source index
    const sources: UrlDiscoverySource[] = [
      'HOMEPAGE', 'INTERNAL_LINK', 'SITEMAP', 'RENDERED_DOM', 'SEED'
    ];
    for (const source of sources) {
      this.sourceIndex.set(source, new Set());
    }
  }

  add(entry: Omit<UrlInventoryEntry, 'discoveredAt' | 'updatedAt' | 'crawlAttempts' | 'lastCrawledAt' | 'errorMessage' | 'renderMode' | 'statusCode' | 'blockReason'>): UrlInventoryEntry | null {
    // Deduplication check
    if (this.inventory.has(entry.normalizedUrl)) {
      return null; // Already exists
    }

    const now = new Date();
    const fullEntry: UrlInventoryEntry = {
      ...entry,
      discoveredAt: now,
      updatedAt: now,
      crawlAttempts: 0,
      lastCrawledAt: null,
      errorMessage: null,
      renderMode: null,
      statusCode: null,
      blockReason: null,
    };

    this.inventory.set(entry.normalizedUrl, fullEntry);
    
    // Update indexes
    this.stateIndex.get(entry.state)?.add(entry.normalizedUrl);
    this.sourceIndex.get(entry.source)?.add(entry.normalizedUrl);

    // Add to crawl queue if queued
    if (entry.state === 'QUEUED_FOR_CRAWL') {
      this.addToQueue(entry.normalizedUrl, entry.depth);
    }

    return fullEntry;
  }

  updateState(normalizedUrl: string, newState: UrlInventoryState, details?: Partial<UrlInventoryEntry>): boolean {
    const entry = this.inventory.get(normalizedUrl);
    if (!entry) return false;

    const oldState = entry.state;

    // Remove from old state index
    this.stateIndex.get(oldState)?.delete(normalizedUrl);
    
    // Update entry
    entry.state = newState;
    entry.updatedAt = new Date();
    
    if (details) {
      Object.assign(entry, details);
    }

    // Add to new state index
    this.stateIndex.get(newState)?.add(normalizedUrl);

    // Update crawl queue
    if (oldState === 'QUEUED_FOR_CRAWL' && newState !== 'QUEUED_FOR_CRAWL') {
      this.removeFromQueue(normalizedUrl);
    } else if (oldState !== 'QUEUED_FOR_CRAWL' && newState === 'QUEUED_FOR_CRAWL') {
      this.addToQueue(normalizedUrl, entry.depth);
    }

    return true;
  }

  get(normalizedUrl: string): UrlInventoryEntry | null {
    return this.inventory.get(normalizedUrl) || null;
  }

  has(normalizedUrl: string): boolean {
    return this.inventory.has(normalizedUrl);
  }

  getByState(state: UrlInventoryState): UrlInventoryEntry[] {
    const urls = this.stateIndex.get(state) || new Set();
    return Array.from(urls).map(url => this.inventory.get(url)!).filter(Boolean);
  }

  getBySource(source: UrlDiscoverySource): UrlInventoryEntry[] {
    const urls = this.sourceIndex.get(source) || new Set();
    return Array.from(urls).map(url => this.inventory.get(url)!).filter(Boolean);
  }

  getNextToCrawl(): UrlInventoryEntry | null {
    while (this.crawlQueue.length > 0) {
      const url = this.crawlQueue.shift()!;
      const entry = this.inventory.get(url);
      if (entry && entry.state === 'QUEUED_FOR_CRAWL') {
        return entry;
      }
    }
    return null;
  }

  getAll(): UrlInventoryEntry[] {
    return Array.from(this.inventory.values());
  }

  getStats(phase: UrlDiscoveryPhase, startedAt: Date): UrlDiscoveryStats {
    const byState: Record<UrlInventoryState, number> = {
      DISCOVERED: 0,
      QUEUED_FOR_CRAWL: 0,
      CRAWLED: 0,
      FAILED: 0,
      BLOCKED_BY_POLICY: 0,
    };

    const bySource: Record<UrlDiscoverySource, number> = {
      HOMEPAGE: 0,
      INTERNAL_LINK: 0,
      SITEMAP: 0,
      RENDERED_DOM: 0,
      SEED: 0,
    };

    let maxDepth = 0;
    let errorCount = 0;

    for (const entry of this.inventory.values()) {
      byState[entry.state]++;
      bySource[entry.source]++;
      if (entry.depth > maxDepth) maxDepth = entry.depth;
      if (entry.state === 'FAILED') errorCount++;
    }

    const totalDiscovered = this.inventory.size;
    const crawled = byState.CRAWLED;
    const crawlCoverage = totalDiscovered > 0 ? (crawled / totalDiscovered) * 100 : 0;

    return {
      totalDiscovered,
      byState,
      bySource,
      crawlCoverage,
      maxDepthReached: maxDepth,
      startedAt,
      completedAt: phase === 'COMPLETED' ? new Date() : null,
      phase,
      errorCount,
    };
  }

  clear(): void {
    this.inventory.clear();
    for (const set of this.stateIndex.values()) set.clear();
    for (const set of this.sourceIndex.values()) set.clear();
    this.crawlQueue = [];
  }

  count(): number {
    return this.inventory.size;
  }

  /**
   * Add URL to crawl queue (sorted by depth - BFS)
   */
  private addToQueue(url: string, depth: number): void {
    // Find insertion point to maintain depth order (BFS)
    let insertAt = this.crawlQueue.length;
    for (let i = 0; i < this.crawlQueue.length; i++) {
      const existingEntry = this.inventory.get(this.crawlQueue[i]);
      if (existingEntry && existingEntry.depth > depth) {
        insertAt = i;
        break;
      }
    }
    this.crawlQueue.splice(insertAt, 0, url);
  }

  /**
   * Remove URL from crawl queue
   */
  private removeFromQueue(url: string): void {
    const index = this.crawlQueue.indexOf(url);
    if (index !== -1) {
      this.crawlQueue.splice(index, 1);
    }
  }

  /**
   * Queue all DISCOVERED URLs for crawl
   */
  queueAllDiscovered(): number {
    let queued = 0;
    for (const url of this.stateIndex.get('DISCOVERED') || []) {
      if (this.updateState(url, 'QUEUED_FOR_CRAWL')) {
        queued++;
      }
    }
    return queued;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.crawlQueue.length;
  }
}

export const createUrlInventoryStore = (): IUrlInventoryStore => {
  return new InMemoryUrlInventoryStore();
};
