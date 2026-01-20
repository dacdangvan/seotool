/**
 * Page Fetcher
 * 
 * SEO-safe Web Crawler - HTTP fetching with proper headers
 * Only fetches public HTML pages, no form submission
 */

import { CrawlConfig } from './models';

export interface FetchResult {
  url: string;
  finalUrl: string; // After redirects
  statusCode: number;
  html: string;
  headers: Record<string, string>;
  responseTime: number;
  contentLength: number;
  contentType: string;
  redirectChain: string[];
  error?: string;
}

export interface FetcherConfig {
  timeout: number;
  userAgent: string;
  retryCount: number;
  backoffDelay: number;
}

export class PageFetcher {
  private config: FetcherConfig;
  
  constructor(crawlConfig: CrawlConfig) {
    this.config = {
      timeout: crawlConfig.timeout,
      userAgent: crawlConfig.userAgent,
      retryCount: crawlConfig.retryCount || 2,
      backoffDelay: crawlConfig.backoffDelay || 2000,
    };
  }
  
  /**
   * Fetch a URL and return the HTML content
   * SAFETY: Only GET requests, no auth, no forms
   */
  async fetch(url: string): Promise<FetchResult> {
    const startTime = Date.now();
    const redirectChain: string[] = [];
    let currentUrl = url;
    let attempts = 0;
    
    while (attempts <= this.config.retryCount) {
      try {
        const result = await this.doFetch(currentUrl, startTime, redirectChain);
        return result;
      } catch (error) {
        attempts++;
        
        if (attempts > this.config.retryCount) {
          return this.createErrorResult(url, startTime, redirectChain, error);
        }
        
        // Wait before retry with exponential backoff
        const waitTime = this.config.backoffDelay * attempts;
        console.log(`[Fetcher] Retry ${attempts}/${this.config.retryCount} for ${url} after ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }
    
    return this.createErrorResult(url, startTime, redirectChain, new Error('Max retries exceeded'));
  }
  
  /**
   * Perform the actual fetch
   */
  private async doFetch(
    url: string,
    startTime: number,
    redirectChain: string[]
  ): Promise<FetchResult> {
    console.log(`[Fetcher] Fetching: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        method: 'GET', // SAFETY: Only GET requests
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          // SAFETY: No auth headers, no cookies
        },
        signal: controller.signal,
        redirect: 'follow', // Follow redirects
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      const contentType = response.headers.get('content-type') || '';
      
      // Track final URL after redirects
      const finalUrl = response.url || url;
      if (finalUrl !== url) {
        redirectChain.push(finalUrl);
      }
      
      // Get response text
      let html = '';
      if (response.ok && contentType.includes('text/html')) {
        html = await response.text();
      } else if (response.ok) {
        // Non-HTML content, get minimal text for reference
        const text = await response.text();
        html = text.substring(0, 1000); // Limit non-HTML content
      }
      
      const contentLength = html.length;
      
      // Convert headers to object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      
      console.log(`[Fetcher] Completed: ${url} (${response.status}) in ${responseTime}ms`);
      
      return {
        url,
        finalUrl,
        statusCode: response.status,
        html,
        headers,
        responseTime,
        contentLength,
        contentType,
        redirectChain,
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Create error result
   */
  private createErrorResult(
    url: string,
    startTime: number,
    redirectChain: string[],
    error: unknown
  ): FetchResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
    
    console.error(`[Fetcher] Error fetching ${url}: ${errorMessage}`);
    
    return {
      url,
      finalUrl: url,
      statusCode: isTimeout ? 408 : 0, // 408 Request Timeout
      html: '',
      headers: {},
      responseTime: Date.now() - startTime,
      contentLength: 0,
      contentType: '',
      redirectChain,
      error: errorMessage,
    };
  }
  
  /**
   * Check if response is HTML
   */
  isHtmlResponse(result: FetchResult): boolean {
    return result.contentType.includes('text/html') || 
           result.contentType.includes('application/xhtml+xml');
  }
  
  /**
   * Check if response is successful
   */
  isSuccessful(result: FetchResult): boolean {
    return result.statusCode >= 200 && result.statusCode < 300;
  }
  
  /**
   * Check if response is a redirect
   */
  isRedirect(result: FetchResult): boolean {
    return result.statusCode >= 300 && result.statusCode < 400;
  }
  
  /**
   * Check if response is a client error
   */
  isClientError(result: FetchResult): boolean {
    return result.statusCode >= 400 && result.statusCode < 500;
  }
  
  /**
   * Check if response is a server error
   */
  isServerError(result: FetchResult): boolean {
    return result.statusCode >= 500;
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
