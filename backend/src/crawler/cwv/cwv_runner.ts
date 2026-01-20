/**
 * CWV Runner
 * 
 * Orchestrates Core Web Vitals collection for selected pages
 * Uses Lighthouse Adapter for measurement
 */

import {
  CoreWebVitals,
  CWVResult,
  CWVConfig,
  DeviceProfile,
  DEFAULT_CWV_CONFIG,
  calculateOverallStatus,
} from './cwv_types';
import { LighthouseAdapter } from './lighthouse_adapter';
import { extractVitals } from './vitals_extractor';

export interface CWVPageCandidate {
  url: string;
  priority: number; // 1=highest (homepage), 2=category, 3=content
  template?: string; // e.g., "homepage", "category", "product", "article"
}

export interface CWVRunProgress {
  totalPages: number;
  completedPages: number;
  currentUrl: string;
  currentDevice: DeviceProfile;
  results: CWVResult[];
  errors: string[];
}

export interface CWVRunnerCallbacks {
  onProgress?: (progress: CWVRunProgress) => void;
  onPageComplete?: (result: CWVResult) => void;
  onError?: (url: string, device: DeviceProfile, error: Error) => void;
}

/**
 * Select representative pages from crawled URLs
 */
export function selectRepresentativePages(
  urls: string[],
  maxPages: number = 20
): CWVPageCandidate[] {
  const candidates: CWVPageCandidate[] = [];
  const seen = new Set<string>();

  // Priority 1: Homepage
  const homepage = urls.find(u => {
    try {
      const url = new URL(u);
      return url.pathname === '/' || url.pathname === '' || url.pathname === '/vi/';
    } catch {
      return false;
    }
  });
  
  if (homepage && !seen.has(homepage)) {
    candidates.push({ url: homepage, priority: 1, template: 'homepage' });
    seen.add(homepage);
  }

  // Priority 2: Main category pages (depth 1-2)
  const categoryPatterns = [
    /^\/[a-z-]+\/?$/i,              // /category/
    /^\/vi\/[a-z-]+\/?$/i,          // /vi/category/
    /^\/[a-z-]+\/[a-z-]+\/?$/i,     // /category/subcategory/
    /^\/vi\/[a-z-]+\/[a-z-]+\/?$/i, // /vi/category/subcategory/
  ];

  for (const url of urls) {
    if (candidates.length >= maxPages) break;
    if (seen.has(url)) continue;

    try {
      const parsed = new URL(url);
      const isCategory = categoryPatterns.some(p => p.test(parsed.pathname));
      
      if (isCategory) {
        candidates.push({ url, priority: 2, template: 'category' });
        seen.add(url);
      }
    } catch {
      continue;
    }
  }

  // Priority 3: Content/Product pages (one per unique template pattern)
  const templatePatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /\/san-pham\//i, name: 'product' },
    { pattern: /\/dich-vu\//i, name: 'service' },
    { pattern: /\/tin-tuc\//i, name: 'news' },
    { pattern: /\/blog\//i, name: 'blog' },
    { pattern: /\/khuyen-mai\//i, name: 'promotion' },
    { pattern: /\/huong-dan\//i, name: 'guide' },
    { pattern: /\/faq\//i, name: 'faq' },
    { pattern: /\/lien-he\//i, name: 'contact' },
  ];

  const addedTemplates = new Set<string>();

  for (const url of urls) {
    if (candidates.length >= maxPages) break;
    if (seen.has(url)) continue;

    for (const { pattern, name } of templatePatterns) {
      if (pattern.test(url) && !addedTemplates.has(name)) {
        candidates.push({ url, priority: 3, template: name });
        seen.add(url);
        addedTemplates.add(name);
        break;
      }
    }
  }

  // Fill remaining with other pages
  for (const url of urls) {
    if (candidates.length >= maxPages) break;
    if (seen.has(url)) continue;

    candidates.push({ url, priority: 4, template: 'other' });
    seen.add(url);
  }

  // Sort by priority
  candidates.sort((a, b) => a.priority - b.priority);

  return candidates.slice(0, maxPages);
}

export class CWVRunner {
  private config: CWVConfig;
  private adapter: LighthouseAdapter;
  private isRunning = false;
  private shouldStop = false;

  constructor(config: Partial<CWVConfig> = {}) {
    this.config = { ...DEFAULT_CWV_CONFIG, ...config };
    this.adapter = new LighthouseAdapter(this.config);
  }

  /**
   * Run CWV collection for given pages
   */
  async runCWV(
    projectId: string,
    pages: CWVPageCandidate[],
    callbacks: CWVRunnerCallbacks = {}
  ): Promise<CWVResult[]> {
    if (this.isRunning) {
      throw new Error('CWV runner is already running');
    }

    this.isRunning = true;
    this.shouldStop = false;

    const results: CWVResult[] = [];
    const errors: string[] = [];

    // Limit pages
    const pagesToRun = pages.slice(0, this.config.maxCWVPages);

    console.log(`[CWVRunner] Starting CWV collection for ${pagesToRun.length} pages`);

    try {
      await this.adapter.initialize();

      for (let i = 0; i < pagesToRun.length; i++) {
        if (this.shouldStop) {
          console.log('[CWVRunner] Stopping due to cancellation request');
          break;
        }

        const page = pagesToRun[i];

        // Run for each configured device
        for (const device of this.config.devices) {
          if (this.shouldStop) break;

          // Report progress
          callbacks.onProgress?.({
            totalPages: pagesToRun.length,
            completedPages: i,
            currentUrl: page.url,
            currentDevice: device,
            results,
            errors,
          });

          try {
            const result = await this.measurePage(projectId, page.url, device);
            
            if (result) {
              results.push(result);
              callbacks.onPageComplete?.(result);
            }

          } catch (error) {
            const errorMessage = `Failed to measure ${page.url} (${device}): ${error}`;
            console.error(`[CWVRunner] ${errorMessage}`);
            errors.push(errorMessage);
            callbacks.onError?.(page.url, device, error as Error);
          }

          // Delay between runs to avoid overloading
          if (i < pagesToRun.length - 1 || this.config.devices.indexOf(device) < this.config.devices.length - 1) {
            await this.delay(this.config.delayBetweenRuns);
          }
        }
      }

      // Final progress report
      callbacks.onProgress?.({
        totalPages: pagesToRun.length,
        completedPages: pagesToRun.length,
        currentUrl: '',
        currentDevice: 'mobile',
        results,
        errors,
      });

    } finally {
      await this.adapter.cleanup();
      this.isRunning = false;
    }

    console.log(`[CWVRunner] Completed - ${results.length} results, ${errors.length} errors`);

    return results;
  }

  /**
   * Measure single page
   */
  private async measurePage(
    projectId: string,
    url: string,
    device: DeviceProfile
  ): Promise<CWVResult | null> {
    console.log(`[CWVRunner] Measuring ${url} (${device})`);

    const lighthouseResult = await this.adapter.runLighthouse(url, device);
    
    if (!lighthouseResult) {
      return null;
    }

    const vitals = extractVitals(lighthouseResult);
    const overallStatus = calculateOverallStatus(vitals);

    const result: CWVResult = {
      projectId,
      url,
      device,
      vitals,
      overallStatus,
      measuredAt: new Date(),
      lighthouseVersion: lighthouseResult.lhr.lighthouseVersion,
      userAgent: lighthouseResult.lhr.userAgent,
    };

    if (this.config.storeRawReport) {
      result.rawReport = lighthouseResult;
    }

    return result;
  }

  /**
   * Stop running CWV collection
   */
  stop(): void {
    console.log('[CWVRunner] Stop requested');
    this.shouldStop = true;
  }

  /**
   * Check if runner is currently active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Helper: delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CWVRunner;
