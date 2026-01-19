/**
 * Brand Guardrail v1.4 - Models & Types
 * 
 * Defines all types for brand style learning and enforcement.
 * 
 * Key Concepts:
 * - Brand Style Profile: Learned patterns from approved content
 * - Brand Compliance: Check proposed content against profile
 * - Violation Classification: BLOCKING, WARNING, INFO
 * - Drift Monitoring: Track style consistency over time
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';

// ============================================================================
// BRAND STYLE PROFILE
// ============================================================================

/**
 * Complete brand style profile for a project
 */
export interface BrandStyleProfile {
  id: string;
  projectId: string;
  name: string;
  
  /** Core style attributes */
  styleAttributes: StyleAttributes;
  
  /** Vocabulary preferences */
  vocabulary: VocabularyProfile;
  
  /** Tone and voice */
  toneProfile: ToneProfile;
  
  /** Content structure patterns */
  structurePatterns: StructurePatterns;
  
  /** CTA patterns */
  ctaPatterns: CTAPatterns;
  
  /** Prohibited patterns */
  prohibitedPatterns: ProhibitedPatterns;
  
  /** Learning metadata */
  learningMetadata: LearningMetadata;
  
  /** Profile version for tracking updates */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Core style attributes
 */
export interface StyleAttributes {
  /** Overall formality level (0 = very casual, 1 = very formal) */
  formality: number;
  
  /** Technical depth (0 = layperson, 1 = expert) */
  technicalLevel: number;
  
  /** Emotional tone (0 = neutral/factual, 1 = emotional/engaging) */
  emotionalIntensity: number;
  
  /** Confidence/assertiveness (0 = hedging, 1 = definitive) */
  assertiveness: number;
  
  /** Persuasion level (0 = informational, 1 = sales-focused) */
  persuasionLevel: number;
}

/**
 * Default style attributes (neutral baseline)
 */
export const DEFAULT_STYLE_ATTRIBUTES: StyleAttributes = {
  formality: 0.5,
  technicalLevel: 0.5,
  emotionalIntensity: 0.3,
  assertiveness: 0.5,
  persuasionLevel: 0.3,
};

/**
 * Vocabulary profile learned from content
 */
export interface VocabularyProfile {
  /** Preferred terms (term -> frequency score 0-1) */
  preferredTerms: Map<string, number> | Record<string, number>;
  
  /** Avoided terms (should not appear in brand content) */
  avoidedTerms: string[];
  
  /** Industry-specific terminology */
  industryTerms: string[];
  
  /** Brand-specific phrases */
  brandPhrases: string[];
  
  /** Average word complexity score */
  avgWordComplexity: number;
  
  /** Vocabulary diversity score (unique words / total words) */
  vocabularyDiversity: number;
}

/**
 * Tone and voice profile
 */
export interface ToneProfile {
  /** Primary tone descriptor */
  primaryTone: ToneDescriptor;
  
  /** Secondary tones that appear */
  secondaryTones: ToneDescriptor[];
  
  /** Point of view preference */
  pointOfView: PointOfView;
  
  /** Reader addressing style */
  readerAddressing: ReaderAddressing;
  
  /** Humor usage (0 = none, 1 = frequent) */
  humorLevel: number;
}

export type ToneDescriptor = 
  | 'professional'
  | 'friendly'
  | 'authoritative'
  | 'conversational'
  | 'educational'
  | 'inspirational'
  | 'urgent'
  | 'empathetic'
  | 'neutral';

export type PointOfView = 'first_person_singular' | 'first_person_plural' | 'second_person' | 'third_person';

export type ReaderAddressing = 'direct' | 'indirect' | 'mixed';

/**
 * Content structure patterns
 */
export interface StructurePatterns {
  /** Average sentence length in words */
  avgSentenceLength: number;
  
  /** Sentence length standard deviation */
  sentenceLengthStdDev: number;
  
  /** Min acceptable sentence length */
  minSentenceLength: number;
  
  /** Max acceptable sentence length */
  maxSentenceLength: number;
  
  /** Average paragraph length in sentences */
  avgParagraphLength: number;
  
  /** Heading frequency (headings per 1000 words) */
  headingFrequency: number;
  
  /** List usage frequency (lists per 1000 words) */
  listFrequency: number;
  
  /** Question usage (questions per 1000 words) */
  questionFrequency: number;
}

/**
 * CTA (Call-to-Action) patterns
 */
export interface CTAPatterns {
  /** Common CTA phrases */
  commonPhrases: string[];
  
  /** CTA placement preferences */
  placementPreferences: CTAPlacement[];
  
  /** CTA intensity level (0 = subtle, 1 = aggressive) */
  intensityLevel: number;
  
  /** Frequency of CTAs (per 1000 words) */
  frequency: number;
  
  /** Preferred action verbs */
  preferredVerbs: string[];
}

export type CTAPlacement = 'intro' | 'mid_content' | 'conclusion' | 'sidebar' | 'inline';

/**
 * Prohibited patterns for brand safety
 */
export interface ProhibitedPatterns {
  /** Exact phrases that must not appear */
  prohibitedPhrases: string[];
  
