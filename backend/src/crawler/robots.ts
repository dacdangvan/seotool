/**
 * Robots.txt Parser
 * 
 * SEO-safe Web Crawler - Robots.txt handling
 * MANDATORY: Always respect robots.txt directives
 */

import { RobotsTxtData, RobotsRules } from './models';

export class RobotsParser {
  private data: RobotsTxtData | null = null;
  private baseUrl: URL;
  
  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl);
  }
  
  /**
   * Fetch and parse robots.txt from the target domain
   * This MUST be called before any crawling begins
   */
  async fetch(userAgent: string): Promise<RobotsTxtData> {
    const robotsUrl = new URL('/robots.txt', this.baseUrl.origin);
    
    console.log(`[Robots] Fetching robots.txt from ${robotsUrl.href}`);
    
    try {
      const response = await fetch(robotsUrl.href, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/plain',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        const content = await response.text();
        this.data = this.parse(content);
        console.log(`[Robots] Successfully parsed robots.txt`);
        console.log(`[Robots] Found ${this.data.sitemaps.length} sitemaps`);
        console.log(`[Robots] Crawl delay: ${this.data.crawlDelay || 'not specified'}ms`);
      } else if (response.status === 404) {
        // No robots.txt = allow all (but still be respectful)
        console.log(`[Robots] No robots.txt found (404) - will crawl respectfully`);
        this.data = this.createEmptyRobotsTxt();
      } else {
        console.warn(`[Robots] Unexpected status ${response.status} - treating as restrictive`);
        this.data = this.createRestrictiveRobotsTxt();
      }
    } catch (error) {
      console.error(`[Robots] Failed to fetch robots.txt:`, error);
      // On error, be conservative and create restrictive rules
      this.data = this.createRestrictiveRobotsTxt();
    }
    
    return this.data;
  }
  
  /**
   * Parse robots.txt content
   */
  private parse(content: string): RobotsTxtData {
    const data: RobotsTxtData = {
      userAgents: new Map(),
      sitemaps: [],
      fetchedAt: new Date(),
      rawContent: content,
    };
    
    const lines = content.split('\n');
    let currentUserAgent: string | null = null;
    let currentRules: RobotsRules = { allow: [], disallow: [] };
    
    for (const rawLine of lines) {
      const line = rawLine.trim();
      
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;
      
      // Parse directive
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const directive = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      
      switch (directive) {
        case 'user-agent':
          // Save previous user agent rules
          if (currentUserAgent) {
            const existingRules = data.userAgents.get(currentUserAgent);
            if (existingRules) {
              existingRules.allow.push(...currentRules.allow);
              existingRules.disallow.push(...currentRules.disallow);
            } else {
              data.userAgents.set(currentUserAgent, { ...currentRules });
            }
          }
          currentUserAgent = value.toLowerCase();
          currentRules = data.userAgents.get(currentUserAgent) || { allow: [], disallow: [] };
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
          if (value && this.isValidUrl(value)) {
            data.sitemaps.push(value);
          }
          break;
          
        case 'crawl-delay':
          const delay = parseFloat(value);
          if (!isNaN(delay) && delay > 0) {
            // Convert to ms, enforce minimum of 1 second
            data.crawlDelay = Math.max(delay * 1000, 1000);
          }
          break;
      }
    }
    
    // Save last user agent rules
    if (currentUserAgent) {
      const existingRules = data.userAgents.get(currentUserAgent);
      if (existingRules) {
        existingRules.allow.push(...currentRules.allow);
        existingRules.disallow.push(...currentRules.disallow);
      } else {
        data.userAgents.set(currentUserAgent, currentRules);
      }
    }
    
    return data;
  }
  
  /**
   * Check if a URL is allowed to be crawled
   * MANDATORY: This check must pass before fetching any URL
   */
  isAllowed(url: string, userAgent: string = '*'): boolean {
    if (!this.data) {
      console.warn(`[Robots] robots.txt not fetched yet - blocking URL: ${url}`);
      return false; // Block until robots.txt is fetched
    }
    
    try {
      const parsedUrl = new URL(url);
      
      // Only check URLs on the same domain
      if (parsedUrl.hostname !== this.baseUrl.hostname) {
        return false;
      }
      
      const path = parsedUrl.pathname + parsedUrl.search;
      
      // Check rules in order: specific user agent first, then wildcard
      const agentsToCheck = [
        userAgent.toLowerCase(),
        'seo-audit-bot',
        '*'
      ];
      
      for (const agent of agentsToCheck) {
        const rules = this.data.userAgents.get(agent);
        if (rules) {
          // Check allow rules first (they have priority over disallow)
          for (const pattern of rules.allow) {
            if (this.matchPath(path, pattern)) {
              return true;
            }
          }
          
          // Check disallow rules
          for (const pattern of rules.disallow) {
            if (this.matchPath(path, pattern)) {
              console.log(`[Robots] Blocked by robots.txt: ${url} (rule: ${pattern})`);
              return false;
            }
          }
        }
      }
      
      return true; // Allow if no matching rules
      
    } catch (error) {
      console.error(`[Robots] Error checking URL: ${url}`, error);
      return false; // Block on error
    }
  }
  
  /**
   * Match path against robots.txt pattern
   */
  private matchPath(path: string, pattern: string): boolean {
    if (!pattern) return false;
    
    // Empty pattern matches nothing
    if (pattern === '') return false;
    
    // Convert robots.txt pattern to regex
    let regexPattern = pattern
      // Escape special regex chars except * and $
      .replace(/[.+?^{}()|[\]\\]/g, '\\$&')
      // Convert * to .*
      .replace(/\*/g, '.*')
      // Handle $ anchor at end
      .replace(/\\\$$/, '$');
    
    // If pattern doesn't end with $, it's a prefix match
    if (!pattern.endsWith('$')) {
      regexPattern = `^${regexPattern}`;
    } else {
      regexPattern = `^${regexPattern}`;
    }
    
    try {
      const regex = new RegExp(regexPattern, 'i');
      return regex.test(path);
    } catch {
      // Fall back to simple prefix match
      return path.startsWith(pattern.replace(/\*.*$/, ''));
    }
  }
  
  /**
   * Get crawl delay in ms (minimum 1000ms enforced)
   */
  getCrawlDelay(): number {
    const delay = this.data?.crawlDelay;
    // Enforce minimum 1 second delay for safety
    return delay ? Math.max(delay, 1000) : 1000;
  }
  
  /**
   * Get sitemap URLs
   */
  getSitemaps(): string[] {
    return this.data?.sitemaps || [];
  }
  
  /**
   * Check if robots.txt has been fetched
   */
  isFetched(): boolean {
    return this.data !== null;
  }
  
  /**
   * Get raw robots.txt data
   */
  getData(): RobotsTxtData | null {
    return this.data;
  }
  
  /**
   * Create empty robots.txt (allow all)
   */
  private createEmptyRobotsTxt(): RobotsTxtData {
    return {
      userAgents: new Map(),
      sitemaps: [],
      fetchedAt: new Date(),
    };
  }
  
  /**
   * Create restrictive robots.txt (on error, be safe)
   */
  private createRestrictiveRobotsTxt(): RobotsTxtData {
    const rules: RobotsRules = {
      allow: ['/'],
      disallow: [
        '/admin',
        '/login',
        '/logout',
        '/account',
        '/profile',
        '/api/',
        '/private/',
        '/*?*session',
        '/*?*token',
      ],
    };
    
    return {
      userAgents: new Map([['*', rules]]),
      sitemaps: [],
      fetchedAt: new Date(),
    };
  }
  
  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
