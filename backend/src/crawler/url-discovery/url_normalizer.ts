/**
 * URL Normalizer
 * 
 * Implements § 11.3 URL Normalization Rules:
 * - Resolve relative URLs
 * - Enforce HTTPS
 * - Preserve language paths (e.g. /vi/, /en/)
 * - Remove tracking parameters (utm_*, fbclid, gclid)
 * - Respect canonical URL if available
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6 Section 11
 */

import {
  UrlNormalizationConfig,
  DEFAULT_NORMALIZATION_CONFIG
} from './types';

export class UrlNormalizer {
  private config: UrlNormalizationConfig;
  private baseUrl: URL;

  constructor(
    baseUrl: string,
    config: Partial<UrlNormalizationConfig> = {}
  ) {
    this.config = { ...DEFAULT_NORMALIZATION_CONFIG, ...config };
    this.baseUrl = new URL(baseUrl);
  }

  /**
   * § 11.3 Normalize URL according to rules
   */
  normalize(url: string, pageUrl?: string): string | null {
    try {
      // Resolve relative URLs
      const base = pageUrl ? new URL(pageUrl) : this.baseUrl;
      const parsed = new URL(url, base);

      // § 11.3: Enforce HTTPS
      if (this.config.enforceHttps && parsed.protocol === 'http:') {
        parsed.protocol = 'https:';
      }

      // § 11.3: Lowercase host
      if (this.config.lowercaseHost) {
        parsed.hostname = parsed.hostname.toLowerCase();
      }

      // § 11.3: Remove default ports
      if (this.config.removeDefaultPorts) {
        if (parsed.port === '80' || parsed.port === '443') {
          parsed.port = '';
        }
      }

      // § 11.3: Remove tracking parameters
      if (this.config.trackingParams.length > 0) {
        for (const param of this.config.trackingParams) {
          parsed.searchParams.delete(param);
        }
      }

      // § 11.3: Remove fragment/hash
      if (this.config.removeFragment) {
        parsed.hash = '';
      }

      // § 11.3: Handle trailing slash (preserve by default for SEO)
      let pathname = parsed.pathname;
      if (this.config.removeTrailingSlash && pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
        parsed.pathname = pathname;
      }

      // Sort remaining query parameters for consistency
      parsed.searchParams.sort();

      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Check if URL is within the same domain
   */
  isSameDomain(url: string, includeSubdomains = false): boolean {
    try {
      const parsed = new URL(url);
      const baseDomain = this.getDomainWithoutWww(this.baseUrl.hostname);
      const urlDomain = this.getDomainWithoutWww(parsed.hostname);

      if (includeSubdomains) {
        return urlDomain === baseDomain || urlDomain.endsWith(`.${baseDomain}`);
      }

      return urlDomain === baseDomain;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL matches any exclude patterns
   */
  matchesExcludePattern(url: string, patterns: string[]): boolean {
    const pathname = this.getPathname(url);
    if (!pathname) return false;

    for (const pattern of patterns) {
      // Check if pattern is a simple string or regex-like
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Regex pattern
        try {
          const regex = new RegExp(pattern.slice(1, -1), 'i');
          if (regex.test(pathname) || regex.test(url)) {
            return true;
          }
        } catch {
          // Invalid regex, treat as string
        }
      } else {
        // Simple string match
        if (pathname.toLowerCase().includes(pattern.toLowerCase())) {
          return true;
        }
        if (url.toLowerCase().includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if URL is a valid crawlable URL
   */
  isValidCrawlableUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      // Must be HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }

      // Skip data URIs, javascript, mailto, etc.
      if (this.isSpecialProtocol(url)) {
        return false;
      }

      // Skip common non-HTML resources
      if (this.isNonHtmlResource(parsed.pathname)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract domain without www prefix
   */
  private getDomainWithoutWww(hostname: string): string {
    return hostname.toLowerCase().replace(/^www\./, '');
  }

  /**
   * Get pathname from URL
   */
  private getPathname(url: string): string | null {
    try {
      return new URL(url).pathname;
    } catch {
      return null;
    }
  }

  /**
   * Check for special protocols
   */
  private isSpecialProtocol(url: string): boolean {
    const specialProtocols = [
      'javascript:', 'mailto:', 'tel:', 'data:', 'file:', 'ftp:',
      'blob:', 'about:', 'chrome:', 'edge:',
    ];
    const lowerUrl = url.toLowerCase();
    return specialProtocols.some(proto => lowerUrl.startsWith(proto));
  }

  /**
   * Check if URL points to a non-HTML resource
   */
  private isNonHtmlResource(pathname: string): boolean {
    const nonHtmlExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
      // Documents
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods',
      // Archives
      '.zip', '.rar', '.tar', '.gz', '.7z', '.bz2',
      // Media
      '.mp3', '.mp4', '.wav', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ogg',
      // Code/Data
      '.css', '.js', '.json', '.xml', '.rss', '.atom',
      // Fonts
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      // Other
      '.exe', '.dmg', '.apk', '.msi',
    ];

    const lowerPathname = pathname.toLowerCase();
    return nonHtmlExtensions.some(ext => lowerPathname.endsWith(ext));
  }

  /**
   * § 11.3: Respect canonical URL if available
   * Returns the canonical URL if it's valid and same-domain, otherwise original
   */
  resolveCanonical(originalUrl: string, canonicalUrl: string | null): string {
    if (!canonicalUrl) return originalUrl;

    // Normalize canonical URL
    const normalized = this.normalize(canonicalUrl);
    if (!normalized) return originalUrl;

    // Must be same domain
    if (!this.isSameDomain(normalized)) return originalUrl;

    return normalized;
  }
}

export const createUrlNormalizer = (
  baseUrl: string,
  config?: Partial<UrlNormalizationConfig>
): UrlNormalizer => {
  return new UrlNormalizer(baseUrl, config);
};