  /** Regex patterns for detection */
  regexPatterns: ProhibitedRegex[];
  
  /** Competitor mentions */
  competitorMentions: string[];
  
  /** Sensitive topics */
  sensitiveTopics: string[];
  
  /** Over-promotional triggers */
  overPromotionalTriggers: string[];
}

export interface ProhibitedRegex {
  pattern: string;
  description: string;
  severity: ViolationSeverity;
}

/**
 * Learning metadata
 */
export interface LearningMetadata {
  /** Number of documents used for learning */
  documentCount: number;
  
  /** Total word count analyzed */
  totalWordsAnalyzed: number;
  
  /** Document IDs used for learning */
  sourceDocumentIds: string[];
  
  /** Last learning timestamp */
  lastLearnedAt: string;
  
  /** Confidence in profile (based on sample size) */
  profileConfidence: number;
  
  /** Learning algorithm version */
  algorithmVersion: string;
}

// ============================================================================
// BRAND COMPLIANCE
// ============================================================================

/**
 * Violation severity levels
 */
export enum ViolationSeverity {
  /** Must block execution */
  BLOCKING = 'blocking',
  
  /** Allow with warning, requires attention */
  WARNING = 'warning',
  
  /** Informational only */
  INFO = 'info',
}

/**
 * Violation type categories
 */
export enum ViolationType {
  // Tone violations
  TONE_MISMATCH = 'tone_mismatch',
  FORMALITY_DEVIATION = 'formality_deviation',
  FORMALITY_DRIFT = 'formality_drift',
  
  // Vocabulary violations
  PROHIBITED_PHRASE = 'prohibited_phrase',
  PROHIBITED_TERM = 'prohibited_term',
  AVOIDED_VOCABULARY = 'avoided_vocabulary',
  COMPETITOR_MENTION = 'competitor_mention',
  OFF_BRAND_VOCABULARY = 'off_brand_vocabulary',
  
  // Structure violations
  SENTENCE_LENGTH = 'sentence_length',
  SENTENCE_LENGTH_VIOLATION = 'sentence_length_violation',
  STRUCTURE_MISMATCH = 'structure_mismatch',
  READABILITY = 'readability',
  
  // SEO-specific violations
  KEYWORD_STUFFING = 'keyword_stuffing',
  OVER_PROMOTIONAL = 'over_promotional',
  
  // Content violations
  SENSITIVE_TOPIC = 'sensitive_topic',
  BRAND_VOICE_DRIFT = 'brand_voice_drift',
  
  // CTA violations
  CTA_OVERUSE = 'cta_overuse',
  CTA_STYLE = 'cta_style',
  CTA_INTENSITY_MISMATCH = 'cta_intensity_mismatch',
  CTA_FREQUENCY_VIOLATION = 'cta_frequency_violation',
}

/**
 * Single violation instance
 */
export interface BrandViolation {
  id: string;
  type: ViolationType;
  severity: ViolationSeverity;
  
  /** Human-readable message */
  message: string;
  
  /** Location in content (optional) */
  location?: ViolationLocation;
  
  /** What was found */
  found?: string;
  
  /** What was expected (from brand profile) */
  expected?: string;
  
  /** Explanation of why this is a violation */
  explanation: string;
  
  /** Suggested alternatives (not auto-applied) */
  suggestion?: string;
  suggestions?: string[];
  
  /** Confidence in this violation detection */
  confidence: number;
  
  /** Brand rule that was violated */
  ruleReference?: string;
  violatedRule?: string;
  
  /** Timestamp */
  detectedAt: string;
}

export interface ViolationLocation {
  /** Character offset in content */
  startIndex: number;
  endIndex: number;
  startOffset?: number;
  endOffset?: number;
  
  /** Line number (if applicable) */
  lineNumber?: number;
  
  /** Context snippet */
  excerpt?: string;
  contextSnippet?: string;
}

/**
 * Full compliance check result
 */
export interface BrandComplianceResult {
  /** Result ID (optional for simple checks) */
  id?: string;
  projectId: string;
  profileId: string;
  
  /** Content that was checked (optional) */
  contentId?: string;
  contentType?: 'proposed_change' | 'existing_content' | 'action_output';
  
  /** Overall compliance status */
  status?: ComplianceStatus;
  
  /** Compliance score (0 = many violations, 1 = perfect) */
  complianceScore?: number;
  overallScore?: number;
  
  /** All violations found */
  violations: BrandViolation[];
  
  /** Blocking violations count */
  blockingCount?: number;
  
  /** Warning violations count */
  warningCount?: number;
  
  /** Info violations count */
  infoCount?: number;
  
  /** Style similarity score (0-1) */
  styleSimilarity?: number;
  
  /** Can execution proceed? */
  canProceed: boolean;
  
  /** Human-readable summary */
  summary?: string;
  
  /** Explanation for decision */
  explanation?: string;
  
  /** Recommendations */
  recommendations?: string[];
  
  checkedAt: string;
  checkDurationMs?: number;
  durationMs?: number;
}

export enum ComplianceStatus {
  /** No violations, proceed */
  COMPLIANT = 'compliant',
  
