/**
 * Confidence Calibrator v1.3
 * 
 * Adaptive confidence adjustment based on outcome observation.
 * Updates calibration rules (rule-based, not ML) to improve accuracy.
 * 
 * Flow:
 * 1. After execution, observe outcome (success/neutral/negative)
 * 2. Compare outcome to confidence at execution time
 * 3. Identify patterns where confidence was miscalibrated
 * 4. Generate/update calibration rules
 * 5. Apply rules to future confidence calculations
 * 
 * Design Principles:
 * - Rule-based only (no ML black boxes)
 * - Transparent calibration logic
 * - Conservative adjustments
 * - Audit trail for all calibration changes
 */

import {
  CalibrationRule,
  CalibrationCondition,
  CalibrationAdjustment,
  OutcomeObservation,
  ConfidenceScore,
  ActionOutcome,
  HistoricalAction,
} from './models_v2';
import { ActionType } from '../autonomous_agent/models';
import { RiskLevel } from '../autonomous_agent_v1_1/models';

/**
 * Calibration analysis result
 */
interface CalibrationAnalysis {
  needsCalibration: boolean;
  pattern: string;
  currentAccuracy: number;
  expectedAccuracy: number;
  suggestedRule?: CalibrationRule;
  reason: string;
}

/**
 * Outcome statistics for a specific segment
 */
interface OutcomeStats {
  actionType: ActionType | 'any';
  riskLevel: RiskLevel | 'any';
  confidenceRange: { min: number; max: number };
  totalCount: number;
  successCount: number;
  neutralCount: number;
  negativeCount: number;
  successRate: number;
  negativeRate: number;
  avgConfidenceAtExecution: number;
}

export class ConfidenceCalibrator {
  private observations: OutcomeObservation[] = [];
  private rules: CalibrationRule[] = [];
  private ruleIdCounter = 0;
  
  constructor(initialRules: CalibrationRule[] = []) {
    this.rules = initialRules;
  }
  
  /**
   * Record an outcome observation
   */
  recordOutcome(observation: OutcomeObservation): void {
    this.observations.push(observation);
    
    // Auto-analyze after accumulating observations
    if (this.observations.length % 10 === 0) {
      this.autoAnalyze();
    }
  }
  
  /**
   * Record multiple outcomes (batch)
   */
  recordOutcomes(observations: OutcomeObservation[]): void {
    this.observations.push(...observations);
  }
  
  /**
   * Analyze if calibration is needed for a segment
   */
  analyzeSegment(
    actionType: ActionType | 'any',
    riskLevel: RiskLevel | 'any'
  ): CalibrationAnalysis {
    const stats = this.calculateStats(actionType, riskLevel);
    
    // Minimum sample size for analysis
    if (stats.totalCount < 10) {
      return {
        needsCalibration: false,
        pattern: 'insufficient_data',
        currentAccuracy: 0,
        expectedAccuracy: 0,
        reason: `Only ${stats.totalCount} observations (need 10+)`,
      };
    }
    
    // Check for over-confidence pattern
    // If high confidence but high negative rate
    const overConfidenceIssue = 
      stats.avgConfidenceAtExecution > 0.7 && stats.negativeRate > 0.15;
    
    if (overConfidenceIssue) {
      return {
        needsCalibration: true,
        pattern: 'over_confidence',
        currentAccuracy: stats.successRate,
        expectedAccuracy: stats.avgConfidenceAtExecution,
        suggestedRule: this.createRule(
          actionType,
          riskLevel,
          'over_confidence',
          stats
        ),
        reason: `High confidence (${(stats.avgConfidenceAtExecution * 100).toFixed(0)}%) but ${(stats.negativeRate * 100).toFixed(0)}% negative outcomes`,
      };
    }
    
    // Check for under-confidence pattern
    // If low confidence but high success rate
    const underConfidenceIssue = 
      stats.avgConfidenceAtExecution < 0.6 && stats.successRate > 0.85;
    
    if (underConfidenceIssue) {
      return {
        needsCalibration: true,
        pattern: 'under_confidence',
        currentAccuracy: stats.successRate,
        expectedAccuracy: stats.avgConfidenceAtExecution,
        suggestedRule: this.createRule(
          actionType,
          riskLevel,
          'under_confidence',
          stats
        ),
        reason: `Low confidence (${(stats.avgConfidenceAtExecution * 100).toFixed(0)}%) but ${(stats.successRate * 100).toFixed(0)}% success rate`,
      };
    }
    
    // Check calibration accuracy
    const calibrationGap = Math.abs(stats.successRate - stats.avgConfidenceAtExecution);
    
    if (calibrationGap > 0.2) {
      return {
        needsCalibration: true,
        pattern: 'calibration_drift',
        currentAccuracy: stats.successRate,
        expectedAccuracy: stats.avgConfidenceAtExecution,
        suggestedRule: this.createRule(
          actionType,
          riskLevel,
          'drift',
          stats
        ),
        reason: `Calibration gap of ${(calibrationGap * 100).toFixed(0)}%`,
      };
    }
    
    return {
      needsCalibration: false,
      pattern: 'well_calibrated',
      currentAccuracy: stats.successRate,
      expectedAccuracy: stats.avgConfidenceAtExecution,
      reason: 'Confidence aligns well with outcomes',
    };
  }
  
