/**
 * Technical SEO Agent - Configuration
 */

export interface Config {
  // Server
  port: number;
  host: string;
  debug: boolean;

  // Crawler
  defaultMaxPages: number;
  defaultCrawlDepth: number;
  defaultRequestDelayMs: number;
  defaultUserAgent: string;
  crawlTimeoutMs: number;

  // Lighthouse
  lighthouseChromePath: string | undefined;
  lighthouseTimeoutMs: number;

  // Database
  databaseUrl: string;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function loadConfig(): Config {
  return {
    // Server
    port: getEnvNumber('PORT', 8003),
    host: getEnvOrDefault('HOST', '0.0.0.0'),
    debug: getEnvBoolean('DEBUG', false),

    // Crawler
    defaultMaxPages: getEnvNumber('DEFAULT_MAX_PAGES', 20),
    defaultCrawlDepth: getEnvNumber('DEFAULT_CRAWL_DEPTH', 2),
    defaultRequestDelayMs: getEnvNumber('DEFAULT_REQUEST_DELAY_MS', 1000),
    defaultUserAgent: getEnvOrDefault(
      'DEFAULT_USER_AGENT',
      'SEOTool-TechnicalAudit/0.4 (compatible; +https://seotool.example.com/bot)'
    ),
    crawlTimeoutMs: getEnvNumber('CRAWL_TIMEOUT_MS', 30000),

    // Lighthouse
    lighthouseChromePath: process.env.LIGHTHOUSE_CHROME_PATH || undefined,
    lighthouseTimeoutMs: getEnvNumber('LIGHTHOUSE_TIMEOUT_MS', 60000),

    // Database
    databaseUrl: getEnvOrDefault('DATABASE_URL', ''),
  };
}
