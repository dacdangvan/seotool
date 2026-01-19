/**
 * Confidence Audit Logger v1.3
 * 
 * Logs all confidence-related decisions for transparency and debugging.
 * 
 * Logs:
 * - Confidence breakdown for each action
 * - Execution mode chosen
 * - Rationale for decisions
 * - Calibration rule applications
 * - Outcome observations
 * 
 * Exposed to Manager Dashboard for monitoring.
 */

import {
  ConfidenceAuditEntry,
  ConfidenceScore,
  ExecutionMode,
  ExecutionModeResult,
  CalibrationRule,
  OutcomeObservation,
  ActionOutcome,
} from './models_v2';
import { RiskClassification } from '../autonomous_agent_v1_1/models';

export interface AuditLogFilter {
  projectId?: string;
  actionId?: string;
  executionMode?: ExecutionMode;
  minConfidence?: number;
  maxConfidence?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface AuditLogSummary {
  totalEntries: number;
  byExecutionMode: Record<ExecutionMode, number>;
  avgConfidence: number;
  confidenceDistribution: {
    low: number;    // < 0.6
    medium: number; // 0.6 - 0.8
    high: number;   // >= 0.8
  };
  calibrationRulesApplied: number;
  dateRange: { start: string; end: string };
}

export class ConfidenceAuditLogger {
  private entries: ConfidenceAuditEntry[] = [];
  private projectId: string;
  private defaultActorId: string;
  private enabled: boolean;
  
  constructor(
    projectId: string,
    defaultActorId: string = 'system',
    enabled: boolean = true
  ) {
    this.projectId = projectId;
    this.defaultActorId = defaultActorId;
    this.enabled = enabled;
  }
  
  /**
   * Log a confidence evaluation and mode decision
   */
  logDecision(
    actionId: string,
    confidenceScore: ConfidenceScore,
    modeResult: ExecutionModeResult,
    riskClassification: RiskClassification,
    calibrationRulesApplied: string[] = [],
    actorId?: string
  ): ConfidenceAuditEntry | undefined {
    if (!this.enabled) return undefined;
    
    const entry: ConfidenceAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      actionId,
      projectId: this.projectId,
      confidenceScore,
      executionMode: modeResult.mode,
      rationale: modeResult.rationale,
      riskClassification,
      calibrationRulesApplied,
      actorId: actorId || this.defaultActorId,
    };
    
    this.entries.push(entry);
    return entry;
  }
  
  /**
   * Get entries with optional filtering
   */
  getEntries(filter?: AuditLogFilter): ConfidenceAuditEntry[] {
    let filtered = this.entries;
    
    if (filter) {
      if (filter.projectId) {
        filtered = filtered.filter(e => e.projectId === filter.projectId);
      }
      
      if (filter.actionId) {
        filtered = filtered.filter(e => e.actionId === filter.actionId);
      }
      
      if (filter.executionMode) {
        filtered = filtered.filter(e => e.executionMode === filter.executionMode);
      }
      
      if (filter.minConfidence !== undefined) {
        filtered = filtered.filter(e => e.confidenceScore.overall >= filter.minConfidence!);
      }
      
      if (filter.maxConfidence !== undefined) {
        filtered = filtered.filter(e => e.confidenceScore.overall <= filter.maxConfidence!);
      }
      
      if (filter.startDate) {
        filtered = filtered.filter(e => new Date(e.timestamp) >= filter.startDate!);
      }
      
      if (filter.endDate) {
        filtered = filtered.filter(e => new Date(e.timestamp) <= filter.endDate!);
      }
      
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }
    
    return filtered;
  }
  
