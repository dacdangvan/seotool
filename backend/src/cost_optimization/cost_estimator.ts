/**
 * Cost Estimator v1.6
 * 
 * Estimates costs across multiple dimensions for SEO actions.
 * 
 * Cost Dimensions:
 * - Token: LLM token usage (prompt + completion)
 * - Compute: Crawl, audit, embedding operations
 * - Effort: Engineering / content / review time
 * - Risk: Expected downside from action
 * 
 * Design Principles:
 * - All costs are relative units (not monetary)
 * - Fully explainable assumptions
 * - Calibrated from historical feedback
 * - Deterministic calculations
 */

import {
  CostCategory,
  TokenCost,
  TokenOperationType,
  ComputeCost,
  EffortCost,
  RiskCost,
  ActionCostBreakdown,
  CostAssumption,
  CostHeuristics,
  CostOptimizationConfig,
  DEFAULT_COST_OPTIMIZATION_CONFIG,
} from './models';

// ============================================================================
// ACTION TYPE TO OPERATIONS MAPPING
// ============================================================================

interface ActionOperationProfile {
  tokenOperations: TokenOperationType[];
  avgPromptTokens: number;
  avgCompletionTokens: number;
  pagesAffected: number;
  requiresCrawl: boolean;
  requiresAudit: boolean;
  requiresEmbedding: boolean;
  engineeringHours: number;
  contentHours: number;
  reviewHours: number;
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  skills: string[];
  riskProfile: {
    ranking: number;
    traffic: number;
    penalty: number;
    brand: number;
    technical: number;
  };
}

