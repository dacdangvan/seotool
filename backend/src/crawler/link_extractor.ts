/**
 * Link Extractor
 * 
 * SEO-safe Web Crawler - Extract and normalize links
 * Only internal links, filter unsafe protocols
 */

export interface ExtractedLink {
  url: string;
  text: string;
  isInternal: boolean;
  rel?: string;
  hasNofollow: boolean;
}

export class LinkExtractor {
  private baseUrl: URL;
  private seenUrls: Set<string> = new Set();
  
  // SAFETY: Protocols to filter out
  private readonly UNSAFE_PROTOCOLS = [
    'javascript:',
    'mailto:',
    'tel:',
    'data:',
    'file:',
    'ftp:',
  ];
  
  // URL patterns to exclude
  private readonly EXCLUDE_PATTERNS = [
    /\.(jpg|jpeg|png|gif|svg|webp|ico|bmp)$/i,
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
    /\.(zip|rar|tar|gz|7z)$/i,
    /\.(css|js|json|xml|rss|atom)$/i,
    /\.(mp3|mp4|wav|avi|mov|wmv|flv)$/i,
    /\.(woff|woff2|ttf|eot|otf)$/i,
    /\?.*utm_/i, // UTM parameters (will be stripped)
    /#.+$/, // Fragment identifiers
  ];
  
  // Query parameters to remove (tracking/session)
  private readonly STRIP_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid',
    'ref', 'source', 'affiliate',
    'sessionid', 'session_id', 'token',
    '_ga', '_gl', 'mc_cid', 'mc_eid',
  ];
  
  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl);
  }
  
  /**
   * Extract all links from HTML content
   */
  extract(html: string, pageUrl: string): { internal: ExtractedLink[]; external: ExtractedLink[] } {
    const internal: ExtractedLink[] = [];
    const external: ExtractedLink[] = [];
    
    // Regex to find anchor tags
    const anchorRegex = /<a\s+([^>]*?)href=["']([^"'#][^"']*)["']([^>]*?)>([^<]*)<\/a>/gi;
    
    let match;
    while ((match = anchorRegex.exec(html)) !== null) {
      const beforeHref = match[1] || '';
      const href = match[2];
      const afterHref = match[3] || '';
      const text = match[4]?.trim() || '';
      
      // Skip unsafe protocols
      if (this.isUnsafeProtocol(href)) {
        continue;
      }
      
      // Normalize and validate URL
      const normalized = this.normalizeUrl(href, pageUrl);
      if (!normalized) continue;
      
      // Check if already seen (deduplication)
      if (this.seenUrls.has(normalized)) continue;
      this.seenUrls.add(normalized);
      
      // Extract rel attribute
      const relMatch = (beforeHref + afterHref).match(/rel=["']([^"']*)["']/i);
      const rel = relMatch ? relMatch[1].toLowerCase() : undefined;
      const hasNofollow = rel?.includes('nofollow') || false;
      
      // Check if internal or external
      const isInternal = this.isInternalUrl(normalized);
      
      const link: ExtractedLink = {
        url: normalized,
        text,
        isInternal,
        rel,
        hasNofollow,
      };
      
      if (isInternal) {
        internal.push(link);
      } else {
        external.push(link);
      }
    }
    
    return { internal, external };
  }
  
  /**
   * Extract only internal link URLs (optimized version)
   */
  extractInternalUrls(html: string, pageUrl: string): string[] {
    const urls: string[] = [];
    
    // Fast regex for href extraction
    const hrefRegex = /href=["']([^"'#][^"']*)["']/gi;
    
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];
      
      // Skip unsafe protocols
      if (this.isUnsafeProtocol(href)) continue;
      
      // Normalize URL
      const normalized = this.normalizeUrl(href, pageUrl);
      if (!normalized) continue;
      
      // Check if internal and not seen
      if (this.isInternalUrl(normalized) && !this.seenUrls.has(normalized)) {
        this.seenUrls.add(normalized);
        urls.push(normalized);
      }
    }
    
    return urls;
  }
  
  /**
   * Check if URL uses an unsafe protocol
   */
  private isUnsafeProtocol(url: string): boolean {
    const lowerUrl = url.toLowerCase().trim();
    return this.UNSAFE_PROTOCOLS.some(protocol => lowerUrl.startsWith(protocol));
  }
  
  /**
   * Check if URL should be excluded
   */
  private shouldExclude(url: string): boolean {
    return this.EXCLUDE_PATTERNS.some(pattern => pattern.test(url));
  }
  
  /**
   * Normalize URL for deduplication
   */
  normalizeUrl(href: string, baseUrl: string): string | null {
    try {
      // Create absolute URL
      const url = new URL(href, baseUrl);
      
      // Only http/https
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      
      // Check exclude patterns (except query params which we strip)
      const pathOnly = url.pathname;
      if (this.shouldExclude(pathOnly)) {
        return null;
      }
      
      // Normalize path
      let path = url.pathname;
      
      // Remove trailing slash (except for root)
      if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      
      // Remove index files
      path = path.replace(/\/(index|default)\.(html?|php|asp|aspx)$/i, '/');
      
      // Strip tracking query parameters
      const params = new URLSearchParams(url.search);
      for (const param of this.STRIP_PARAMS) {
        params.delete(param);
      }
      
      // Sort remaining params for consistency
      const sortedParams = new URLSearchParams();
      [...params.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([key, value]) => sortedParams.set(key, value));
      
      const search = sortedParams.toString();
      
      // Build normalized URL (no fragment)
      return url.origin + path + (search ? '?' + search : '');
      
    } catch {
      return null;
    }
  }
  
  /**
   * Check if URL is internal (same domain)
   */
  isInternalUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === this.baseUrl.hostname ||
             parsed.hostname.endsWith('.' + this.baseUrl.hostname);
    } catch {
      return false;
    }
  }
  
  /**
   * Reset seen URLs (for new crawl)
   */
  reset(): void {
    this.seenUrls.clear();
  }
  
  /**
   * Get count of seen URLs
   */
  getSeenCount(): number {
    return this.seenUrls.size;
  }
  
  /**
   * Check if URL was already seen
   */
  hasSeen(url: string): boolean {
    const normalized = this.normalizeUrl(url, this.baseUrl.href);
    return normalized ? this.seenUrls.has(normalized) : false;
  }
}
