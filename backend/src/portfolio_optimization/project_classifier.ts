/**
 * Project Classifier v1.7
 * 
 * Classifies projects by growth potential, stability, and risk exposure.
 * 
 * Classification Buckets:
 * - INVEST: High ROI, high upside - increase investment
 * - MAINTAIN: Stable, predictable - maintain current allocation
 * - OPTIMIZE_CAUTIOUSLY: Medium ROI, higher risk - proceed with caution
 * - OBSERVE: Low ROI, low priority - minimal investment
 * - TURNAROUND: Needs intervention - potential with right investment
 * - SUNSET: Consider winding down
 * 
 * Design Principles:
 * - Deterministic classification rules
 * - Explainable classification factors
 * - Consider alternative classifications
 * - No forced decisions
 */

import {
  ProjectMetrics,
  NormalizedProjectMetrics,
  ProjectClassification,
  ProjectClassificationResult,
  ClassificationFactor,
  AlternativeClassification,
  ClassificationCriteria,
  PortfolioOptimizationConfig,
  DEFAULT_PORTFOLIO_CONFIG,
} from './models';

// ============================================================================
// CLASSIFICATION WEIGHTS
// ============================================================================

interface ClassificationWeights {
  roiWeight: number;
  growthWeight: number;
  stabilityWeight: number;
  riskWeight: number;
  potentialWeight: number;
  efficiencyWeight: number;
}

const DEFAULT_WEIGHTS: ClassificationWeights = {
  roiWeight: 0.25,
  growthWeight: 0.20,
  stabilityWeight: 0.15,
  riskWeight: 0.20,
  potentialWeight: 0.10,
  efficiencyWeight: 0.10,
};

// ============================================================================
// PROJECT CLASSIFIER
// ============================================================================

/**
 * Classifies projects into strategic buckets
 */
export class ProjectClassifier {
  private config: PortfolioOptimizationConfig;
  private weights: ClassificationWeights;
  private logger: Console;
  
  constructor(
    config: Partial<PortfolioOptimizationConfig> = {},
    weights: Partial<ClassificationWeights> = {}
  ) {
    this.config = { ...DEFAULT_PORTFOLIO_CONFIG, ...config };
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.logger = console;
  }
  
  // ==========================================================================
  // MAIN CLASSIFICATION
  // ==========================================================================
  