  /**
   * Auto-analyze all segments and suggest rules
   */
  autoAnalyze(): CalibrationAnalysis[] {
    const analyses: CalibrationAnalysis[] = [];
    
    // Analyze by action type
    const actionTypes: (ActionType | 'any')[] = [
      ActionType.ADD_INTERNAL_LINK,
      ActionType.OPTIMIZE_CONTENT,
      ActionType.FIX_SCHEMA_MARKUP,
      ActionType.OPTIMIZE_ANCHOR_TEXT,
    ];
    
    const riskLevels: (RiskLevel | 'any')[] = [
      RiskLevel.LOW,
      RiskLevel.MEDIUM,
    ];
    
    for (const actionType of actionTypes) {
      for (const riskLevel of riskLevels) {
        const analysis = this.analyzeSegment(actionType, riskLevel);
        if (analysis.needsCalibration) {
          analyses.push(analysis);
        }
      }
    }
    
    // Also analyze overall
    const overallAnalysis = this.analyzeSegment('any', 'any');
    if (overallAnalysis.needsCalibration) {
      analyses.push(overallAnalysis);
    }
    
    return analyses;
  }
  
  /**
   * Apply a suggested rule
   */
  applyRule(rule: CalibrationRule): void {
    // Check for duplicate
    const existing = this.rules.find(r => 
      r.condition.actionType === rule.condition.actionType &&
      r.condition.riskLevel === rule.condition.riskLevel
    );
    
    if (existing) {
      // Update existing rule
      Object.assign(existing, rule);
      existing.updatedAt = new Date().toISOString();
    } else {
      this.rules.push(rule);
    }
  }
  
  /**
   * Get all active rules
   */
  getActiveRules(): CalibrationRule[] {
    return this.rules.filter(r => r.enabled);
  }
  
