/**
 * Cost Feedback Updater v1.6
 * 
 * Collects feedback from executed actions to improve cost/value estimates.
 * 
 * Feedback Loop:
 * 1. Record estimated vs actual costs after execution
 * 2. Calculate accuracy metrics
 * 3. Update heuristics for future estimates
 * 
 * Design Principles:
 * - No ML black-box learning
 * - Simple adjustment multipliers
 * - Transparent accuracy tracking
 * - Rolling averages for stability
 */

import {
  CostFeedbackRecord,
  CostHeuristics,
  ActionCostBreakdown,
  ActionValueBreakdown,
} from './models';

// ============================================================================
// FEEDBACK UPDATER
// ============================================================================

export interface ActualCostInput {
  tokenCost?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  effortCost?: {
    totalHours: number;
  };
  computeCost?: {
    totalCost: number;
  };
}

export interface ActualValueInput {
  trafficValue?: {
    expectedVisitors: number;
    trafficUpliftPercent: number;
  };
  rankingValue?: {
    avgPositionImprovement: number;
    keywordsAffected: number;
  };
}

export class CostFeedbackUpdater {
  private feedbackRecords: Map<string, CostFeedbackRecord>;
  private heuristics: Map<string, CostHeuristics>;
  private readonly maxRecordsPerType: number;
  private readonly smoothingFactor: number;
  private logger: Console;
  
  constructor(
    maxRecordsPerType: number = 100,
    smoothingFactor: number = 0.3
  ) {
    this.feedbackRecords = new Map();
    this.heuristics = new Map();
    this.maxRecordsPerType = maxRecordsPerType;
    this.smoothingFactor = smoothingFactor;
    this.logger = console;
  }
  
  /**
   * Record feedback after action execution
   */
  recordFeedback(
    actionId: string,
    actionType: string,
    projectId: string,
    estimatedCost: ActionCostBreakdown,
    actualCost: ActualCostInput,
    estimatedValue: ActionValueBreakdown,
    actualValue: ActualValueInput
  ): CostFeedbackRecord {
    this.logger.log(`[FeedbackUpdater] Recording feedback for action ${actionId}`);
    
    // Calculate accuracy metrics
    const tokenAccuracy = this.calculateTokenAccuracy(estimatedCost, actualCost);
    const computeAccuracy = this.calculateComputeAccuracy(estimatedCost, actualCost);
    const effortAccuracy = this.calculateEffortAccuracy(estimatedCost, actualCost);
    const overallAccuracy = (tokenAccuracy + computeAccuracy + effortAccuracy) / 3;
    
    const valueAccuracy = this.calculateValueAccuracy(estimatedValue, actualValue);
    
    // Calculate ROI accuracy
    const estimatedROI = estimatedCost.totalCost > 0 
      ? estimatedValue.totalValue / estimatedCost.totalCost 
      : 0;
    
    const actualTotalCost = this.calculateActualTotalCost(actualCost);
    const actualTotalValue = this.calculateActualTotalValue(actualValue);
    const actualROI = actualTotalCost > 0 ? actualTotalValue / actualTotalCost : 0;
    const roiAccuracy = estimatedROI > 0 ? actualROI / estimatedROI : 1;
    
    // Calculate adjustment factor
    const adjustmentFactor = this.calculateAdjustmentFactor(overallAccuracy);
    
    const record: CostFeedbackRecord = {
      id: `feedback_${actionId}_${Date.now()}`,
      actionId,
      actionType,
      projectId,
      executedAt: new Date().toISOString(),
      estimatedCost,
      actualCost: {
        tokenCost: actualCost.tokenCost as any,
        effortCost: actualCost.effortCost as any,
        computeCost: actualCost.computeCost as any,
      },
      tokenAccuracy,
      computeAccuracy,
      effortAccuracy,
      overallAccuracy,
      estimatedValue,
      actualValue: {
        trafficValue: actualValue.trafficValue as any,
        rankingValue: actualValue.rankingValue as any,
      },
      valueAccuracy,
      estimatedROI,
      actualROI,
      roiAccuracy,
      adjustmentFactor,
      notes: this.generateNotes(overallAccuracy, valueAccuracy),
    };
    
    this.feedbackRecords.set(record.id, record);
    
    // Update heuristics
    this.updateHeuristics(actionType, record);
    
    return record;
  }
  