const ACTION_OPERATION_PROFILES: Record<string, ActionOperationProfile> = {
  'create_content': {
    tokenOperations: [TokenOperationType.CONTENT_GENERATION, TokenOperationType.META_GENERATION],
    avgPromptTokens: 2000,
    avgCompletionTokens: 4000,
    pagesAffected: 1,
    requiresCrawl: false,
    requiresAudit: false,
    requiresEmbedding: true,
    engineeringHours: 1,
    contentHours: 6,
    reviewHours: 1,
    complexity: 'high',
    skills: ['content writing', 'SEO', 'keyword research'],
    riskProfile: { ranking: 0.1, traffic: 0.1, penalty: 0.05, brand: 0.2, technical: 0.05 },
  },
  'update_content': {
    tokenOperations: [TokenOperationType.CONTENT_OPTIMIZATION, TokenOperationType.CONTENT_ANALYSIS],
    avgPromptTokens: 3000,
    avgCompletionTokens: 2000,
    pagesAffected: 1,
    requiresCrawl: true,
    requiresAudit: false,
    requiresEmbedding: true,
    engineeringHours: 0.5,
    contentHours: 3,
    reviewHours: 0.5,
    complexity: 'medium',
    skills: ['content writing', 'SEO'],
    riskProfile: { ranking: 0.15, traffic: 0.1, penalty: 0.05, brand: 0.15, technical: 0.02 },
  },
  'optimize_content': {
    tokenOperations: [TokenOperationType.CONTENT_OPTIMIZATION, TokenOperationType.META_GENERATION],
    avgPromptTokens: 2500,
    avgCompletionTokens: 1500,
    pagesAffected: 1,
    requiresCrawl: true,
    requiresAudit: false,
    requiresEmbedding: true,
    engineeringHours: 0.5,
    contentHours: 2,
    reviewHours: 0.5,
    complexity: 'medium',
    skills: ['SEO', 'content optimization'],
    riskProfile: { ranking: 0.2, traffic: 0.15, penalty: 0.1, brand: 0.1, technical: 0.02 },
  },
  'fix_technical_issue': {
    tokenOperations: [TokenOperationType.SCHEMA_GENERATION],
    avgPromptTokens: 500,
    avgCompletionTokens: 500,
    pagesAffected: 10,
    requiresCrawl: true,
    requiresAudit: true,
    requiresEmbedding: false,
    engineeringHours: 4,
    contentHours: 0,
    reviewHours: 1,
    complexity: 'high',
    skills: ['web development', 'technical SEO'],
    riskProfile: { ranking: 0.05, traffic: 0.05, penalty: 0.02, brand: 0.02, technical: 0.3 },
  },
  'improve_page_speed': {
    tokenOperations: [],
    avgPromptTokens: 200,
    avgCompletionTokens: 200,
    pagesAffected: 20,
    requiresCrawl: true,
    requiresAudit: true,
    requiresEmbedding: false,
    engineeringHours: 6,
    contentHours: 0,
    reviewHours: 2,
    complexity: 'high',
    skills: ['web development', 'performance optimization'],
    riskProfile: { ranking: 0.02, traffic: 0.02, penalty: 0.01, brand: 0.01, technical: 0.25 },
  },
  'fix_schema_markup': {
    tokenOperations: [TokenOperationType.SCHEMA_GENERATION],
    avgPromptTokens: 800,
    avgCompletionTokens: 1200,
    pagesAffected: 5,
    requiresCrawl: true,
    requiresAudit: true,
    requiresEmbedding: false,
    engineeringHours: 2,
    contentHours: 0,
    reviewHours: 0.5,
    complexity: 'medium',
    skills: ['technical SEO', 'structured data'],
    riskProfile: { ranking: 0.05, traffic: 0.02, penalty: 0.02, brand: 0.02, technical: 0.15 },
  },
  'add_internal_link': {
    tokenOperations: [TokenOperationType.CONTENT_ANALYSIS],
    avgPromptTokens: 500,
    avgCompletionTokens: 300,
    pagesAffected: 2,
    requiresCrawl: true,
    requiresAudit: false,
    requiresEmbedding: false,
    engineeringHours: 0.5,
    contentHours: 0.5,
    reviewHours: 0.25,
    complexity: 'low',
    skills: ['SEO', 'content'],
    riskProfile: { ranking: 0.05, traffic: 0.02, penalty: 0.02, brand: 0.02, technical: 0.02 },
  },
  'optimize_anchor_text': {
    tokenOperations: [TokenOperationType.CONTENT_OPTIMIZATION],
    avgPromptTokens: 400,
    avgCompletionTokens: 200,
    pagesAffected: 1,
    requiresCrawl: true,
    requiresAudit: false,
    requiresEmbedding: false,
    engineeringHours: 0.25,
    contentHours: 0.5,
    reviewHours: 0.25,
    complexity: 'low',
    skills: ['SEO'],
    riskProfile: { ranking: 0.1, traffic: 0.05, penalty: 0.15, brand: 0.05, technical: 0.01 },
  },
  'target_new_keyword': {
    tokenOperations: [TokenOperationType.KEYWORD_RESEARCH, TokenOperationType.CONTENT_OPTIMIZATION],
    avgPromptTokens: 1500,
    avgCompletionTokens: 1000,
    pagesAffected: 1,
    requiresCrawl: true,
    requiresAudit: false,
    requiresEmbedding: true,
    engineeringHours: 0.5,
    contentHours: 2,
    reviewHours: 0.5,
    complexity: 'medium',
    skills: ['SEO', 'keyword research', 'content'],
    riskProfile: { ranking: 0.2, traffic: 0.15, penalty: 0.1, brand: 0.1, technical: 0.02 },
  },
  'improve_keyword_ranking': {
    tokenOperations: [TokenOperationType.KEYWORD_RESEARCH, TokenOperationType.CONTENT_OPTIMIZATION],
    avgPromptTokens: 2000,
    avgCompletionTokens: 1500,
    pagesAffected: 1,
    requiresCrawl: true,
    requiresAudit: false,
    requiresEmbedding: true,
    engineeringHours: 1,
    contentHours: 3,
    reviewHours: 0.5,
    complexity: 'high',
    skills: ['SEO', 'content optimization', 'keyword research'],
    riskProfile: { ranking: 0.25, traffic: 0.2, penalty: 0.15, brand: 0.1, technical: 0.02 },
  },
  'competitor_analysis': {
    tokenOperations: [TokenOperationType.COMPETITOR_ANALYSIS],
    avgPromptTokens: 3000,
    avgCompletionTokens: 2000,
    pagesAffected: 0,
    requiresCrawl: true,
    requiresAudit: false,
    requiresEmbedding: true,
    engineeringHours: 0.5,
    contentHours: 0,
    reviewHours: 1,
    complexity: 'medium',
    skills: ['SEO', 'analysis'],
    riskProfile: { ranking: 0.0, traffic: 0.0, penalty: 0.0, brand: 0.0, technical: 0.0 },
  },
  'set_up_alert': {
    tokenOperations: [],
    avgPromptTokens: 100,
    avgCompletionTokens: 100,
    pagesAffected: 0,
    requiresCrawl: false,
    requiresAudit: false,
    requiresEmbedding: false,
    engineeringHours: 0.5,
    contentHours: 0,
    reviewHours: 0,
    complexity: 'low',
    skills: ['monitoring'],
    riskProfile: { ranking: 0.0, traffic: 0.0, penalty: 0.0, brand: 0.0, technical: 0.02 },
  },
  'investigate_anomaly': {
    tokenOperations: [TokenOperationType.CONTENT_ANALYSIS],
    avgPromptTokens: 1000,
    avgCompletionTokens: 500,
    pagesAffected: 5,
    requiresCrawl: true,
    requiresAudit: true,
    requiresEmbedding: false,
    engineeringHours: 2,
    contentHours: 0,
    reviewHours: 0.5,
    complexity: 'medium',
    skills: ['SEO', 'analysis', 'debugging'],
    riskProfile: { ranking: 0.0, traffic: 0.0, penalty: 0.0, brand: 0.0, technical: 0.05 },
  },
};