  /**
   * Get all rules
   */
  getAllRules(): CalibrationRule[] {
    return [...this.rules];
  }
  
  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      rule.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }
  
  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Calculate statistics for a segment
   */
  private calculateStats(
    actionType: ActionType | 'any',
    riskLevel: RiskLevel | 'any'
  ): OutcomeStats {
    // Convert observations to historical format for filtering
    const filtered = this.observations.filter(o => {
      // In production, observations would include actionType and riskLevel
      // For now, we'll use the confidence score's factor breakdown
      return true; // Filter logic would go here
    });
    
    const totalCount = filtered.length;
    
    if (totalCount === 0) {
      return {
        actionType,
        riskLevel,
        confidenceRange: { min: 0, max: 1 },
        totalCount: 0,
        successCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        successRate: 0,
        negativeRate: 0,
        avgConfidenceAtExecution: 0,
      };
    }
    
    const successCount = filtered.filter(o => o.outcome === ActionOutcome.SUCCESS).length;
    const neutralCount = filtered.filter(o => o.outcome === ActionOutcome.NEUTRAL).length;
    const negativeCount = filtered.filter(o => o.outcome === ActionOutcome.NEGATIVE).length;
    
    const confidences = filtered.map(o => o.confidenceAtExecution.overall);
    const avgConfidenceAtExecution = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    
    return {
      actionType,
      riskLevel,
      confidenceRange: {
        min: Math.min(...confidences),
        max: Math.max(...confidences),
      },
      totalCount,
      successCount,
      neutralCount,
      negativeCount,
      successRate: successCount / totalCount,
      negativeRate: negativeCount / totalCount,
      avgConfidenceAtExecution,
    };
  }
  
  /**
   * Create a calibration rule based on pattern
   */
  private createRule(
    actionType: ActionType | 'any',
    riskLevel: RiskLevel | 'any',
    pattern: 'over_confidence' | 'under_confidence' | 'drift',
    stats: OutcomeStats
  ): CalibrationRule {
    const ruleId = `calibration_${++this.ruleIdCounter}_${Date.now()}`;
    
    let adjustment: CalibrationAdjustment;
    let description: string;
    
    switch (pattern) {
      case 'over_confidence':
        // Reduce confidence
        const reductionFactor = Math.max(0.7, stats.successRate / stats.avgConfidenceAtExecution);
        adjustment = {
          targetFactor: 'overall',
          type: 'multiply',
          value: reductionFactor,
          reason: `Reduce confidence due to ${(stats.negativeRate * 100).toFixed(0)}% negative outcomes`,
        };
        description = `Reduce over-confidence for ${actionType}/${riskLevel}`;
        break;
      
      case 'under_confidence':
        // Increase confidence (conservative)
        const increaseFactor = Math.min(1.3, stats.successRate / stats.avgConfidenceAtExecution);
        adjustment = {
          targetFactor: 'historicalSuccess',
          type: 'multiply',
          value: increaseFactor,
          reason: `Boost historical factor due to ${(stats.successRate * 100).toFixed(0)}% success rate`,
        };
        description = `Boost under-confidence for ${actionType}/${riskLevel}`;
        break;
      
      case 'drift':
      default:
        // Gentle adjustment toward actual success rate
        const driftCorrection = (stats.successRate + stats.avgConfidenceAtExecution) / 2;
        const correctionFactor = driftCorrection / stats.avgConfidenceAtExecution;
        adjustment = {
          targetFactor: 'overall',
          type: 'multiply',
          value: correctionFactor,
          reason: `Correct calibration drift (gap: ${Math.abs(stats.successRate - stats.avgConfidenceAtExecution).toFixed(2)})`,
        };
        description = `Correct calibration drift for ${actionType}/${riskLevel}`;
        break;
    }
    
    const condition: CalibrationCondition = {
      actionType,
      riskLevel,
      minSampleSize: 10,
      outcomePattern: pattern === 'over_confidence'
        ? { negativeRateAbove: 0.1 }
        : pattern === 'under_confidence'
          ? { successRateAbove: 0.8 }
          : {},
    };
    
    return {
      id: ruleId,
      name: `Auto-calibration: ${pattern}`,
      description,
      condition,
      adjustment,
      enabled: false, // Require manual enablement for safety
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Generate calibration report
   */
  generateReport(): string {
    let report = '# Confidence Calibration Report\n\n';
    
    report += `## Overview\n`;
    report += `- Total observations: ${this.observations.length}\n`;
    report += `- Active rules: ${this.rules.filter(r => r.enabled).length}\n`;
    report += `- Total rules: ${this.rules.length}\n\n`;
    
    // Overall stats
    const overallStats = this.calculateStats('any', 'any');
    report += `## Overall Statistics\n`;
    report += `- Success rate: ${(overallStats.successRate * 100).toFixed(1)}%\n`;
    report += `- Negative rate: ${(overallStats.negativeRate * 100).toFixed(1)}%\n`;
    report += `- Avg confidence: ${(overallStats.avgConfidenceAtExecution * 100).toFixed(1)}%\n`;
    report += `- Calibration gap: ${(Math.abs(overallStats.successRate - overallStats.avgConfidenceAtExecution) * 100).toFixed(1)}%\n\n`;
    
    // Active rules
    if (this.rules.length > 0) {
      report += `## Calibration Rules\n`;
      for (const rule of this.rules) {
        const status = rule.enabled ? '✅' : '⏸️';
        report += `### ${status} ${rule.name}\n`;
        report += `- ID: ${rule.id}\n`;
        report += `- Description: ${rule.description}\n`;
        report += `- Condition: ${rule.condition.actionType}/${rule.condition.riskLevel}\n`;
        report += `- Adjustment: ${rule.adjustment.type} ${rule.adjustment.value} on ${rule.adjustment.targetFactor}\n`;
        report += `- Reason: ${rule.adjustment.reason}\n\n`;
      }
    }
    
    // Suggested calibrations
    const analyses = this.autoAnalyze();
    if (analyses.length > 0) {
      report += `## Suggested Calibrations\n`;
      for (const analysis of analyses) {
        report += `### ${analysis.pattern}\n`;
        report += `- Current accuracy: ${(analysis.currentAccuracy * 100).toFixed(1)}%\n`;
        report += `- Expected accuracy: ${(analysis.expectedAccuracy * 100).toFixed(1)}%\n`;
        report += `- Reason: ${analysis.reason}\n\n`;
      }
    }
    
    return report;
  }
  
  /**
   * Export rules for persistence
   */
  exportRules(): string {
    return JSON.stringify(this.rules, null, 2);
  }
  
  /**
   * Import rules from persistence
   */
  importRules(json: string): { success: boolean; imported: number; error?: string } {
    try {
      const imported = JSON.parse(json) as CalibrationRule[];
      this.rules = imported;
      return { success: true, imported: imported.length };
    } catch (error) {
      return { 
        success: false, 
        imported: 0, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
  
  /**
   * Get observation count
   */
  get observationCount(): number {
    return this.observations.length;
  }
  
  /**
   * Clear old observations (keep last N)
   */
  pruneObservations(keepLast: number = 1000): number {
    if (this.observations.length <= keepLast) {
      return 0;
    }
    
    const removed = this.observations.length - keepLast;
    this.observations = this.observations.slice(-keepLast);
    return removed;
  }
}