  /**
   * Calculate token cost accuracy
   */
  private calculateTokenAccuracy(
    estimated: ActionCostBreakdown,
    actual: ActualCostInput
  ): number {
    if (!actual.tokenCost || estimated.tokenCost.totalTokens === 0) {
      return 1.0;
    }
    
    const ratio = actual.tokenCost.totalTokens / estimated.tokenCost.totalTokens;
    return this.normalizeAccuracy(ratio);
  }
  
  /**
   * Calculate compute cost accuracy
   */
  private calculateComputeAccuracy(
    estimated: ActionCostBreakdown,
    actual: ActualCostInput
  ): number {
    if (!actual.computeCost || estimated.computeCost.totalCost === 0) {
      return 1.0;
    }
    
    const ratio = actual.computeCost.totalCost / estimated.computeCost.totalCost;
    return this.normalizeAccuracy(ratio);
  }
  
  /**
   * Calculate effort cost accuracy
   */
  private calculateEffortAccuracy(
    estimated: ActionCostBreakdown,
    actual: ActualCostInput
  ): number {
    if (!actual.effortCost || estimated.effortCost.totalHours === 0) {
      return 1.0;
    }
    
    const ratio = actual.effortCost.totalHours / estimated.effortCost.totalHours;
    return this.normalizeAccuracy(ratio);
  }
  
  /**
   * Calculate value accuracy
   */
  private calculateValueAccuracy(
    estimated: ActionValueBreakdown,
    actual: ActualValueInput
  ): number {
    const accuracies: number[] = [];
    
    if (actual.trafficValue && estimated.trafficValue.expectedVisitors > 0) {
      const ratio = actual.trafficValue.expectedVisitors / estimated.trafficValue.expectedVisitors;
      accuracies.push(this.normalizeAccuracy(ratio));
    }
    
    if (actual.rankingValue && estimated.rankingValue.avgPositionImprovement > 0) {
      const ratio = actual.rankingValue.avgPositionImprovement / estimated.rankingValue.avgPositionImprovement;
      accuracies.push(this.normalizeAccuracy(ratio));
    }
    
    if (accuracies.length === 0) return 1.0;
    return accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
  }
  
  /**
   * Normalize accuracy to 0-1 scale (1 = perfect)
   */
  private normalizeAccuracy(ratio: number): number {
    // Perfect accuracy = 1.0, underestimate or overestimate reduces accuracy
    if (ratio === 0) return 0;
    if (ratio >= 1) return 1 / ratio;
    return ratio;
  }
  
  /**
   * Calculate actual total cost from partial inputs
   */
  private calculateActualTotalCost(actual: ActualCostInput): number {
    let total = 0;
    if (actual.tokenCost) total += actual.tokenCost.totalTokens / 1000;
    if (actual.computeCost) total += actual.computeCost.totalCost;
    if (actual.effortCost) total += actual.effortCost.totalHours * 10;
    return total;
  }
  
  /**
   * Calculate actual total value from partial inputs
   */
  private calculateActualTotalValue(actual: ActualValueInput): number {
    let total = 0;
    if (actual.trafficValue) total += actual.trafficValue.expectedVisitors * 0.1;
    if (actual.rankingValue) total += actual.rankingValue.avgPositionImprovement * actual.rankingValue.keywordsAffected * 2;
    return total;
  }
  