const DEFAULT_PROFILE: ActionOperationProfile = {
  tokenOperations: [TokenOperationType.CONTENT_ANALYSIS],
  avgPromptTokens: 1000,
  avgCompletionTokens: 500,
  pagesAffected: 1,
  requiresCrawl: true,
  requiresAudit: false,
  requiresEmbedding: false,
  engineeringHours: 2,
  contentHours: 1,
  reviewHours: 0.5,
  complexity: 'medium',
  skills: ['SEO'],
  riskProfile: { ranking: 0.1, traffic: 0.1, penalty: 0.05, brand: 0.05, technical: 0.1 },
};

// ============================================================================
// TOKEN COST ESTIMATOR
// ============================================================================

export class TokenCostEstimator {
  private config: CostOptimizationConfig;
  private heuristics: Map<string, CostHeuristics>;
  
  constructor(config: CostOptimizationConfig = DEFAULT_COST_OPTIMIZATION_CONFIG) {
    this.config = config;
    this.heuristics = new Map();
  }
  
  /**
   * Update heuristics from historical data
   */
  updateHeuristics(heuristics: CostHeuristics[]): void {
    for (const h of heuristics) {
      this.heuristics.set(h.actionType, h);
    }
  }
  
  /**
   * Estimate token cost for an action
   */
  estimate(actionType: string, model: string = 'default'): { cost: TokenCost; assumptions: CostAssumption[] } {
    const profile = ACTION_OPERATION_PROFILES[actionType] || DEFAULT_PROFILE;
    const heuristic = this.heuristics.get(actionType);
    const assumptions: CostAssumption[] = [];
    
    // Use heuristics if available, otherwise use profile
    let promptTokens = profile.avgPromptTokens;
    let completionTokens = profile.avgCompletionTokens;
    
    if (heuristic && heuristic.confidence !== 'low') {
      promptTokens = heuristic.avgPromptTokens;
      completionTokens = heuristic.avgCompletionTokens;
      assumptions.push({
        id: `token-heuristic-${actionType}`,
        category: CostCategory.TOKEN,
        description: `Token estimate calibrated from ${heuristic.sampleSize} historical executions`,
        value: promptTokens + completionTokens,
        basis: `Historical average with ${heuristic.confidence} confidence`,
        confidence: heuristic.confidence,
      });
    } else {
      assumptions.push({
        id: `token-profile-${actionType}`,
        category: CostCategory.TOKEN,
        description: `Token estimate based on action type profile`,
        value: promptTokens + completionTokens,
        basis: `Default profile for ${actionType}`,
        confidence: 'medium',
      });
    }
    
    const totalTokens = promptTokens + completionTokens;
    const rate = this.config.tokenCostRates[model] || this.config.tokenCostRates['default'];
    const estimatedCost = (totalTokens / 1000) * rate;
    
    assumptions.push({
      id: `token-rate-${model}`,
      category: CostCategory.TOKEN,
      description: `Token cost rate for model ${model}`,
      value: rate,
      basis: `Configured rate: ${rate} per 1K tokens`,
      confidence: 'high',
    });
    
    return {
      cost: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        model,
        operationType: profile.tokenOperations[0] || TokenOperationType.CONTENT_ANALYSIS,
      },
      assumptions,
    };
  }
}

// ============================================================================
// COMPUTE COST ESTIMATOR
// ============================================================================

export class ComputeCostEstimator {
  private config: CostOptimizationConfig;
  
  constructor(config: CostOptimizationConfig = DEFAULT_COST_OPTIMIZATION_CONFIG) {
    this.config = config;
  }
  
