/**
 * Dashboard API Contract
 * 
 * v0.7 - API contract definitions between Frontend and Backend Orchestrator
 * 
 * These contracts define the expected request/response formats.
 * Backend should implement these endpoints.
 */

// =============================================================================
// GET /api/dashboard
// =============================================================================

/**
 * Fetch aggregated dashboard data
 * 
 * Request: GET /api/dashboard
 * 
 * Response: DashboardData (see src/types/dashboard.ts)
 * 
 * Notes:
 * - Returns pre-aggregated data from all agents
 * - Should be cached (recommend 60s TTL)
 * - No direct calls to agents from frontend
 */

export interface GetDashboardResponse {
  kpiOverview: {
    organicTraffic: {
      current: number;
      previous: number;
      change: number;
      changePercent: number;
      trend: 'up' | 'down' | 'stable';
      period: string;
    };
    keywordCoverage: {
      top3: number;
      top3Change: number;
      top10: number;
      top10Change: number;
      totalTracked: number;
    };
    contentPerformance: {
      totalPages: number;
      highPerforming: number;
      needsOptimization: number;
      newContent: number;
    };
    healthScore: number;
    healthScoreChange: number;
    lastUpdated: string; // ISO 8601
  };
  
  seoHealth: {
    overall: {
      score: number;
      status: 'healthy' | 'warning' | 'critical' | 'unknown';
    };
    technical: HealthItem;
    content: HealthItem;
    authority: HealthItem;
    monitoring: HealthItem;
    activeAlerts: RiskAlert[];
  };
  
  forecast: {
    current: number;
    forecast30d: ForecastPoint;
    forecast60d: ForecastPoint;
    forecast90d: ForecastPoint;
    dailyForecast: ForecastPoint[];
    trend: 'increasing' | 'decreasing' | 'stable';
    trendStrength: number; // 0-1
    confidence: number; // 0-1
    lastUpdated: string; // ISO 8601
  };
  
  recommendations: {
    topRecommendations: Recommendation[];
    totalOpportunities: number;
    potentialTrafficGain: number;
    generatedAt: string; // ISO 8601
  };
}

interface HealthItem {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number; // 0-100
  issues: number;
  description: string;
}

interface RiskAlert {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric: string;
  detectedAt: string; // ISO 8601
  impact: string;
}

interface ForecastPoint {
  date: string; // YYYY-MM-DD
  predicted: number;
  lower: number;
  upper: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  risk: 'high' | 'medium' | 'low';
  category: 'technical' | 'content' | 'authority' | 'monitoring';
  estimatedTrafficGain?: number;
  priority: number;
}

// =============================================================================
// POST /api/copilot/chat
// =============================================================================

/**
 * Send message to AI Copilot
 * 
 * Request: POST /api/copilot/chat
 * Body: CopilotChatRequest
 * 
 * Response: CopilotChatResponse
 * 
 * Notes:
 * - Uses LLM abstraction (same as content engine)
 * - Includes dashboard context automatically
 * - Returns business-friendly, non-technical answers
 */

export interface CopilotChatRequest {
  message: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface CopilotChatResponse {
  response: string;
  suggestedFollowUps?: string[];
}

// =============================================================================
// GET /api/dashboard/:section
// =============================================================================

/**
 * Refresh specific dashboard section
 * 
 * Request: GET /api/dashboard/kpi | health | forecast | recommendations
 * 
 * Response: Partial<DashboardData> (only requested section)
 * 
 * Notes:
 * - Use for incremental updates
 * - Faster than full dashboard refresh
 */

export type DashboardSection = 'kpi' | 'health' | 'forecast' | 'recommendations';

// =============================================================================
// BACKEND IMPLEMENTATION NOTES
// =============================================================================

/**
 * Backend Orchestrator should:
 * 
 * 1. Aggregate data from agents:
 *    - v0.1 Keyword Intelligence → keyword coverage
 *    - v0.3 Content Engine → content performance
 *    - v0.4 Technical SEO → technical health
 *    - v0.5 Entity Linking → authority status
 *    - v0.6 Monitoring → forecasts, alerts, health
 * 
 * 2. Transform to manager-friendly format:
 *    - No technical jargon
 *    - Clear impact descriptions
 *    - Actionable recommendations
 * 
 * 3. Cache appropriately:
 *    - KPIs: 1-5 min
 *    - Health: 5-15 min
 *    - Forecasts: 1-6 hours
 *    - Recommendations: 1-6 hours
 * 
 * 4. AI Copilot context:
 *    - Include current KPIs
 *    - Include recent alerts
 *    - Include top recommendations
 *    - System prompt for manager-friendly tone
 */