  /**
   * Classify all projects in the portfolio
   */
  classifyPortfolio(
    projects: ProjectMetrics[],
    normalizedMetrics: NormalizedProjectMetrics[]
  ): ProjectClassificationResult[] {
    if (this.config.enableDetailedLogging) {
      this.logger.log(`[ProjectClassifier] Classifying ${projects.length} projects`);
    }
    
    const results: ProjectClassificationResult[] = [];
    
    for (const project of projects) {
      const normalized = normalizedMetrics.find(n => n.projectId === project.projectId);
      if (!normalized) {
        this.logger.warn(`[ProjectClassifier] No normalized metrics for project ${project.projectId}`);
        continue;
      }
      
      const result = this.classifyProject(project, normalized);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Classify a single project
   */
  classifyProject(
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): ProjectClassificationResult {
    // Calculate classification scores for each bucket
    const scores = this.calculateClassificationScores(project, normalized);
    
    // Determine primary classification
    const { classification, confidence } = this.determineClassification(scores, project, normalized);
    
    // Extract classification factors
    const { primaryFactors, secondaryFactors } = this.extractClassificationFactors(
      classification,
      project,
      normalized
    );
    
    // Identify alternative classifications
    const alternatives = this.identifyAlternatives(scores, classification, project, normalized);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(classification, project, normalized);
    
    return {
      projectId: project.projectId,
      classification,
      confidence,
      primaryFactors,
      secondaryFactors,
      alternativeClassifications: alternatives,
      recommendation,
      classifiedAt: new Date().toISOString(),
    };
  }
  
  // ==========================================================================
  // CLASSIFICATION SCORES
  // ==========================================================================
  
  private calculateClassificationScores(
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): Record<ProjectClassification, number> {
    const criteria = this.config.classificationCriteria;
    
    return {
      [ProjectClassification.INVEST]: this.calculateInvestScore(normalized, criteria),
      [ProjectClassification.MAINTAIN]: this.calculateMaintainScore(normalized, criteria),
      [ProjectClassification.OPTIMIZE_CAUTIOUSLY]: this.calculateOptimizeCautiouslyScore(normalized, criteria),
      [ProjectClassification.OBSERVE]: this.calculateObserveScore(normalized, criteria),
      [ProjectClassification.TURNAROUND]: this.calculateTurnaroundScore(normalized, criteria),
      [ProjectClassification.SUNSET]: this.calculateSunsetScore(project, normalized),
    };
  }
  
  private calculateInvestScore(
    normalized: NormalizedProjectMetrics,
    criteria: ClassificationCriteria
  ): number {
    const thresholds = criteria.investThresholds;
    
    let score = 0;
    let maxScore = 0;
    
    // ROI above threshold (weight: 40%)
    maxScore += 40;
    if (normalized.roiScore >= thresholds.minROI) {
      score += 40 * (normalized.roiScore / 100);
    }
    
    // Growth score above threshold (weight: 35%)
    maxScore += 35;
    if (normalized.growthScore >= thresholds.minGrowthScore) {
      score += 35 * (normalized.growthScore / 100);
    }
    
    // Risk below threshold (weight: 25%)
    maxScore += 25;
    if (normalized.riskScore <= thresholds.maxRiskScore) {
      score += 25 * ((100 - normalized.riskScore) / 100);
    }
    
    return (score / maxScore) * 100;
  }
  
  private calculateMaintainScore(
    normalized: NormalizedProjectMetrics,
    criteria: ClassificationCriteria
  ): number {
    const thresholds = criteria.maintainThresholds;
    
    let score = 0;
    let maxScore = 0;
    
    // Stability above threshold (weight: 40%)
    maxScore += 40;
    if (normalized.stabilityScore >= thresholds.minStabilityScore) {
      score += 40 * (normalized.stabilityScore / 100);
    }
    
    // Moderate ROI (weight: 30%)
    maxScore += 30;
    if (normalized.roiScore >= thresholds.minROI && normalized.roiScore <= 80) {
      score += 30 * (normalized.roiScore / 80);
    }
    
    // Risk below threshold (weight: 30%)
    maxScore += 30;
    if (normalized.riskScore <= thresholds.maxRiskScore) {
      score += 30 * ((100 - normalized.riskScore) / 100);
    }
    
    return (score / maxScore) * 100;
  }
  
  private calculateOptimizeCautiouslyScore(
    normalized: NormalizedProjectMetrics,
    criteria: ClassificationCriteria
  ): number {
    const thresholds = criteria.optimizeCautiouslyThresholds;
    
    let score = 0;
    let maxScore = 0;
    
    // ROI in medium range (weight: 40%)
    maxScore += 40;
    if (normalized.roiScore >= thresholds.minROI && normalized.roiScore <= thresholds.maxROI) {
      score += 40;
    } else if (normalized.roiScore > thresholds.maxROI) {
      score += 20; // Some score for high ROI but elevated risk
    }
    
    // Elevated risk (weight: 35%)
    maxScore += 35;
    if (normalized.riskScore >= thresholds.minRiskScore) {
      score += 35 * (normalized.riskScore / 100);
    }
    
    // Some growth potential (weight: 25%)
    maxScore += 25;
    if (normalized.potentialScore > 30) {
      score += 25 * (normalized.potentialScore / 100);
    }
    
    return (score / maxScore) * 100;
  }
  
  private calculateObserveScore(
    normalized: NormalizedProjectMetrics,
    criteria: ClassificationCriteria
  ): number {
    const thresholds = criteria.observeThresholds;
    
    let score = 0;
    let maxScore = 0;
    
    // Low ROI (weight: 50%)
    maxScore += 50;
    if (normalized.roiScore <= thresholds.maxROI) {
      score += 50 * ((thresholds.maxROI - normalized.roiScore) / thresholds.maxROI);
    }
    
    // Low growth potential (weight: 30%)
    maxScore += 30;
    if (normalized.growthScore <= thresholds.maxGrowthScore) {
      score += 30 * ((thresholds.maxGrowthScore - normalized.growthScore) / thresholds.maxGrowthScore);
    }
    
    // Low overall score (weight: 20%)
    maxScore += 20;
    if (normalized.overallScore <= 40) {
      score += 20;
    }
    
    return (score / maxScore) * 100;
  }
  
  private calculateTurnaroundScore(
    normalized: NormalizedProjectMetrics,
    criteria: ClassificationCriteria
  ): number {
    const thresholds = criteria.turnaroundThresholds;
    
    let score = 0;
    let maxScore = 0;
    
    // High potential despite poor current state (weight: 50%)
    maxScore += 50;
    if (normalized.potentialScore >= thresholds.minPotentialScore) {
      score += 50 * (normalized.potentialScore / 100);
    }
    
    // Poor current performance (weight: 30%)
    maxScore += 30;
    if (normalized.overallScore <= thresholds.maxCurrentScore) {
      score += 30;
    }
    
    // Some efficiency opportunity (weight: 20%)
    maxScore += 20;
    if (normalized.efficiencyScore < 50 && normalized.potentialScore > 50) {
      score += 20;
    }
    
    return (score / maxScore) * 100;
  }
  
  private calculateSunsetScore(
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): number {
    let score = 0;
    let maxScore = 0;
    
    // Very low ROI (weight: 30%)
    maxScore += 30;
    if (normalized.roiScore < 20) {
      score += 30;
    }
    
    // Declining traffic (weight: 25%)
    maxScore += 25;
    if (project.traffic.trafficTrend === 'declining') {
      score += 25;
    }
    
    // High risk (weight: 25%)
    maxScore += 25;
    if (normalized.riskScore > 70) {
      score += 25;
    }
    
    // Low potential (weight: 20%)
    maxScore += 20;
    if (normalized.potentialScore < 20) {
      score += 20;
    }
    
    return (score / maxScore) * 100;
  }
  
  // ==========================================================================
  // CLASSIFICATION DETERMINATION
  // ==========================================================================
  
  private determineClassification(
    scores: Record<ProjectClassification, number>,
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): { classification: ProjectClassification; confidence: number } {
    // Sort classifications by score
    const sortedClassifications = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([classification, score]) => ({
        classification: classification as ProjectClassification,
        score,
      }));
    
    const top = sortedClassifications[0];
    const second = sortedClassifications[1];
    
    // Calculate confidence based on margin between top two
    const margin = top.score - second.score;
    let confidence = Math.min(1, margin / 50 + 0.5);
    
    // Adjust confidence based on data quality
    if (project.dataQuality === 'low') {
      confidence *= 0.7;
    } else if (project.dataQuality === 'medium') {
      confidence *= 0.85;
    }
    
    // Apply hard rules that override scores
    const overrideResult = this.applyHardRules(top.classification, project, normalized);
    if (overrideResult) {
      return overrideResult;
    }
    
    return {
      classification: top.classification,
      confidence: Math.round(confidence * 100) / 100,
    };
  }
  
  private applyHardRules(
    tentativeClassification: ProjectClassification,
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): { classification: ProjectClassification; confidence: number } | null {
    // Rule 1: Critical issues force OPTIMIZE_CAUTIOUSLY or lower
    if (project.risk.criticalIssuesCount >= 5 && 
        tentativeClassification === ProjectClassification.INVEST) {
      return {
        classification: ProjectClassification.OPTIMIZE_CAUTIOUSLY,
        confidence: 0.8,
      };
    }
    
    // Rule 2: Very high penalty risk forces caution
    if (project.risk.penaltyRisk > 0.7 &&
        tentativeClassification === ProjectClassification.INVEST) {
      return {
        classification: ProjectClassification.OPTIMIZE_CAUTIOUSLY,
        confidence: 0.85,
      };
    }
    
    // Rule 3: Zero traffic projects are TURNAROUND or SUNSET
    if (project.traffic.currentMonthlyTraffic === 0 &&
        [ProjectClassification.INVEST, ProjectClassification.MAINTAIN].includes(tentativeClassification)) {
      return {
        classification: normalized.potentialScore > 50 
          ? ProjectClassification.TURNAROUND 
          : ProjectClassification.OBSERVE,
        confidence: 0.7,
      };
    }
    
    return null;
  }
  
  // ==========================================================================
  // CLASSIFICATION FACTORS
  // ==========================================================================
  
  private extractClassificationFactors(
    classification: ProjectClassification,
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): { primaryFactors: ClassificationFactor[]; secondaryFactors: ClassificationFactor[] } {
    const allFactors: ClassificationFactor[] = [];
    const criteria = this.config.classificationCriteria;
    
    // ROI Factor
    allFactors.push({
      factor: 'ROI Score',
      value: normalized.roiScore,
      threshold: this.getThresholdForClassification(classification, 'roi', criteria),
      direction: normalized.roiScore >= 50 ? 'above' : 'below',
      weight: this.weights.roiWeight,
      explanation: this.explainROIFactor(normalized.roiScore, project.roi),
    });
    
    // Growth Factor
    allFactors.push({
      factor: 'Growth Score',
      value: normalized.growthScore,
      threshold: this.getThresholdForClassification(classification, 'growth', criteria),
      direction: normalized.growthScore >= 50 ? 'above' : 'below',
      weight: this.weights.growthWeight,
      explanation: this.explainGrowthFactor(normalized.growthScore, project.traffic),
    });
    
    // Risk Factor
    allFactors.push({
      factor: 'Risk Score',
      value: normalized.riskScore,
      threshold: this.getThresholdForClassification(classification, 'risk', criteria),
      direction: normalized.riskScore <= 50 ? 'below' : 'above',
      weight: this.weights.riskWeight,
      explanation: this.explainRiskFactor(normalized.riskScore, project.risk),
    });
    
    // Stability Factor
    allFactors.push({
      factor: 'Stability Score',
      value: normalized.stabilityScore,
      threshold: 50,
      direction: normalized.stabilityScore >= 50 ? 'above' : 'below',
      weight: this.weights.stabilityWeight,
      explanation: this.explainStabilityFactor(normalized.stabilityScore),
    });
    
    // Potential Factor
    allFactors.push({
      factor: 'Potential Score',
      value: normalized.potentialScore,
      threshold: 50,
      direction: normalized.potentialScore >= 50 ? 'above' : 'below',
      weight: this.weights.potentialWeight,
      explanation: this.explainPotentialFactor(normalized.potentialScore, project.projections),
    });
    
    // Sort by weight
    const sorted = allFactors.sort((a, b) => b.weight - a.weight);
    
    return {
      primaryFactors: sorted.slice(0, 3),
      secondaryFactors: sorted.slice(3),
    };
  }
  
  private getThresholdForClassification(
    classification: ProjectClassification,
    metric: 'roi' | 'growth' | 'risk',
    criteria: ClassificationCriteria
  ): number {
    switch (classification) {
      case ProjectClassification.INVEST:
        if (metric === 'roi') return criteria.investThresholds.minROI;
        if (metric === 'growth') return criteria.investThresholds.minGrowthScore;
        if (metric === 'risk') return criteria.investThresholds.maxRiskScore;
        break;
      case ProjectClassification.MAINTAIN:
        if (metric === 'roi') return criteria.maintainThresholds.minROI;
        if (metric === 'risk') return criteria.maintainThresholds.maxRiskScore;
        break;
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY:
        if (metric === 'roi') return criteria.optimizeCautiouslyThresholds.minROI;
        if (metric === 'risk') return criteria.optimizeCautiouslyThresholds.minRiskScore;
        break;
    }
    return 50; // Default threshold
  }
  
  // ==========================================================================
  // FACTOR EXPLANATIONS
  // ==========================================================================
  
  private explainROIFactor(score: number, roi: ProjectMetrics['roi']): string {
    if (score >= 70) {
      return `Strong ROI performance with ${roi.actionSuccessRate.toFixed(0)}% action success rate and ${roi.portfolioROI.toFixed(1)}% portfolio ROI`;
    } else if (score >= 40) {
      return `Moderate ROI with ${roi.portfolioROI.toFixed(1)}% portfolio ROI and room for improvement`;
    } else {
      return `Low ROI performance with only ${roi.actionSuccessRate.toFixed(0)}% action success rate`;
    }
  }
  
  private explainGrowthFactor(score: number, traffic: ProjectMetrics['traffic']): string {
    const trend = traffic.trafficTrend;
    const rate = traffic.trafficGrowthRate;
    
    if (trend === 'growing') {
      return `Traffic is growing at ${rate.toFixed(1)}% with positive momentum`;
    } else if (trend === 'stable') {
      return `Traffic is stable with ${rate.toFixed(1)}% change`;
    } else {
      return `Traffic is declining at ${rate.toFixed(1)}% requiring attention`;
    }
  }
  
  private explainRiskFactor(score: number, risk: ProjectMetrics['risk']): string {
    if (score <= 30) {
      return `Low risk exposure with ${risk.criticalIssuesCount} critical issues and ${(risk.brandComplianceScore).toFixed(0)}% brand compliance`;
    } else if (score <= 60) {
      return `Moderate risk with ${risk.criticalIssuesCount} critical issues requiring monitoring`;
    } else {
      return `High risk exposure with ${(risk.overallRiskScore * 100).toFixed(0)}% risk score and ${risk.criticalIssuesCount} critical issues`;
    }
  }
  
  private explainStabilityFactor(score: number): string {
    if (score >= 70) {
      return 'Highly stable rankings with low volatility';
    } else if (score >= 40) {
      return 'Moderate stability with some ranking fluctuations';
    } else {
      return 'Unstable rankings with high volatility';
    }
  }
  
  private explainPotentialFactor(score: number, projections: ProjectMetrics['projections']): string {
    const growth90d = projections.trafficForecast90d.mid;
    if (score >= 70) {
      return `High growth potential with projected ${growth90d.toFixed(0)} traffic at 90 days`;
    } else if (score >= 40) {
      return `Moderate growth potential with projected ${growth90d.toFixed(0)} traffic at 90 days`;
    } else {
      return `Limited growth potential based on current projections`;
    }
  }
  
  // ==========================================================================
  // ALTERNATIVES
  // ==========================================================================
  
  private identifyAlternatives(
    scores: Record<ProjectClassification, number>,
    primary: ProjectClassification,
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): AlternativeClassification[] {
    const alternatives: AlternativeClassification[] = [];
    
    // Sort by score and get top 3 (excluding primary)
    const sorted = Object.entries(scores)
      .filter(([c]) => c !== primary)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2);
    
    for (const [classification, score] of sorted) {
      const probability = score / 100;
      const condition = this.getAlternativeCondition(
        classification as ProjectClassification,
        primary,
        normalized
      );
      
      alternatives.push({
        classification: classification as ProjectClassification,
        probability: Math.round(probability * 100) / 100,
        condition,
      });
    }
    
    return alternatives;
  }
  