  /**
   * Estimate compute cost for an action
   */
  estimate(actionType: string, pageCount?: number): { cost: ComputeCost; assumptions: CostAssumption[] } {
    const profile = ACTION_OPERATION_PROFILES[actionType] || DEFAULT_PROFILE;
    const assumptions: CostAssumption[] = [];
    const rates = this.config.computeCostRates;
    
    const pages = pageCount ?? profile.pagesAffected;
    
    // Calculate individual costs
    const crawlCost = profile.requiresCrawl ? pages * rates.crawlPerPage : 0;
    const auditCost = profile.requiresAudit ? pages * rates.auditPerPage : 0;
    const embeddingCost = profile.requiresEmbedding ? pages * rates.embeddingPerPage : 0;
    const processingCost = pages * 0.1 * rates.processingPerMB; // Assume 0.1MB per page
    const storageCost = pages * 0.01; // Minimal storage cost
    
    const totalCost = crawlCost + auditCost + embeddingCost + processingCost + storageCost;
    
    // Estimate duration (rough heuristic)
    const estimatedDurationMs = 
      (profile.requiresCrawl ? pages * 500 : 0) +
      (profile.requiresAudit ? pages * 2000 : 0) +
      (profile.requiresEmbedding ? pages * 1000 : 0) +
      pages * 100; // Base processing
    
    assumptions.push({
      id: `compute-pages-${actionType}`,
      category: CostCategory.COMPUTE,
      description: `Estimated ${pages} pages affected by action`,
      value: pages,
      basis: pageCount ? 'User specified' : `Default for ${actionType}`,
      confidence: pageCount ? 'high' : 'medium',
    });
    
    if (crawlCost > 0) {
      assumptions.push({
        id: `compute-crawl-${actionType}`,
        category: CostCategory.COMPUTE,
        description: `Crawl cost: ${crawlCost.toFixed(2)} units`,
        value: crawlCost,
        basis: `${pages} pages × ${rates.crawlPerPage} per page`,
        confidence: 'high',
      });
    }
    
    if (auditCost > 0) {
      assumptions.push({
        id: `compute-audit-${actionType}`,
        category: CostCategory.COMPUTE,
        description: `Audit cost: ${auditCost.toFixed(2)} units`,
        value: auditCost,
        basis: `${pages} pages × ${rates.auditPerPage} per page`,
        confidence: 'high',
      });
    }
    
    return {
      cost: {
        crawlCost,
        auditCost,
        embeddingCost,
        processingCost,
        storageCost,
        totalCost,
        estimatedDurationMs,
      },
      assumptions,
    };
  }
}

// ============================================================================
// EFFORT COST ESTIMATOR
// ============================================================================

export class EffortCostEstimator {
  private config: CostOptimizationConfig;
  private heuristics: Map<string, CostHeuristics>;
  
  constructor(config: CostOptimizationConfig = DEFAULT_COST_OPTIMIZATION_CONFIG) {
    this.config = config;
    this.heuristics = new Map();
  }
  
  /**
   * Update heuristics from historical data
   */
  updateHeuristics(heuristics: CostHeuristics[]): void {
    for (const h of heuristics) {
      this.heuristics.set(h.actionType, h);
    }
  }
  
