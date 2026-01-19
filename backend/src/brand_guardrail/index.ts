/**
 * Brand Guardrail v1.4 - Module Index
 * 
 * Exports all components for brand style learning and enforcement.
 */

// ============================================================================
// MODELS
// ============================================================================

export {
  // Brand Style Profile
  BrandStyleProfile,
  StyleAttributes,
  DEFAULT_STYLE_ATTRIBUTES,
  VocabularyProfile,
  ToneProfile,
  ToneDescriptor,
  PointOfView,
  ReaderAddressing,
  StructurePatterns,
  CTAPatterns,
  CTAPlacement,
  ProhibitedPatterns,
  ProhibitedRegex,
  LearningMetadata,
  
  // Violations
  ViolationSeverity,
  ViolationType,
  BrandViolation,
  ViolationLocation,
  
  // Compliance
  BrandComplianceResult,
  ComplianceStatus,
  
  // Drift
  DriftMeasurement,
  AttributeDrift,
  DriftTrend,
  
  // Learning Input
  BrandLearningDocument,
  LearningDocumentType,
  DocumentPerformanceMetrics,
  ApprovalStatus,
  
  // Configuration
  BrandGuardrailConfig,
  DEFAULT_BRAND_GUARDRAIL_CONFIG,
  
  // Audit
  BrandAuditEntry,
  BrandAuditEventType,
} from './models';

// ============================================================================
// BRAND STYLE LEARNER
// ============================================================================

export {
  BrandStyleLearner,
  analyzeTextStats,
  extractWordFrequencies,
  detectTones,
  detectFormality,
  detectTechnicalLevel,
  detectEmotionalIntensity,
  detectAssertiveness,
  detectPersuasionLevel,
  extractCTAPatterns,
} from './brand_style_learner';

// ============================================================================
// BRAND PROFILE STORE
// ============================================================================

export {
  IBrandProfileStore,
  BrandProfileVersion,
  ProfileComparison,
  ProfileDifference,
  InMemoryBrandProfileStore,
  PostgresBrandProfileStore,
  createBrandProfileStore,
  StoreType,
} from './brand_profile_store';

// ============================================================================
// BRAND COMPLIANCE CHECKER
// ============================================================================

export {
  IComplianceChecker,
  BrandComplianceChecker,
  createComplianceChecker,
} from './brand_compliance_checker';

// ============================================================================
// VIOLATION CLASSIFIER
// ============================================================================

export {
  ViolationClassifier,
  createViolationClassifier,
  ClassificationResult,
  ClassificationContext,
  ClassificationSummary,
  DEFAULT_SEVERITY_MAP,
} from './violation_classifier';

// ============================================================================
// DRIFT MONITOR
// ============================================================================

export {
  BrandDriftMonitor,
  createDriftMonitor,
  DriftAlert,
  DriftMonitorStats,
} from './drift_monitor';

// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================

import { BrandStyleLearner } from './brand_style_learner';
import { InMemoryBrandProfileStore, IBrandProfileStore } from './brand_profile_store';
import { BrandComplianceChecker } from './brand_compliance_checker';
import { ViolationClassifier } from './violation_classifier';
import { BrandDriftMonitor } from './drift_monitor';
import { BrandGuardrailConfig, DEFAULT_BRAND_GUARDRAIL_CONFIG } from './models';

/**
 * Complete Brand Guardrail system
 */
export interface BrandGuardrailSystem {
  learner: BrandStyleLearner;
  store: IBrandProfileStore;
  checker: BrandComplianceChecker;
  classifier: ViolationClassifier;
  driftMonitor: BrandDriftMonitor;
  config: BrandGuardrailConfig;
}

/**
 * Create a complete Brand Guardrail system
 */
export function createBrandGuardrailSystem(
  config: Partial<BrandGuardrailConfig> = {}
): BrandGuardrailSystem {
  const fullConfig = { ...DEFAULT_BRAND_GUARDRAIL_CONFIG, ...config };
  
  return {
    learner: new BrandStyleLearner(),
    store: new InMemoryBrandProfileStore(),
    checker: new BrandComplianceChecker(),
    classifier: new ViolationClassifier(fullConfig),
    driftMonitor: new BrandDriftMonitor(fullConfig),
    config: fullConfig,
  };
}

// ============================================================================
// VERSION
// ============================================================================

export const BRAND_GUARDRAIL_VERSION = '1.4.0';
