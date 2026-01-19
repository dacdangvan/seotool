/**
 * Brand Drift Monitor v1.4
 * 
 * Monitors brand style consistency over time and alerts
 * when content starts drifting from the brand profile.
 * 
 * Features:
 * - Track style attribute trends
 * - Detect gradual drift
 * - Generate drift alerts
 * - Provide actionable recommendations
 * 
 * Design Principles:
 * - Time-series analysis
 * - Statistical trend detection
 * - Explainable alerts
 */

import {
  BrandStyleProfile,
  StyleAttributes,
  DriftMeasurement,
  AttributeDrift,
  DriftTrend,
  ViolationType,
  BrandGuardrailConfig,
  DEFAULT_BRAND_GUARDRAIL_CONFIG,
} from './models';

import {
  detectFormality,
  detectTechnicalLevel,
  detectEmotionalIntensity,
  detectAssertiveness,
  detectPersuasionLevel,
} from './brand_style_learner';

// ============================================================================
// DRIFT ALERT
// ============================================================================

export interface DriftAlert {
  id: string;
  projectId: string;
  alertedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Which attribute is drifting */
  attribute: keyof StyleAttributes;
  
  /** Current drift percentage */
  currentDrift: number;
  
  /** Trend direction */
  direction: 'towards_formal' | 'towards_casual' | 'increasing' | 'decreasing';
  
  /** Number of measurements showing drift */
  measurementCount: number;
  
  /** Recommendation */
  recommendation: string;
  
  /** Acknowledged */
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

// ============================================================================
// DRIFT MONITOR
// ============================================================================

export class BrandDriftMonitor {
  private measurements: Map<string, DriftMeasurement[]> = new Map(); // projectId -> measurements
  private alerts: DriftAlert[] = [];
  private config: BrandGuardrailConfig;
  private logger: Console;
  
  constructor(config: Partial<BrandGuardrailConfig> = {}) {
    this.config = { ...DEFAULT_BRAND_GUARDRAIL_CONFIG, ...config };
    this.logger = console;
  }
  