  /**
   * Estimate effort cost for an action
   */
  estimate(actionType: string, scopeMultiplier: number = 1.0): { cost: EffortCost; assumptions: CostAssumption[] } {
    const profile = ACTION_OPERATION_PROFILES[actionType] || DEFAULT_PROFILE;
    const heuristic = this.heuristics.get(actionType);
    const assumptions: CostAssumption[] = [];
    const multipliers = this.config.effortMultipliers;
    
    // Base hours from profile
    let engineeringHours = profile.engineeringHours * scopeMultiplier;
    let contentHours = profile.contentHours * scopeMultiplier;
    let reviewHours = profile.reviewHours * scopeMultiplier;
    
    // Apply heuristic adjustment if available
    if (heuristic && heuristic.confidence !== 'low') {
      const totalFromHeuristic = heuristic.avgEffortHours;
      const totalFromProfile = profile.engineeringHours + profile.contentHours + profile.reviewHours;
      const adjustmentRatio = totalFromHeuristic / totalFromProfile;
      
      engineeringHours *= adjustmentRatio;
      contentHours *= adjustmentRatio;
      reviewHours *= adjustmentRatio;
      
      assumptions.push({
        id: `effort-heuristic-${actionType}`,
        category: CostCategory.EFFORT,
        description: `Effort estimate adjusted by ${(adjustmentRatio * 100).toFixed(0)}% based on historical data`,
        value: adjustmentRatio,
        basis: `${heuristic.sampleSize} historical executions`,
        confidence: heuristic.confidence,
      });
    }
    
    // Coordination overhead (10-30% based on complexity)
    const coordinationPercent = profile.complexity === 'very_high' ? 0.3 :
                                profile.complexity === 'high' ? 0.2 :
                                profile.complexity === 'medium' ? 0.15 : 0.1;
    const coordinationHours = (engineeringHours + contentHours) * coordinationPercent;
    
    const totalHours = engineeringHours + contentHours + reviewHours + coordinationHours;
    
    assumptions.push({
      id: `effort-breakdown-${actionType}`,
      category: CostCategory.EFFORT,
      description: `Effort breakdown: ${engineeringHours.toFixed(1)}h eng, ${contentHours.toFixed(1)}h content, ${reviewHours.toFixed(1)}h review, ${coordinationHours.toFixed(1)}h coord`,
      value: totalHours,
      basis: `Profile for ${actionType} × scope ${scopeMultiplier.toFixed(1)}`,
      confidence: heuristic?.confidence || 'medium',
    });
    
    assumptions.push({
      id: `effort-complexity-${actionType}`,
      category: CostCategory.EFFORT,
      description: `Complexity: ${profile.complexity}`,
      value: coordinationPercent,
      basis: `${(coordinationPercent * 100).toFixed(0)}% coordination overhead`,
      confidence: 'high',
    });
    
    return {
      cost: {
        engineeringHours,
        contentHours,
        reviewHours,
        coordinationHours,
        totalHours,
        skillsRequired: profile.skills,
        complexity: profile.complexity,
      },
      assumptions,
    };
  }
}

// ============================================================================
// RISK COST ESTIMATOR
// ============================================================================

export class RiskCostEstimator {
  private config: CostOptimizationConfig;
  
  constructor(config: CostOptimizationConfig = DEFAULT_COST_OPTIMIZATION_CONFIG) {
    this.config = config;
  }
  
  /**
   * Estimate risk cost for an action
   */
  estimate(
    actionType: string,
    currentMetrics: {
      monthlyTraffic?: number;
      avgPosition?: number;
      brandScore?: number;
    } = {}
  ): { cost: RiskCost; assumptions: CostAssumption[] } {
    const profile = ACTION_OPERATION_PROFILES[actionType] || DEFAULT_PROFILE;
    const assumptions: CostAssumption[] = [];
    const weights = this.config.riskCostWeights;
    
    const riskProfile = profile.riskProfile;
    const traffic = currentMetrics.monthlyTraffic || 10000;
    const position = currentMetrics.avgPosition || 10;
    
    // Calculate individual risk costs
    // Risk cost = probability × impact × weight
    const rankingRiskCost = riskProfile.ranking * (50 - position) * weights.ranking;
    const trafficRiskCost = riskProfile.traffic * (traffic / 1000) * weights.traffic;
    const penaltyRiskCost = riskProfile.penalty * 100 * weights.penalty; // High fixed cost for penalties
    const brandRiskCost = riskProfile.brand * 20 * weights.brand;
    const technicalRiskCost = riskProfile.technical * 30 * weights.technical;
    
    const totalRiskCost = rankingRiskCost + trafficRiskCost + penaltyRiskCost + brandRiskCost + technicalRiskCost;
    
    // Overall risk probability (max of individual probabilities)
    const riskProbability = Math.max(
      riskProfile.ranking,
      riskProfile.traffic,
      riskProfile.penalty,
      riskProfile.brand,
      riskProfile.technical
    );
    
    const expectedLoss = totalRiskCost * riskProbability;
    
    assumptions.push({
      id: `risk-profile-${actionType}`,
      category: CostCategory.RISK,
      description: `Risk profile for ${actionType}`,
      value: riskProbability,
      basis: `Max risk probability: ${(riskProbability * 100).toFixed(0)}%`,
      confidence: 'medium',
    });
    
    assumptions.push({
      id: `risk-breakdown-${actionType}`,
      category: CostCategory.RISK,
      description: `Expected loss: ${expectedLoss.toFixed(1)} units`,
      value: expectedLoss,
      basis: `Total risk cost ${totalRiskCost.toFixed(1)} × probability ${(riskProbability * 100).toFixed(0)}%`,
      confidence: 'medium',
    });
    
    if (penaltyRiskCost > 10) {
      assumptions.push({
        id: `risk-penalty-warning-${actionType}`,
        category: CostCategory.RISK,
        description: `Elevated penalty risk: ${(riskProfile.penalty * 100).toFixed(0)}% probability`,
        value: penaltyRiskCost,
        basis: 'Actions affecting anchor text or keyword density have higher penalty risk',
        confidence: 'medium',
      });
    }
    
    return {
      cost: {
        rankingRiskCost,
        trafficRiskCost,
        penaltyRiskCost,
        brandRiskCost,
        technicalRiskCost,
        totalRiskCost,
        riskProbability,
        expectedLoss,
      },
      assumptions,
    };
  }
}