  /**
   * Get summary statistics
   */
  getSummary(filter?: AuditLogFilter): AuditLogSummary {
    const entries = this.getEntries(filter);
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        byExecutionMode: {
          [ExecutionMode.FULL_AUTO]: 0,
          [ExecutionMode.PARTIAL_AUTO]: 0,
          [ExecutionMode.MANUAL_ONLY]: 0,
          [ExecutionMode.BLOCKED]: 0,
        },
        avgConfidence: 0,
        confidenceDistribution: { low: 0, medium: 0, high: 0 },
        calibrationRulesApplied: 0,
        dateRange: { start: '', end: '' },
      };
    }
    
    // Count by mode
    const byMode: Record<ExecutionMode, number> = {
      [ExecutionMode.FULL_AUTO]: 0,
      [ExecutionMode.PARTIAL_AUTO]: 0,
      [ExecutionMode.MANUAL_ONLY]: 0,
      [ExecutionMode.BLOCKED]: 0,
    };
    
    let totalConfidence = 0;
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;
    let calibrationCount = 0;
    
    for (const entry of entries) {
      byMode[entry.executionMode]++;
      
      const conf = entry.confidenceScore.overall;
      totalConfidence += conf;
      
      if (conf < 0.6) lowCount++;
      else if (conf < 0.8) mediumCount++;
      else highCount++;
      
      if (entry.calibrationRulesApplied.length > 0) {
        calibrationCount++;
      }
    }
    
    const timestamps = entries.map(e => new Date(e.timestamp).getTime());
    
    return {
      totalEntries: entries.length,
      byExecutionMode: byMode,
      avgConfidence: totalConfidence / entries.length,
      confidenceDistribution: {
        low: lowCount,
        medium: mediumCount,
        high: highCount,
      },
      calibrationRulesApplied: calibrationCount,
      dateRange: {
        start: new Date(Math.min(...timestamps)).toISOString(),
        end: new Date(Math.max(...timestamps)).toISOString(),
      },
    };
  }
  
  /**
   * Get entry by action ID
   */
  getByActionId(actionId: string): ConfidenceAuditEntry | undefined {
    return this.entries.find(e => e.actionId === actionId);
  }
  
  /**
   * Get recent entries
   */
  getRecent(count: number = 10): ConfidenceAuditEntry[] {
    return this.entries.slice(-count).reverse();
  }
  
  /**
   * Format entry for dashboard display
   */
  formatForDashboard(entry: ConfidenceAuditEntry): Record<string, unknown> {
    const modeEmoji: Record<ExecutionMode, string> = {
      [ExecutionMode.FULL_AUTO]: '✅',
      [ExecutionMode.PARTIAL_AUTO]: '⚠️',
      [ExecutionMode.MANUAL_ONLY]: '🔒',
      [ExecutionMode.BLOCKED]: '❌',
    };
    
    return {
      id: entry.id,
      actionId: entry.actionId,
      timestamp: entry.timestamp,
      mode: `${modeEmoji[entry.executionMode]} ${entry.executionMode.replace('_', ' ')}`,
      confidence: `${(entry.confidenceScore.overall * 100).toFixed(1)}%`,
      riskLevel: entry.riskClassification.level.toUpperCase(),
      riskScore: entry.riskClassification.score,
      factors: {
        dataQuality: `${(entry.confidenceScore.factors.dataQuality * 100).toFixed(0)}%`,
        consensus: `${(entry.confidenceScore.factors.consensusStrength * 100).toFixed(0)}%`,
        history: `${(entry.confidenceScore.factors.historicalSuccess * 100).toFixed(0)}%`,
        scope: `${(entry.confidenceScore.factors.scopeConfidence * 100).toFixed(0)}%`,
        safety: `${(entry.confidenceScore.factors.safetyMargin * 100).toFixed(0)}%`,
      },
      rationale: entry.rationale,
      calibrationApplied: entry.calibrationRulesApplied.length > 0,
    };
  }
  
  /**
   * Generate detailed report for an entry
   */
  generateDetailedReport(entry: ConfidenceAuditEntry): string {
    let report = `# Confidence Audit Report\n\n`;
    
    const modeEmoji: Record<ExecutionMode, string> = {
      [ExecutionMode.FULL_AUTO]: '✅',
      [ExecutionMode.PARTIAL_AUTO]: '⚠️',
      [ExecutionMode.MANUAL_ONLY]: '🔒',
      [ExecutionMode.BLOCKED]: '❌',
    };
    
    report += `## Summary\n`;
    report += `- **Action ID**: ${entry.actionId}\n`;
    report += `- **Timestamp**: ${entry.timestamp}\n`;
    report += `- **Mode**: ${modeEmoji[entry.executionMode]} ${entry.executionMode.replace('_', ' ').toUpperCase()}\n`;
    report += `- **Overall Confidence**: ${(entry.confidenceScore.overall * 100).toFixed(1)}%\n`;
    report += `- **Risk Level**: ${entry.riskClassification.level.toUpperCase()} (score: ${entry.riskClassification.score})\n\n`;
    
    report += `## Confidence Breakdown\n\n`;
    for (const breakdown of entry.confidenceScore.breakdown) {
      report += `### ${breakdown.factor}\n`;
      report += `- Raw Score: ${(breakdown.rawScore * 100).toFixed(1)}%\n`;
      report += `- Weight: ${(breakdown.weight * 100).toFixed(1)}%\n`;
      report += `- Weighted Score: ${(breakdown.weightedScore * 100).toFixed(2)}%\n`;
      report += `- Explanation: ${breakdown.explanation}\n`;
      if (breakdown.evidence.length > 0) {
        report += `- Evidence:\n`;
        for (const ev of breakdown.evidence) {
          report += `  - ${ev}\n`;
        }
      }
      report += '\n';
    }
    
    report += `## Rationale\n`;
    for (const reason of entry.rationale) {
      report += `- ${reason}\n`;
    }
    
    if (entry.calibrationRulesApplied.length > 0) {
      report += `\n## Calibration Rules Applied\n`;
      for (const ruleId of entry.calibrationRulesApplied) {
        report += `- ${ruleId}\n`;
      }
    }
    
    report += `\n---\n`;
    report += `Algorithm Version: ${entry.confidenceScore.algorithmVersion}\n`;
    report += `Actor: ${entry.actorId}\n`;
    
    return report;
  }
  
  /**
   * Export entries for external storage
   */
  export(): string {
    return JSON.stringify(this.entries, null, 2);
  }
  
  /**
   * Import entries from external storage
   */
  import(json: string): { success: boolean; imported: number; error?: string } {
    try {
      const imported = JSON.parse(json) as ConfidenceAuditEntry[];
      this.entries = imported;
      return { success: true, imported: imported.length };
    } catch (error) {
      return {
        success: false,
        imported: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Get entry count
   */
  get count(): number {
    return this.entries.length;
  }
  
  /**
   * Prune old entries
   */
  prune(keepLast: number = 1000): number {
    if (this.entries.length <= keepLast) {
      return 0;
    }
    
    const removed = this.entries.length - keepLast;
    this.entries = this.entries.slice(-keepLast);
    return removed;
  }
}