  /**
   * Measure drift for a content piece
   */
  measureDrift(
    content: string,
    profile: BrandStyleProfile
  ): DriftMeasurement {
    const projectId = profile.projectId;
    
    // Analyze content
    const actualAttributes: StyleAttributes = {
      formality: detectFormality(content),
      technicalLevel: detectTechnicalLevel(content),
      emotionalIntensity: detectEmotionalIntensity(content),
      assertiveness: detectAssertiveness(content),
      persuasionLevel: detectPersuasionLevel(content),
    };
    
    const expectedAttributes = profile.styleAttributes;
    
    // Calculate drift for each attribute
    const attributeDrifts: AttributeDrift[] = [];
    let totalDrift = 0;
    
    for (const key of Object.keys(expectedAttributes) as (keyof StyleAttributes)[]) {
      const expected = expectedAttributes[key];
      const actual = actualAttributes[key];
      const drift = Math.abs(actual - expected);
      const driftPercent = (drift / Math.max(expected, 0.01)) * 100;
      
      attributeDrifts.push({
        attribute: key,
        expectedValue: expected,
        actualValue: actual,
        drift,
        driftPercent,
      });
      
      totalDrift += drift;
    }
    
    const overallDrift = totalDrift / Object.keys(expectedAttributes).length;
    
    // Get trend direction
    const trendDirection = this.calculateTrendDirection(projectId, overallDrift);
    
    const measurement: DriftMeasurement = {
      id: `drift-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      projectId,
      measuredAt: new Date().toISOString(),
      contentId: `content-${Date.now()}`,
      attributeDrifts,
      overallDrift,
      trendDirection,
    };
    
    // Store measurement
    this.storeMeasurement(measurement);
    
    // Check for alerts
    this.checkForAlerts(measurement, profile);
    
    this.logger.log(
      `[DriftMonitor] Measured drift for project ${projectId}: ${(overallDrift * 100).toFixed(1)}% (${trendDirection})`
    );
    
    return measurement;
  }
  
  /**
   * Store a measurement
   */
  private storeMeasurement(measurement: DriftMeasurement): void {
    const projectMeasurements = this.measurements.get(measurement.projectId) || [];
    projectMeasurements.push(measurement);
    
    // Keep only last 100 measurements per project
    if (projectMeasurements.length > 100) {
      projectMeasurements.shift();
    }
    
    this.measurements.set(measurement.projectId, projectMeasurements);
  }
  
  /**
   * Calculate trend direction
   */
  private calculateTrendDirection(
    projectId: string,
    currentDrift: number
  ): 'improving' | 'stable' | 'degrading' {
    const measurements = this.measurements.get(projectId) || [];
    
    if (measurements.length < 3) {
      return 'stable';
    }
    
    // Get last 5 measurements
    const recent = measurements.slice(-5);
    const avgRecentDrift = recent.reduce((sum, m) => sum + m.overallDrift, 0) / recent.length;
    
    // Get previous measurements (before last 5)
    const older = measurements.slice(-10, -5);
    if (older.length === 0) {
      return 'stable';
    }
    const avgOlderDrift = older.reduce((sum, m) => sum + m.overallDrift, 0) / older.length;
    
    const change = avgRecentDrift - avgOlderDrift;
    
    if (change > 0.05) return 'degrading';
    if (change < -0.05) return 'improving';
    return 'stable';
  }
  
  /**
   * Check for alerts and generate if needed
   */
  private checkForAlerts(
    measurement: DriftMeasurement,
    profile: BrandStyleProfile
  ): void {
    const threshold = this.config.driftAlertThreshold;
    
    for (const attrDrift of measurement.attributeDrifts) {
      if (attrDrift.drift > threshold) {
        // Check if we already have a recent alert for this attribute
        const existingAlert = this.alerts.find(
          a => a.projectId === measurement.projectId &&
               a.attribute === attrDrift.attribute &&
               !a.acknowledged &&
               (Date.now() - new Date(a.alertedAt).getTime()) < 24 * 60 * 60 * 1000 // 24 hours
        );
        
        if (!existingAlert) {
          const alert = this.createAlert(measurement, attrDrift);
          this.alerts.push(alert);
          this.logger.warn(`[DriftMonitor] ALERT: ${alert.attribute} drift detected for project ${measurement.projectId}`);
        }
      }
    }
  }
  
  /**
   * Create a drift alert
   */
  private createAlert(
    measurement: DriftMeasurement,
    attrDrift: AttributeDrift
  ): DriftAlert {
    const severity = this.determineSeverity(attrDrift.drift);
    const direction = this.determineDirection(attrDrift);
    const recommendation = this.generateRecommendation(attrDrift, direction);
    
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      projectId: measurement.projectId,
      alertedAt: new Date().toISOString(),
      severity,
      attribute: attrDrift.attribute,
      currentDrift: attrDrift.drift,
      direction,
      measurementCount: (this.measurements.get(measurement.projectId) || []).length,
      recommendation,
      acknowledged: false,
    };
  }
  
  /**
   * Determine alert severity
   */
  private determineSeverity(drift: number): 'low' | 'medium' | 'high' | 'critical' {
    if (drift > 0.5) return 'critical';
    if (drift > 0.35) return 'high';
    if (drift > 0.25) return 'medium';
    return 'low';
  }
  
  /**
   * Determine drift direction
   */
  private determineDirection(
    attrDrift: AttributeDrift
  ): 'towards_formal' | 'towards_casual' | 'increasing' | 'decreasing' {
    const change = attrDrift.actualValue - attrDrift.expectedValue;
    
    if (attrDrift.attribute === 'formality') {
      return change > 0 ? 'towards_formal' : 'towards_casual';
    }
    
    return change > 0 ? 'increasing' : 'decreasing';
  }
  
  /**
   * Generate recommendation
   */
  private generateRecommendation(
    attrDrift: AttributeDrift,
    direction: string
  ): string {
    const recommendations: Record<keyof StyleAttributes, Record<string, string>> = {
      formality: {
        towards_formal: 'Content is becoming more formal than brand standard. Consider using more conversational language and contractions.',
        towards_casual: 'Content is becoming too casual. Consider using more professional vocabulary and removing slang.',
      },
      technicalLevel: {
        increasing: 'Content is becoming more technical. Consider simplifying language for broader audience appeal.',
        decreasing: 'Content is becoming less technical. Consider adding more depth and expertise to match brand authority.',
      },
      emotionalIntensity: {
        increasing: 'Content is becoming more emotional. Consider balancing with factual, objective statements.',
        decreasing: 'Content is becoming too neutral. Consider adding engaging, emotive language to connect with readers.',
      },
      assertiveness: {
        increasing: 'Content is becoming too definitive. Consider using more measured language to maintain credibility.',
        decreasing: 'Content is using too much hedging. Consider making stronger, more confident statements.',
      },
      persuasionLevel: {
        increasing: 'Content is becoming too sales-focused. Consider adding more educational, value-driven content.',
        decreasing: 'Content may need stronger calls-to-action to drive conversions while maintaining brand voice.',
      },
    };
    
    return recommendations[attrDrift.attribute]?.[direction] ||
      `${attrDrift.attribute} is drifting ${direction} from brand standard. Review recent content and adjust.`;
  }
  
  /**
   * Get drift trend for a project
   */
  getDriftTrend(
    projectId: string,
    periodDays: number = 30
  ): DriftTrend | null {
    const measurements = this.measurements.get(projectId) || [];
    
    if (measurements.length < 5) {
      return null;
    }
    
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    
    const periodMeasurements = measurements.filter(
      m => new Date(m.measuredAt) >= periodStart
    );
    
    if (periodMeasurements.length < 3) {
      return null;
    }
    
    // Calculate average drift
    const avgDrift = periodMeasurements.reduce((sum, m) => sum + m.overallDrift, 0) / periodMeasurements.length;
    
    // Calculate trend slope (simple linear regression)
    const trendSlope = this.calculateTrendSlope(periodMeasurements);
    
    // Find top violation types (would need violation data in measurements)
    const topViolationTypes: { type: ViolationType; count: number }[] = [];
    
    // Generate recommendation
    let recommendation = 'Brand style is stable.';
    if (trendSlope > 0.01) {
      recommendation = 'Brand drift is increasing. Review content guidelines and consider retraining editors.';
    } else if (trendSlope < -0.01) {
      recommendation = 'Brand consistency is improving. Continue current practices.';
    }
    
    return {
      projectId,
      periodStart: periodStart.toISOString(),
      periodEnd: new Date().toISOString(),
      measurementCount: periodMeasurements.length,
      avgDrift,
      trendSlope,
      topViolationTypes,
      recommendation,
    };
  }
  
  /**
   * Calculate trend slope
   */
  private calculateTrendSlope(measurements: DriftMeasurement[]): number {
    const n = measurements.length;
    if (n < 2) return 0;
    
    // Simple linear regression
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = measurements[i].overallDrift;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }
  
  /**
   * Get all unacknowledged alerts
   */
  getUnacknowledgedAlerts(projectId?: string): DriftAlert[] {
    let alerts = this.alerts.filter(a => !a.acknowledged);
    
    if (projectId) {
      alerts = alerts.filter(a => a.projectId === projectId);
    }
    
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (!alert) {
      return false;
    }
    
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = acknowledgedBy;
    
    this.logger.log(`[DriftMonitor] Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    return true;
  }
  
  /**
   * Get measurements for a project
   */
  getMeasurements(
    projectId: string,
    limit: number = 50
  ): DriftMeasurement[] {
    const measurements = this.measurements.get(projectId) || [];
    return measurements.slice(-limit);
  }
  
  /**
   * Clear old measurements
   */
  clearOldMeasurements(olderThanDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    let cleared = 0;
    
    for (const [projectId, measurements] of this.measurements.entries()) {
      const filtered = measurements.filter(
        m => new Date(m.measuredAt) >= cutoff
      );
      cleared += measurements.length - filtered.length;
      this.measurements.set(projectId, filtered);
    }
    
    this.logger.log(`[DriftMonitor] Cleared ${cleared} old measurements`);
    return cleared;
  }
  
  /**
   * Get statistics
   */
  getStats(): DriftMonitorStats {
    let totalMeasurements = 0;
    let projectCount = 0;
    
    for (const measurements of this.measurements.values()) {
      totalMeasurements += measurements.length;
      projectCount++;
    }
    
    return {
      projectCount,
      totalMeasurements,
      alertCount: this.alerts.length,
      unacknowledgedAlertCount: this.alerts.filter(a => !a.acknowledged).length,
    };
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface DriftMonitorStats {
  projectCount: number;
  totalMeasurements: number;
  alertCount: number;
  unacknowledgedAlertCount: number;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createDriftMonitor(
  config?: Partial<BrandGuardrailConfig>
): BrandDriftMonitor {
  return new BrandDriftMonitor(config);
}