  /**
   * Calculate adjustment factor from accuracy
   */
  private calculateAdjustmentFactor(accuracy: number): number {
    // If accuracy is low (we overestimated), reduce future estimates
    // If accuracy is high (we underestimated), increase future estimates
    if (accuracy >= 0.9) return 1.0;
    if (accuracy >= 0.7) return 1.1;
    if (accuracy >= 0.5) return 1.2;
    return 1.3;
  }
  
  /**
   * Generate notes based on accuracy
   */
  private generateNotes(overallAccuracy: number, valueAccuracy: number): string {
    const notes: string[] = [];
    
    if (overallAccuracy < 0.5) {
      notes.push('Significant cost estimation error - review assumptions');
    } else if (overallAccuracy < 0.7) {
      notes.push('Moderate cost estimation error');
    } else if (overallAccuracy >= 0.9) {
      notes.push('Excellent cost estimation accuracy');
    }
    
    if (valueAccuracy < 0.5) {
      notes.push('Value significantly different from estimate');
    } else if (valueAccuracy >= 0.9) {
      notes.push('Value estimate was accurate');
    }
    
    return notes.join('. ');
  }
  
  /**
   * Update heuristics based on feedback
   */
  private updateHeuristics(actionType: string, record: CostFeedbackRecord): void {
    let heuristic = this.heuristics.get(actionType);
    
    if (!heuristic) {
      // Create new heuristic
      heuristic = {
        actionType,
        sampleSize: 0,
        lastUpdated: new Date().toISOString(),
        avgPromptTokens: record.estimatedCost.tokenCost.promptTokens,
        avgCompletionTokens: record.estimatedCost.tokenCost.completionTokens,
        tokenStdDev: 0,
        avgEffortHours: record.estimatedCost.effortCost.totalHours,
        effortStdDev: 0,
        avgValueRealized: record.actualValue.trafficValue?.expectedVisitors || 0,
        valueRealizationRate: record.valueAccuracy,
        overallAccuracyTrend: [record.overallAccuracy],
        adjustmentMultiplier: 1.0,
        confidence: 'low',
      };
    }
    
    // Update with exponential moving average
    const alpha = this.smoothingFactor;
    
    if (record.actualCost.tokenCost) {
      heuristic.avgPromptTokens = alpha * record.actualCost.tokenCost.promptTokens + 
                                   (1 - alpha) * heuristic.avgPromptTokens;
      heuristic.avgCompletionTokens = alpha * record.actualCost.tokenCost.completionTokens + 
                                       (1 - alpha) * heuristic.avgCompletionTokens;
    }
    
    if (record.actualCost.effortCost) {
      heuristic.avgEffortHours = alpha * record.actualCost.effortCost.totalHours + 
                                  (1 - alpha) * heuristic.avgEffortHours;
    }
    
    if (record.actualValue.trafficValue) {
      heuristic.avgValueRealized = alpha * record.actualValue.trafficValue.expectedVisitors + 
                                    (1 - alpha) * heuristic.avgValueRealized;
    }
    
    heuristic.valueRealizationRate = alpha * record.valueAccuracy + 
                                      (1 - alpha) * heuristic.valueRealizationRate;
    
    // Update accuracy trend (keep last 20)
    heuristic.overallAccuracyTrend.push(record.overallAccuracy);
    if (heuristic.overallAccuracyTrend.length > 20) {
      heuristic.overallAccuracyTrend.shift();
    }
    
    // Update adjustment multiplier
    const recentAccuracy = heuristic.overallAccuracyTrend.slice(-5);
    const avgRecentAccuracy = recentAccuracy.reduce((sum, a) => sum + a, 0) / recentAccuracy.length;
    heuristic.adjustmentMultiplier = this.calculateAdjustmentFactor(avgRecentAccuracy);
    
    // Update sample size and confidence
    heuristic.sampleSize++;
    heuristic.confidence = 
      heuristic.sampleSize >= 20 ? 'high' :
      heuristic.sampleSize >= 5 ? 'medium' : 'low';
    
    heuristic.lastUpdated = new Date().toISOString();
    
    this.heuristics.set(actionType, heuristic);
    this.logger.log(`[FeedbackUpdater] Updated heuristics for ${actionType}, sample size: ${heuristic.sampleSize}`);
  }
  
