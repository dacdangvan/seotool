/**
 * Content Engine - Configuration
 * 
 * Environment-based configuration with sensible defaults.
 */

export interface Config {
  // Server
  port: number;
  host: string;
  debug: boolean;

  // LLM Provider
  llmProvider: 'openai' | 'anthropic';
  openaiApiKey: string;
  anthropicApiKey: string;
  
  // Model settings
  outlineModel: string;
  contentModel: string;
  temperature: number;
  maxTokens: number;

  // Database
  databaseUrl: string;

  // Content settings
  defaultLanguage: string;
  maxWordCount: number;
  minWordCount: number;
  
  // Execution
  maxExecutionTimeSeconds: number;
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
    port: getEnvNumber('PORT', 8002),
    host: getEnvOrDefault('HOST', '0.0.0.0'),
    debug: getEnvBoolean('DEBUG', false),

    // LLM Provider
    llmProvider: getEnvOrDefault('LLM_PROVIDER', 'openai') as 'openai' | 'anthropic',
    openaiApiKey: getEnvOrDefault('OPENAI_API_KEY', ''),
    anthropicApiKey: getEnvOrDefault('ANTHROPIC_API_KEY', ''),
    
    // Model settings
    outlineModel: getEnvOrDefault('OUTLINE_MODEL', 'gpt-4o'),
    contentModel: getEnvOrDefault('CONTENT_MODEL', 'gpt-4o'),
    temperature: parseFloat(getEnvOrDefault('LLM_TEMPERATURE', '0.7')),
    maxTokens: getEnvNumber('MAX_TOKENS', 4096),

    // Database
    databaseUrl: getEnvOrDefault('DATABASE_URL', 'postgresql://localhost:5432/seo_tool'),

    // Content settings
    defaultLanguage: getEnvOrDefault('DEFAULT_LANGUAGE', 'en-US'),
    maxWordCount: getEnvNumber('MAX_WORD_COUNT', 3000),
    minWordCount: getEnvNumber('MIN_WORD_COUNT', 800),
    
    // Execution
    maxExecutionTimeSeconds: getEnvNumber('MAX_EXECUTION_TIME', 180),
  };
}

// Singleton config
let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}