  /** Warnings only, can proceed with caution */
  WARNING = 'warning',
  
  /** Blocking violations, cannot proceed */
  BLOCKED = 'blocked',
}

// ============================================================================
// BRAND DRIFT MONITORING
// ============================================================================

/**
 * Drift measurement for a single check
 */
export interface DriftMeasurement {
  id: string;
  projectId: string;
  
  /** Timestamp of measurement */
  measuredAt: string;
  
  /** Content that was measured */
  contentId: string;
  
  /** Style attribute drifts */
  attributeDrifts: AttributeDrift[];
  
  /** Overall drift score (0 = on brand, 1 = completely off) */
  overallDrift: number;
  
  /** Trend direction */
  trendDirection: 'improving' | 'stable' | 'degrading';
}

export interface AttributeDrift {
  attribute: keyof StyleAttributes;
  expectedValue: number;
  actualValue: number;
  drift: number; // Absolute difference
  driftPercent: number; // Percentage difference
}

/**
 * Long-term drift trend
 */
export interface DriftTrend {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  
  /** Measurements in this period */
  measurementCount: number;
  
  /** Average drift over period */
  avgDrift: number;
  
  /** Drift trend (positive = getting worse) */
  trendSlope: number;
  
  /** Most common violation types */
  topViolationTypes: { type: ViolationType; count: number }[];
  
  /** Recommendation based on trend */
  recommendation: string;
}

// ============================================================================
// LEARNING INPUT
// ============================================================================

/**
 * Document used for brand learning
 */
export interface BrandLearningDocument {
  id: string;
  projectId: string;
  
  /** Document content */
  content: string;
  
  /** Document title */
  title?: string;
  
  /** Document type */
  documentType: LearningDocumentType;
  
  /** Performance metrics (if available) */
  performanceMetrics?: DocumentPerformanceMetrics;
  
  /** Manual approval status */
  approvalStatus: ApprovalStatus;
  
  /** Weight for learning (higher = more influence) */
  learningWeight: number;
  
  addedAt: string;
}

export type LearningDocumentType = 
  | 'high_performing_article'
  | 'manually_approved'
  | 'brand_guideline'
  | 'example_content'
  | 'reference_content';

export interface DocumentPerformanceMetrics {
  pageViews?: number;
  avgTimeOnPage?: number;
  bounceRate?: number;
  conversionRate?: number;
  engagementScore?: number;
}

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Brand guardrail configuration
 */
export interface BrandGuardrailConfig {
  projectId?: string;
  
  /** Minimum documents for reliable profile */
  minDocumentsForLearning: number;
  
  /** Style similarity threshold for warnings */
  warningThreshold: number;
  
  /** Style similarity threshold for blocking */
  blockingThreshold: number;
  
  /** Enable drift monitoring */
  enableDriftMonitoring: boolean;
  
  /** Drift alert threshold */
  driftAlertThreshold: number;
  
  /** Custom violation severity overrides */
  severityOverrides: Partial<Record<ViolationType, ViolationSeverity>>;
  
  /** Enable pre-execution checks */
  enablePreExecutionCheck: boolean;
  
  /** Enable post-execution monitoring */
  enablePostExecutionMonitoring: boolean;
  
  /** Minimum compliance score to proceed */
  minComplianceScore: number;
  
  /** Block on tone mismatch */
  blockOnToneMismatch: boolean;
  
  /** Style deviation tolerance (0-1) */
  styleDeviationTolerance: number;
  
  /** Keyword stuffing threshold (word frequency) */
  keywordStuffingThreshold: number;
}

export const DEFAULT_BRAND_GUARDRAIL_CONFIG: BrandGuardrailConfig = {
  minDocumentsForLearning: 5,
  warningThreshold: 0.70,
  blockingThreshold: 0.50,
  enableDriftMonitoring: true,
  driftAlertThreshold: 0.25,
  severityOverrides: {},
  enablePreExecutionCheck: true,
  enablePostExecutionMonitoring: true,
  minComplianceScore: 0.6,
  blockOnToneMismatch: false,
  styleDeviationTolerance: 0.25,
  keywordStuffingThreshold: 0.03,
};

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

/**
 * Brand guardrail audit entry
 */
export interface BrandAuditEntry {
  id: string;
  timestamp: string;
  projectId: string;
  
  /** Event type */
  eventType: BrandAuditEventType;
  
  /** Related content/action ID */
  relatedId: string;
  
  /** Compliance result (if applicable) */
  complianceResult?: BrandComplianceResult;
  
  /** Action taken */
  actionTaken: 'allowed' | 'blocked' | 'warning_logged' | 'profile_updated';
  
  /** Explanation */
  explanation: string;
  
  /** Actor */
  actorId: string;
}

export type BrandAuditEventType = 
  | 'compliance_check'
  | 'profile_learned'
  | 'profile_updated'
  | 'violation_detected'
  | 'execution_blocked'
  | 'drift_alert';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { SEOAction, ActionType } from '../autonomous_agent/models';