  /**
   * Get heuristics for an action type
   */
  getHeuristics(actionType: string): CostHeuristics | undefined {
    return this.heuristics.get(actionType);
  }
  
  /**
   * Get all heuristics
   */
  getAllHeuristics(): CostHeuristics[] {
    return Array.from(this.heuristics.values());
  }
  
  /**
   * Get feedback records for an action type
   */
  getFeedbackRecords(actionType?: string): CostFeedbackRecord[] {
    const records = Array.from(this.feedbackRecords.values());
    if (actionType) {
      return records.filter(r => r.actionType === actionType);
    }
    return records;
  }
  
  /**
   * Get accuracy statistics
   */
  getAccuracyStatistics(actionType?: string): {
    avgOverallAccuracy: number;
    avgTokenAccuracy: number;
    avgEffortAccuracy: number;
    avgValueAccuracy: number;
    sampleSize: number;
    trend: 'improving' | 'stable' | 'declining';
  } {
    const records = this.getFeedbackRecords(actionType);
    
    if (records.length === 0) {
      return {
        avgOverallAccuracy: 0,
        avgTokenAccuracy: 0,
        avgEffortAccuracy: 0,
        avgValueAccuracy: 0,
        sampleSize: 0,
        trend: 'stable',
      };
    }
    
    const avgOverallAccuracy = records.reduce((sum, r) => sum + r.overallAccuracy, 0) / records.length;
    const avgTokenAccuracy = records.reduce((sum, r) => sum + r.tokenAccuracy, 0) / records.length;
    const avgEffortAccuracy = records.reduce((sum, r) => sum + r.effortAccuracy, 0) / records.length;
    const avgValueAccuracy = records.reduce((sum, r) => sum + r.valueAccuracy, 0) / records.length;
    
    // Calculate trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (records.length >= 5) {
      const recent = records.slice(-5);
      const older = records.slice(-10, -5);
      
      if (older.length >= 3) {
        const recentAvg = recent.reduce((sum, r) => sum + r.overallAccuracy, 0) / recent.length;
        const olderAvg = older.reduce((sum, r) => sum + r.overallAccuracy, 0) / older.length;
        
        if (recentAvg > olderAvg + 0.05) trend = 'improving';
        else if (recentAvg < olderAvg - 0.05) trend = 'declining';
      }
    }
    
    return {
      avgOverallAccuracy,
      avgTokenAccuracy,
      avgEffortAccuracy,
      avgValueAccuracy,
      sampleSize: records.length,
      trend,
    };
  }
  
  /**
   * Export heuristics for persistence
   */
  exportHeuristics(): string {
    const heuristics = Array.from(this.heuristics.values());
    return JSON.stringify(heuristics, null, 2);
  }
  
  /**
   * Import heuristics from persistence
   */
  importHeuristics(json: string): void {
    try {
      const heuristics: CostHeuristics[] = JSON.parse(json);
      for (const h of heuristics) {
        this.heuristics.set(h.actionType, h);
      }
      this.logger.log(`[FeedbackUpdater] Imported ${heuristics.length} heuristics`);
    } catch (error) {
      this.logger.error('[FeedbackUpdater] Failed to import heuristics:', error);
    }
  }
  
  /**
   * Clear all feedback data
   */
  clearAll(): void {
    this.feedbackRecords.clear();
    this.heuristics.clear();
    this.logger.log('[FeedbackUpdater] Cleared all feedback data');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createFeedbackUpdater(
  maxRecordsPerType?: number,
  smoothingFactor?: number
): CostFeedbackUpdater {
  return new CostFeedbackUpdater(maxRecordsPerType, smoothingFactor);
}
