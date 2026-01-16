/**
 * KeywordIntelligenceAgent - HTTP client for Keyword Intelligence Python worker
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 1
 */

import { SeoTask, TaskType, TaskStatus } from '../../domain/index';
import { Logger } from '../../shared/Logger';
import { IAgent, AgentResult } from './AgentDispatcher';

export interface KeywordAnalysisRequest {
  task_id: string;
  plan_id: string;
  keywords: string[];
  target_url?: string;
  locale?: string;
  options?: Record<string, unknown>;
}

export interface KeywordAnalysisResponse {
  task_id: string;
  status: string;
  keywords_count: number;
  clusters_count: number;
  intent_distribution: Record<string, number>;
  total_search_volume: number;
  processing_time_ms: number;
  error?: string;
  completed_at: string;
}

export interface KeywordIntelligenceAgentConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

const DEFAULT_CONFIG: KeywordIntelligenceAgentConfig = {
  baseUrl: process.env.KEYWORD_AGENT_URL || 'http://localhost:8001',
  timeout: 120000, // 2 minutes as per spec
  retries: 3,
};

/**
 * KeywordIntelligenceAgent - Communicates with Python Keyword Intelligence worker
 */
export class KeywordIntelligenceAgent implements IAgent {
  readonly name = 'KeywordIntelligenceAgent';
  readonly supportedTaskTypes = [TaskType.KEYWORD_ANALYSIS];

  private readonly config: KeywordIntelligenceAgentConfig;
  private readonly logger: Logger;

  constructor(config?: Partial<KeywordIntelligenceAgentConfig>, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger || new Logger('KeywordIntelligenceAgent');
  }

  /**
   * Execute keyword analysis task
   */
  async execute(task: SeoTask): Promise<AgentResult> {
    const startTime = Date.now();

    if (task.type !== TaskType.KEYWORD_ANALYSIS) {
      return {
        success: false,
        error: `Unsupported task type: ${task.type}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    this.logger.info(`Executing keyword analysis task: ${task.id}`);

    try {
      const request = this.buildRequest(task);
      const response = await this.callAgentAPI(request);

      return {
        success: response.status === 'completed',
        data: response,
        error: response.error,
        executionTimeMs: response.processing_time_ms || Date.now() - startTime,
        metrics: {
          keywordsAnalyzed: response.keywords_count,
          clustersCreated: response.clusters_count,
          totalSearchVolume: response.total_search_volume,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Keyword analysis failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check agent health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/keywords/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as { status: string };
      return data.status === 'healthy';
    } catch (error) {
      this.logger.warn('Keyword Intelligence Agent health check failed', { error });
      return false;
    }
  }

  /**
   * Build request from SeoTask
   */
  private buildRequest(task: SeoTask): KeywordAnalysisRequest {
    // Extract keywords from task input
    const input = task.input as Record<string, unknown> || {};
    const keywords = (input.keywords as string[]) || [];
    const targetUrl = input.targetUrl as string | undefined;
    const locale = input.locale as string | undefined;

    return {
      task_id: task.id,
      plan_id: task.planId,
      keywords,
      target_url: targetUrl,
      locale: locale || 'en-US',
      options: {
        default_volume: 0,
        ...((input.options as Record<string, unknown>) || {}),
      },
    };
  }

  /**
   * Call the agent API with retry logic
   */
  private async callAgentAPI(request: KeywordAnalysisRequest): Promise<KeywordAnalysisResponse> {
    const url = `${this.config.baseUrl}/api/v1/keywords/analyze`;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        this.logger.debug(`API call attempt ${attempt}/${this.config.retries}`, { url });

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json() as KeywordAnalysisResponse;
        return data;
      } catch (error) {
        const isLastAttempt = attempt === this.config.retries;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (isLastAttempt) {
          throw new Error(`Failed after ${this.config.retries} attempts: ${errorMessage}`);
        }

        this.logger.warn(`Attempt ${attempt} failed, retrying...`, { error: errorMessage });
        
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('Unexpected error in retry loop');
  }

  /**
   * Find similar keywords (utility method)
   */
  async findSimilarKeywords(query: string, topK: number = 10): Promise<unknown[]> {
    const url = `${this.config.baseUrl}/api/v1/keywords/similar`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, top_k: topK }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Failed to find similar keywords: HTTP ${response.status}`);
    }

    return response.json() as Promise<unknown[]>;
  }
}
