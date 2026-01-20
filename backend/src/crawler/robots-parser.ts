/**
 * Robots.txt Parser
 * 
 * Parse and check robots.txt rules
 */

import { RobotsTxt, RobotsRules } from './types';

export class RobotsTxtParser {
  private rules: RobotsTxt;
  private fetched: boolean = false;
  
  constructor() {
    this.rules = {
      userAgents: new Map(),
      sitemaps: [],
    };
  }
  
  /**
   * Fetch and parse robots.txt from a domain
   */
  async fetch(baseUrl: string): Promise<void> {
    try {
      const url = new URL('/robots.txt', baseUrl);
      const response = await fetch(url.href, {
        headers: {
          'User-Agent': 'VIB-SEO-Crawler/1.0',
        },
      });
      
      if (response.ok) {
        const text = await response.text();
        this.parse(text);
      }
      
      this.fetched = true;
    } catch (error) {
      console.error('Failed to fetch robots.txt:', error);
      this.fetched = true; // Mark as fetched even on error
    }
  }
  
  /**
   * Parse robots.txt content
   */
  parse(content: string): void {
    const lines = content.split('\n');
    let currentUserAgent: string | null = null;
    let currentRules: RobotsRules = { allow: [], disallow: [] };
    
    for (const rawLine of lines) {
      const line = rawLine.trim();
      
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;
      
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const directive = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      
      switch (directive) {
        case 'user-agent':
          // Save previous user agent rules
          if (currentUserAgent) {
            this.rules.userAgents.set(currentUserAgent, currentRules);
          }
          currentUserAgent = value.toLowerCase();
          currentRules = this.rules.userAgents.get(currentUserAgent) || { allow: [], disallow: [] };
          break;
          
        case 'allow':
          if (currentUserAgent && value) {
            currentRules.allow.push(value);
          }
          break;
          
        case 'disallow':
          if (currentUserAgent && value) {
            currentRules.disallow.push(value);
          }
          break;
          
        case 'sitemap':
          if (value) {
            this.rules.sitemaps.push(value);
          }
          break;
          
        case 'crawl-delay':
          const delay = parseInt(value);
          if (!isNaN(delay)) {
            this.rules.crawlDelay = delay * 1000; // Convert to ms
          }
          break;
      }
    }
    
    // Save last user agent rules
    if (currentUserAgent) {
      this.rules.userAgents.set(currentUserAgent, currentRules);
    }
  }
  
  /**
   * Check if a URL is allowed to be crawled
   */
  isAllowed(url: string, userAgent: string = '*'): boolean {
    if (!this.fetched) {
      return true; // Allow if not fetched yet
    }
    
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname + parsedUrl.search;
      
      // Check specific user agent first, then wildcard
      const agents = [userAgent.toLowerCase(), '*'];
      
      for (const agent of agents) {
        const rules = this.rules.userAgents.get(agent);
        if (rules) {
          // Check allow rules first (they have priority)
          for (const pattern of rules.allow) {
            if (this.matchPath(path, pattern)) {
              return true;
            }
          }
          
          // Check disallow rules
          for (const pattern of rules.disallow) {
            if (this.matchPath(path, pattern)) {
              return false;
            }
          }
        }
      }
      
      return true; // Allow if no matching rules
    } catch {
      return true;
    }
  }
  
  /**
   * Match path against robots.txt pattern
   */
  private matchPath(path: string, pattern: string): boolean {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regex = pattern
        .replace(/\*/g, '.*')
        .replace(/\$/g, '$');
      return new RegExp(`^${regex}`).test(path);
    }
    
    // Handle end anchor
    if (pattern.endsWith('$')) {
      return path === pattern.slice(0, -1);
    }
    
    // Simple prefix match
    return path.startsWith(pattern);
  }
  
  /**
   * Get crawl delay in ms
   */
  getCrawlDelay(): number | undefined {
    return this.rules.crawlDelay;
  }
  
  /**
   * Get sitemap URLs
   */
  getSitemaps(): string[] {
    return this.rules.sitemaps;
  }
  
  /**
   * Check if robots.txt has been fetched
   */
  isFetched(): boolean {
    return this.fetched;
  }
}
