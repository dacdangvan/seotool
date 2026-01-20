/**
 * JS Render Engine
 * 
 * Uses Playwright (Chromium) to render pages with JavaScript execution.
 * Supports mobile/desktop viewports, resource blocking, and browser pooling.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  RenderOptions,
  RenderedDom,
  ViewportType,
  ViewportConfig,
  VIEWPORT_CONFIGS,
  JsRenderConfig,
  DEFAULT_JS_RENDER_CONFIG
} from './types';

export class JsRenderEngine {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private config: JsRenderConfig;
  private isInitialized = false;
  private renderCount = 0;

  constructor(config: Partial<JsRenderConfig> = {}) {
    this.config = { ...DEFAULT_JS_RENDER_CONFIG, ...config };
  }

  /**
   * Initialize browser instance
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ]
    });

    this.isInitialized = true;
    console.log('[JsRenderEngine] Browser initialized');
  }

  /**
   * Get or create browser context for viewport
   */
  private async getContext(viewport: ViewportType): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const contextKey = viewport;
    
    if (this.contexts.has(contextKey)) {
      return this.contexts.get(contextKey)!;
    }

    const viewportConfig = VIEWPORT_CONFIGS[viewport];
    
    const context = await this.browser.newContext({
      viewport: {
        width: viewportConfig.width,
        height: viewportConfig.height
      },
      deviceScaleFactor: viewportConfig.deviceScaleFactor,
      isMobile: viewportConfig.isMobile,
      hasTouch: viewportConfig.hasTouch,
      userAgent: viewportConfig.userAgent,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
    });

    this.contexts.set(contextKey, context);
    return context;
  }

  /**
   * Render a page and return the DOM
   */
  async render(url: string, options: Partial<RenderOptions> = {}): Promise<RenderedDom> {
    const startTime = Date.now();
    
    const renderOptions: RenderOptions = {
      viewport: options.viewport ?? this.config.defaultViewport,
      timeout: options.timeout ?? this.config.timeout,
      waitUntil: options.waitUntil ?? 'networkidle',
      waitForSelector: options.waitForSelector,
      waitForTimeout: options.waitForTimeout,
      blockResources: options.blockResources ?? this.config.blockResources
    };

    // Check render limit
    if (this.renderCount >= this.config.maxJsRenderPages) {
      throw new Error(`JS render limit reached (${this.config.maxJsRenderPages})`);
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    const context = await this.getContext(renderOptions.viewport);
    const page = await context.newPage();

    try {
      // Block resources if configured
      if (renderOptions.blockResources && renderOptions.blockResources.length > 0) {
        await this.setupResourceBlocking(page, renderOptions.blockResources);
      }

      // Navigate to URL
      const response = await page.goto(url, {
        timeout: renderOptions.timeout,
        waitUntil: renderOptions.waitUntil
      });

      if (!response) {
        throw new Error(`Failed to load URL: ${url}`);
      }

      // Wait for additional selector if specified
      if (renderOptions.waitForSelector) {
        await page.waitForSelector(renderOptions.waitForSelector, {
          timeout: renderOptions.timeout / 2
        });
      }

      // Additional wait time if specified
      if (renderOptions.waitForTimeout) {
        await page.waitForTimeout(renderOptions.waitForTimeout);
      }

      // Wait for any remaining network activity
      await this.waitForDomStabilization(page);

      // Get the final URL (after redirects)
      const finalUrl = page.url();

      // Extract rendered HTML
      const html = await page.content();

      this.renderCount++;

      const renderTime = Date.now() - startTime;

      return {
        html,
        url,
        finalUrl,
        renderMode: 'js_rendered',
        viewport: renderOptions.viewport,
        renderTime,
        timestamp: new Date().toISOString()
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Setup resource blocking to speed up rendering
   */
  private async setupResourceBlocking(
    page: Page,
    blockTypes: ('image' | 'stylesheet' | 'font' | 'media')[]
  ): Promise<void> {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      
      const typeMap: Record<string, string> = {
        image: 'image',
        stylesheet: 'stylesheet',
        font: 'font',
        media: 'media'
      };

      const shouldBlock = blockTypes.some(type => 
        resourceType === typeMap[type]
      );

      if (shouldBlock) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  /**
   * Wait for DOM to stabilize (no more mutations)
   */
  private async waitForDomStabilization(page: Page, timeout = 5000): Promise<void> {
    try {
      await page.evaluate((timeoutMs) => {
        return new Promise<void>((resolve) => {
          let lastMutationTime = Date.now();
          const checkInterval = 200;
          const stableThreshold = 500;

          const observer = new MutationObserver(() => {
            lastMutationTime = Date.now();
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });

          const checkStability = setInterval(() => {
            const timeSinceLastMutation = Date.now() - lastMutationTime;
            const totalTime = Date.now() - lastMutationTime;

            if (timeSinceLastMutation > stableThreshold || totalTime > timeoutMs) {
              clearInterval(checkStability);
              observer.disconnect();
              resolve();
            }
          }, checkInterval);

          // Fallback timeout
          setTimeout(() => {
            clearInterval(checkStability);
            observer.disconnect();
            resolve();
          }, timeoutMs);
        });
      }, timeout);
    } catch (error) {
      // Ignore stabilization errors, continue with extraction
      console.warn('[JsRenderEngine] DOM stabilization warning:', error);
    }
  }

  /**
   * Render multiple URLs in batch
   */
  async renderBatch(
    urls: string[],
    options: Partial<RenderOptions> = {},
    concurrency = 3
  ): Promise<Map<string, RenderedDom | Error>> {
    const results = new Map<string, RenderedDom | Error>();
    
    // Process in chunks
    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      
      const promises = chunk.map(async (url) => {
        try {
          const result = await this.render(url, options);
          results.set(url, result);
        } catch (error) {
          results.set(url, error instanceof Error ? error : new Error(String(error)));
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /**
   * Get current render count
   */
  getRenderCount(): number {
    return this.renderCount;
  }

  /**
   * Reset render count
   */
  resetRenderCount(): void {
    this.renderCount = 0;
  }

  /**
   * Check if render limit reached
   */
  isLimitReached(): boolean {
    return this.renderCount >= this.config.maxJsRenderPages;
  }

  /**
   * Cleanup browser and contexts
   */
  async close(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.isInitialized = false;
    this.renderCount = 0;
    console.log('[JsRenderEngine] Browser closed');
  }
}

// Singleton instance for reuse
let engineInstance: JsRenderEngine | null = null;

export function getJsRenderEngine(config?: Partial<JsRenderConfig>): JsRenderEngine {
  if (!engineInstance) {
    engineInstance = new JsRenderEngine(config);
  }
  return engineInstance;
}

export async function closeJsRenderEngine(): Promise<void> {
  if (engineInstance) {
    await engineInstance.close();
    engineInstance = null;
  }
}

export default JsRenderEngine;