// ============================================================================
// UNIFIED COST ESTIMATOR
// ============================================================================

export interface SEOActionInput {
  id: string;
  type: string;
  title: string;
  targetUrl?: string;
  pageCount?: number;
  scopeMultiplier?: number;
  model?: string;
  currentMetrics?: {
    monthlyTraffic?: number;
    avgPosition?: number;
    brandScore?: number;
  };
}

export class CostEstimator {
  private tokenEstimator: TokenCostEstimator;
  private computeEstimator: ComputeCostEstimator;
  private effortEstimator: EffortCostEstimator;
  private riskEstimator: RiskCostEstimator;
  private config: CostOptimizationConfig;
  
  constructor(config: CostOptimizationConfig = DEFAULT_COST_OPTIMIZATION_CONFIG) {
    this.config = config;
    this.tokenEstimator = new TokenCostEstimator(config);
    this.computeEstimator = new ComputeCostEstimator(config);
    this.effortEstimator = new EffortCostEstimator(config);
    this.riskEstimator = new RiskCostEstimator(config);
  }
  
  /**
   * Update heuristics from historical feedback
   */
  updateHeuristics(heuristics: CostHeuristics[]): void {
    this.tokenEstimator.updateHeuristics(heuristics);
    this.effortEstimator.updateHeuristics(heuristics);
  }
  
  /**
   * Estimate complete cost breakdown for an action
   */
  estimateActionCost(action: SEOActionInput): ActionCostBreakdown {
    // Get individual cost estimates
    const { cost: tokenCost, assumptions: tokenAssumptions } = 
      this.tokenEstimator.estimate(action.type, action.model);
    
    const { cost: computeCost, assumptions: computeAssumptions } = 
      this.computeEstimator.estimate(action.type, action.pageCount);
    
    const { cost: effortCost, assumptions: effortAssumptions } = 
      this.effortEstimator.estimate(action.type, action.scopeMultiplier);
    
    const { cost: riskCost, assumptions: riskAssumptions } = 
      this.riskEstimator.estimate(action.type, action.currentMetrics);
    
    // Combine assumptions
    const assumptions = [
      ...tokenAssumptions,
      ...computeAssumptions,
      ...effortAssumptions,
      ...riskAssumptions,
    ];
    
    // Calculate normalized costs per category
    const costPerCategory: Record<CostCategory, number> = {
      [CostCategory.TOKEN]: tokenCost.estimatedCost,
      [CostCategory.COMPUTE]: computeCost.totalCost,
      [CostCategory.EFFORT]: effortCost.totalHours * 10, // Convert hours to cost units
      [CostCategory.RISK]: riskCost.expectedLoss,
    };
    
    // Calculate total normalized cost (0-100 scale)
    const rawTotal = Object.values(costPerCategory).reduce((sum, c) => sum + c, 0);
    const totalCost = Math.min(100, rawTotal); // Cap at 100
    
    return {
      actionId: action.id,
      actionType: action.type,
      tokenCost,
      computeCost,
      effortCost,
      riskCost,
      totalCost,
      costPerCategory,
      assumptions,
      estimatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Estimate costs for multiple actions
   */
  estimateMultipleActions(actions: SEOActionInput[]): Map<string, ActionCostBreakdown> {
    const results = new Map<string, ActionCostBreakdown>();
    
    for (const action of actions) {
      results.set(action.id, this.estimateActionCost(action));
    }
    
    return results;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createCostEstimator(
  config?: Partial<CostOptimizationConfig>
): CostEstimator {
  const fullConfig = { ...DEFAULT_COST_OPTIMIZATION_CONFIG, ...config };
  return new CostEstimator(fullConfig);
}