  private getAlternativeCondition(
    alternative: ProjectClassification,
    current: ProjectClassification,
    normalized: NormalizedProjectMetrics
  ): string {
    switch (alternative) {
      case ProjectClassification.INVEST:
        if (current === ProjectClassification.OPTIMIZE_CAUTIOUSLY) {
          return `If risk score decreases below 40 (currently ${normalized.riskScore.toFixed(0)})`;
        }
        return `If ROI score increases above 70 (currently ${normalized.roiScore.toFixed(0)})`;
        
      case ProjectClassification.MAINTAIN:
        return `If stability improves and ROI remains consistent`;
        
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY:
        return `If risk increases or ROI decreases`;
        
      case ProjectClassification.OBSERVE:
        return `If ROI falls below 40 with no improvement in growth`;
        
      case ProjectClassification.TURNAROUND:
        return `If current performance declines but potential remains high`;
        
      case ProjectClassification.SUNSET:
        return `If declining trends continue with no signs of recovery`;
        
      default:
        return 'Based on metric changes';
    }
  }
  
  // ==========================================================================
  // RECOMMENDATIONS
  // ==========================================================================
  
  private generateRecommendation(
    classification: ProjectClassification,
    project: ProjectMetrics,
    normalized: NormalizedProjectMetrics
  ): string {
    switch (classification) {
      case ProjectClassification.INVEST:
        return `Increase investment in ${project.projectName}. Strong ROI (${normalized.roiScore.toFixed(0)}) ` +
          `and growth potential (${normalized.growthScore.toFixed(0)}) justify expanded budget allocation. ` +
          `Consider increasing automation level for faster execution.`;
        
      case ProjectClassification.MAINTAIN:
        return `Maintain current allocation for ${project.projectName}. Stable performance (${normalized.stabilityScore.toFixed(0)}) ` +
          `with acceptable ROI (${normalized.roiScore.toFixed(0)}). Focus on preserving gains and incremental improvements.`;
        
      case ProjectClassification.OPTIMIZE_CAUTIOUSLY:
        return `Proceed with caution on ${project.projectName}. Medium ROI (${normalized.roiScore.toFixed(0)}) ` +
          `but elevated risk (${normalized.riskScore.toFixed(0)}). Reduce automation level and require approval for risky actions.`;
        
      case ProjectClassification.OBSERVE:
        return `Minimize investment in ${project.projectName}. Low ROI (${normalized.roiScore.toFixed(0)}) ` +
          `and limited growth potential (${normalized.growthScore.toFixed(0)}). Monitor for changes but avoid new initiatives.`;
        
      case ProjectClassification.TURNAROUND:
        return `Initiate turnaround for ${project.projectName}. High potential (${normalized.potentialScore.toFixed(0)}) ` +
          `but poor current state. Requires focused intervention with clear milestones and success criteria.`;
        
      case ProjectClassification.SUNSET:
        return `Consider sunsetting ${project.projectName}. Very low ROI (${normalized.roiScore.toFixed(0)}), ` +
          `declining traffic, and limited potential. Evaluate cost of maintenance vs. value generated.`;
        
      default:
        return `Review ${project.projectName} manually for classification.`;
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createProjectClassifier(
  config?: Partial<PortfolioOptimizationConfig>,
  weights?: Partial<ClassificationWeights>
): ProjectClassifier {
  return new ProjectClassifier(config, weights);
}

/**
 * Create a growth-focused classifier
 */
export function createGrowthFocusedClassifier(): ProjectClassifier {
  return new ProjectClassifier({}, {
    roiWeight: 0.20,
    growthWeight: 0.35,
    stabilityWeight: 0.10,
    riskWeight: 0.15,
    potentialWeight: 0.15,
    efficiencyWeight: 0.05,
  });
}

/**
 * Create a risk-averse classifier
 */
export function createRiskAverseClassifier(): ProjectClassifier {
  return new ProjectClassifier({}, {
    roiWeight: 0.20,
    growthWeight: 0.15,
    stabilityWeight: 0.25,
    riskWeight: 0.30,
    potentialWeight: 0.05,
    efficiencyWeight: 0.05,
  });
}
