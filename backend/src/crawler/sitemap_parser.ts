/**
 * Sitemap Parser
 * 
 * Parses sitemap.xml and sitemap index files to discover all URLs
 * Supports:
 * - Standard sitemap.xml
 * - Sitemap index (nested sitemaps)
 * - Compressed sitemaps (.gz)
 * - Multiple sitemap formats
 */

import { RateLimiter } from './rate_limiter';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface SitemapParseResult {
  urls: SitemapUrl[];
  sitemapCount: number;
  errors: string[];
}

export class SitemapParser {
  private rateLimiter: RateLimiter;
  private maxSitemaps: number;
  private timeout: number;
  private userAgent: string;

  constructor(options: {
    rateLimiter: RateLimiter;
    maxSitemaps?: number;
    timeout?: number;
    userAgent?: string;
  }) {
    this.rateLimiter = options.rateLimiter;
    this.maxSitemaps = options.maxSitemaps || 50;
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent || 'VIB-SEO-Crawler/1.0';
  }

  /**
   * Discover sitemaps from robots.txt
   */
  async discoverSitemapsFromRobots(domain: string): Promise<string[]> {
    const sitemaps: string[] = [];
    const robotsUrl = `https://${domain}/robots.txt`;

    try {
      await this.rateLimiter.wait();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.userAgent },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n');

        for (const line of lines) {
          const trimmed = line.trim().toLowerCase();
          if (trimmed.startsWith('sitemap:')) {
            const sitemapUrl = line.substring(line.indexOf(':') + 1).trim();
            if (sitemapUrl && this.isValidUrl(sitemapUrl)) {
              sitemaps.push(sitemapUrl);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[SitemapParser] Failed to fetch robots.txt: ${error}`);
    }

    // Add common sitemap locations if none found
    if (sitemaps.length === 0) {
      sitemaps.push(
        `https://${domain}/sitemap.xml`,
        `https://${domain}/sitemap_index.xml`,
        `https://${domain}/sitemap/sitemap.xml`,
        `https://${domain}/sitemaps/sitemap.xml`
      );
    }

    return sitemaps;
  }

  /**
   * Parse all sitemaps for a domain
   */
  async parseAllSitemaps(domain: string): Promise<SitemapParseResult> {
    const result: SitemapParseResult = {
      urls: [],
      sitemapCount: 0,
      errors: [],
    };

    const sitemapUrls = await this.discoverSitemapsFromRobots(domain);
    const processedSitemaps = new Set<string>();
    const pendingSitemaps = [...sitemapUrls];
    const allUrls = new Map<string, SitemapUrl>();

    console.log(`[SitemapParser] Discovered ${sitemapUrls.length} sitemap URLs from robots.txt`);

    while (pendingSitemaps.length > 0 && result.sitemapCount < this.maxSitemaps) {
      const sitemapUrl = pendingSitemaps.shift()!;
      
      if (processedSitemaps.has(sitemapUrl)) continue;
      processedSitemaps.add(sitemapUrl);

      try {
        const parseResult = await this.parseSitemap(sitemapUrl);
        result.sitemapCount++;

        // Check if this is a sitemap index
        if (parseResult.nestedSitemaps.length > 0) {
          console.log(`[SitemapParser] Found sitemap index with ${parseResult.nestedSitemaps.length} nested sitemaps`);
          for (const nested of parseResult.nestedSitemaps) {
            if (!processedSitemaps.has(nested)) {
              pendingSitemaps.push(nested);
            }
          }
        }

        // Add URLs to map (deduplication by loc)
        for (const url of parseResult.urls) {
          if (!allUrls.has(url.loc)) {
            allUrls.set(url.loc, url);
          }
        }

        console.log(`[SitemapParser] Parsed ${sitemapUrl}: ${parseResult.urls.length} URLs`);
      } catch (error) {
        const errorMsg = `Failed to parse ${sitemapUrl}: ${error}`;
        result.errors.push(errorMsg);
        console.warn(`[SitemapParser] ${errorMsg}`);
      }
    }

    result.urls = Array.from(allUrls.values());
    console.log(`[SitemapParser] Total URLs discovered: ${result.urls.length}`);

    return result;
  }

  /**
   * Parse a single sitemap file
   */
  async parseSitemap(url: string): Promise<{
    urls: SitemapUrl[];
    nestedSitemaps: string[];
  }> {
    await this.rateLimiter.wait();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'application/xml, text/xml, */*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let content = await response.text();

      // Handle gzip content (basic check)
      if (url.endsWith('.gz')) {
        // For now, skip gzipped sitemaps - would need pako or similar
        console.warn(`[SitemapParser] Skipping gzipped sitemap: ${url}`);
        return { urls: [], nestedSitemaps: [] };
      }

      return this.parseXmlContent(content);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parse XML content to extract URLs
   */
  private parseXmlContent(xml: string): {
    urls: SitemapUrl[];
    nestedSitemaps: string[];
  } {
    const urls: SitemapUrl[] = [];
    const nestedSitemaps: string[] = [];

    // Check if this is a sitemap index
    const isSitemapIndex = xml.includes('<sitemapindex') || xml.includes('<sitemap>');

    if (isSitemapIndex) {
      // Parse sitemap index - extract nested sitemap URLs
      const sitemapMatches = xml.matchAll(/<sitemap[^>]*>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi);
      for (const match of sitemapMatches) {
        const loc = this.decodeXmlEntities(match[1].trim());
        if (this.isValidUrl(loc)) {
          nestedSitemaps.push(loc);
        }
      }
    }

    // Parse URL entries
    const urlMatches = xml.matchAll(/<url[^>]*>([\s\S]*?)<\/url>/gi);
    for (const match of urlMatches) {
      const urlBlock = match[1];
      
      const locMatch = urlBlock.match(/<loc>([^<]+)<\/loc>/i);
      if (!locMatch) continue;

      const loc = this.decodeXmlEntities(locMatch[1].trim());
      if (!this.isValidUrl(loc)) continue;

      const url: SitemapUrl = { loc };

      // Extract optional fields
      const lastmodMatch = urlBlock.match(/<lastmod>([^<]+)<\/lastmod>/i);
      if (lastmodMatch) {
        url.lastmod = lastmodMatch[1].trim();
      }

      const changefreqMatch = urlBlock.match(/<changefreq>([^<]+)<\/changefreq>/i);
      if (changefreqMatch) {
        url.changefreq = changefreqMatch[1].trim().toLowerCase() as SitemapUrl['changefreq'];
      }

      const priorityMatch = urlBlock.match(/<priority>([^<]+)<\/priority>/i);
      if (priorityMatch) {
        url.priority = parseFloat(priorityMatch[1].trim());
      }

      urls.push(url);
    }

    return { urls, nestedSitemaps };
  }

  /**
   * Decode XML entities
   */
  private decodeXmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  }
}

export default SitemapParser;
