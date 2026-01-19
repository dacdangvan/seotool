/**
 * Brand Compliance Checker v1.4
 * 
 * Validates content against Brand Style Profile.
 * 
 * Check Categories:
 * - Tone compliance
 * - Vocabulary compliance
 * - Structure compliance
 * - CTA compliance
 * - Prohibited pattern detection
 * 
 * Design Principles:
 * - Deterministic checks (same content → same result)
 * - Explainable violations (pinpoint location & reason)
 * - No auto-rewriting (suggest only)
 * - Configurable thresholds
 */

import {
  BrandStyleProfile,
  BrandViolation,
  BrandComplianceResult,
  ViolationType,
  ViolationSeverity,
  BrandGuardrailConfig,
  DEFAULT_BRAND_GUARDRAIL_CONFIG,
} from './models';

import {
  analyzeTextStats,
  detectFormality,
  detectTechnicalLevel,
  detectEmotionalIntensity,
  detectAssertiveness,
  detectPersuasionLevel,
  detectTones,
} from './brand_style_learner';

// ============================================================================
// CHECKER INTERFACE
// ============================================================================

export interface IComplianceChecker {
  check(content: string, profile: BrandStyleProfile, config?: Partial<BrandGuardrailConfig>): BrandComplianceResult;
  checkMultiple(contents: string[], profile: BrandStyleProfile, config?: Partial<BrandGuardrailConfig>): BrandComplianceResult[];
}

// ============================================================================
// BRAND COMPLIANCE CHECKER
// ============================================================================

export class BrandComplianceChecker implements IComplianceChecker {
  private logger: Console;
  
  constructor() {
    this.logger = console;
  }
  
  /**
   * Check content against brand profile
   */
  check(
    content: string,
    profile: BrandStyleProfile,
    config: Partial<BrandGuardrailConfig> = {}
  ): BrandComplianceResult {
    const fullConfig = { ...DEFAULT_BRAND_GUARDRAIL_CONFIG, ...config };
    
    const startTime = Date.now();
    const violations: BrandViolation[] = [];
    
    // Run all checks
    violations.push(...this.checkToneCompliance(content, profile, fullConfig));
    violations.push(...this.checkFormality(content, profile, fullConfig));
    violations.push(...this.checkVocabulary(content, profile, fullConfig));
    violations.push(...this.checkStructure(content, profile, fullConfig));
    violations.push(...this.checkCTAPatterns(content, profile, fullConfig));
    violations.push(...this.checkProhibitedPatterns(content, profile, fullConfig));
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(violations);
    
    // Determine if can proceed
    const hasBlockingViolation = violations.some(v => v.severity === ViolationSeverity.BLOCKING);
    const canProceed = !hasBlockingViolation && overallScore >= fullConfig.minComplianceScore;
    
    // Summary
    const summary = this.generateSummary(violations, overallScore, canProceed);
    
    const checkDurationMs = Date.now() - startTime;
    
    const result: BrandComplianceResult = {
      profileId: profile.id,
      projectId: profile.projectId,
      checkedAt: new Date().toISOString(),
      overallScore,
      canProceed,
      violations,
      summary,
      checkDurationMs,
    };
    
    this.logger.log(
      `[BrandComplianceChecker] Checked content (${content.length} chars): score=${overallScore.toFixed(2)}, violations=${violations.length}, canProceed=${canProceed}`
    );
    
    return result;
  }
  
  /**
   * Check multiple content pieces
   */
  checkMultiple(
    contents: string[],
    profile: BrandStyleProfile,
    config: Partial<BrandGuardrailConfig> = {}
  ): BrandComplianceResult[] {
    return contents.map(content => this.check(content, profile, config));
  }
  
  // ============================================================================
  // TONE CHECKS
  // ============================================================================
  
  private checkToneCompliance(
    content: string,
    profile: BrandStyleProfile,
    config: BrandGuardrailConfig
  ): BrandViolation[] {
    const violations: BrandViolation[] = [];
    
    const detected = detectTones(content);
    const expected = profile.toneProfile.primaryTone;
    
    // Check primary tone mismatch
    if (detected.primary !== expected && detected.primary !== 'neutral') {
      // Check if detected tone is in secondary tones (acceptable)
      const isSecondary = profile.toneProfile.secondaryTones.includes(detected.primary);
      
      if (!isSecondary) {
        violations.push({
          id: this.generateViolationId(),
          type: ViolationType.TONE_MISMATCH,
          severity: config.blockOnToneMismatch ? ViolationSeverity.BLOCKING : ViolationSeverity.WARNING,
          message: `Tone mismatch: detected "${detected.primary}" but brand uses "${expected}"`,
          explanation: `The content's tone (${detected.primary}) doesn't match the brand's expected tone (${expected}). This could create inconsistency in brand voice.`,
          location: {
            startIndex: 0,
            endIndex: Math.min(content.length, 200),
            excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          },
          suggestion: `Consider adjusting the language to be more ${expected}. The brand typically uses ${profile.toneProfile.secondaryTones.length > 0 ? `${expected} as primary tone with ${profile.toneProfile.secondaryTones.join(', ')} as secondary` : expected}.`,
          confidence: 0.8,
          ruleReference: `Brand Profile: ${profile.name}`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
    
    return violations;
  }
  
  private checkFormality(
    content: string,
    profile: BrandStyleProfile,
    config: BrandGuardrailConfig
  ): BrandViolation[] {
    const violations: BrandViolation[] = [];
    
    const detected = detectFormality(content);
    const expected = profile.styleAttributes.formality;
    const tolerance = config.styleDeviationTolerance;
    
    const deviation = Math.abs(detected - expected);
    
    if (deviation > tolerance) {
      const isMoreFormal = detected > expected;
      const severity = deviation > tolerance * 2 ? ViolationSeverity.WARNING : ViolationSeverity.INFO;
      
      violations.push({
        id: this.generateViolationId(),
        type: ViolationType.FORMALITY_DEVIATION,
        severity,
        message: `Formality deviation: ${(deviation * 100).toFixed(0)}% ${isMoreFormal ? 'too formal' : 'too casual'}`,
        explanation: `Content formality (${(detected * 100).toFixed(0)}%) deviates significantly from brand standard (${(expected * 100).toFixed(0)}%).`,
        suggestion: isMoreFormal 
          ? 'Consider using more conversational language, contractions, and simpler words.'
          : 'Consider using more professional vocabulary and avoiding slang or casual expressions.',
        confidence: 0.75,
        ruleReference: `Brand formality: ${(expected * 100).toFixed(0)}%`,
        detectedAt: new Date().toISOString(),
      });
    }
    
    return violations;
  }
  
  // ============================================================================
  // VOCABULARY CHECKS
  // ============================================================================
  
  private checkVocabulary(
    content: string,
    profile: BrandStyleProfile,
    config: BrandGuardrailConfig
  ): BrandViolation[] {
    const violations: BrandViolation[] = [];
    const lowerContent = content.toLowerCase();
    
    // Check for avoided terms
    for (const term of profile.vocabulary.avoidedTerms) {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        violations.push({
          id: this.generateViolationId(),
          type: ViolationType.AVOIDED_VOCABULARY,
          severity: ViolationSeverity.WARNING,
          message: `Avoided term found: "${term}"`,
          explanation: `The term "${term}" is on the brand's avoided vocabulary list.`,
          location: {
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            excerpt: this.getExcerpt(content, match.index, match[0].length),
          },
          suggestion: `Consider replacing "${term}" with a preferred alternative.`,
          confidence: 0.95,
          ruleReference: 'Avoided vocabulary list',
          detectedAt: new Date().toISOString(),
        });
      }
    }
    
    // Check for competitor mentions
    if (profile.prohibitedPatterns.competitorMentions) {
      for (const competitor of profile.prohibitedPatterns.competitorMentions) {
        const regex = new RegExp(`\\b${this.escapeRegex(competitor)}\\b`, 'gi');
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          violations.push({
            id: this.generateViolationId(),
            type: ViolationType.COMPETITOR_MENTION,
            severity: ViolationSeverity.BLOCKING,
            message: `Competitor mention found: "${competitor}"`,
            explanation: `Mentioning competitor "${competitor}" may violate brand guidelines.`,
            location: {
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              excerpt: this.getExcerpt(content, match.index, match[0].length),
            },
            suggestion: 'Remove the competitor mention or rephrase to avoid direct reference.',
            confidence: 0.99,
            ruleReference: 'Competitor mention policy',
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
    
    return violations;
  }
  
  // ============================================================================
  // STRUCTURE CHECKS
  // ============================================================================
  
  private checkStructure(
    content: string,
    profile: BrandStyleProfile,
    config: BrandGuardrailConfig
  ): BrandViolation[] {
    const violations: BrandViolation[] = [];
    
    const stats = analyzeTextStats(content);
    const expectedPatterns = profile.structurePatterns;
    
    // Check sentence length
    if (stats.avgSentenceLength > expectedPatterns.maxSentenceLength) {
      violations.push({
        id: this.generateViolationId(),
        type: ViolationType.SENTENCE_LENGTH,
        severity: ViolationSeverity.INFO,
        message: `Sentences too long: avg ${stats.avgSentenceLength.toFixed(1)} words (max recommended: ${expectedPatterns.maxSentenceLength})`,
        explanation: `The average sentence length exceeds the brand's typical range. Brand content typically has sentences of ${expectedPatterns.avgSentenceLength.toFixed(1)} words.`,
        suggestion: 'Consider breaking long sentences into shorter, more digestible ones.',
        confidence: 0.7,
        ruleReference: `Sentence length guidelines: ${expectedPatterns.minSentenceLength}-${expectedPatterns.maxSentenceLength} words`,
        detectedAt: new Date().toISOString(),
      });
    } else if (stats.avgSentenceLength < expectedPatterns.minSentenceLength) {
      violations.push({
        id: this.generateViolationId(),
        type: ViolationType.SENTENCE_LENGTH,
        severity: ViolationSeverity.INFO,
        message: `Sentences too short: avg ${stats.avgSentenceLength.toFixed(1)} words (min recommended: ${expectedPatterns.minSentenceLength})`,
        explanation: `Sentences are shorter than typical brand content. This may make the content feel choppy.`,
        suggestion: 'Consider combining some short sentences for better flow.',
        confidence: 0.7,
        ruleReference: `Sentence length guidelines: ${expectedPatterns.minSentenceLength}-${expectedPatterns.maxSentenceLength} words`,
        detectedAt: new Date().toISOString(),
      });
    }
    
    // Check readability (vocabulary diversity)
    if (stats.vocabularyDiversity < 0.3) {
      violations.push({
        id: this.generateViolationId(),
        type: ViolationType.READABILITY,
        severity: ViolationSeverity.INFO,
        message: `Low vocabulary diversity: ${(stats.vocabularyDiversity * 100).toFixed(0)}%`,
        explanation: `The content uses a limited vocabulary range, which may indicate repetitive language or keyword stuffing.`,
        suggestion: 'Consider using more varied vocabulary to improve readability and avoid repetition.',
        confidence: 0.65,
        ruleReference: 'Vocabulary diversity standard',
        detectedAt: new Date().toISOString(),
      });
    }
    
    return violations;
  }
  
  // ============================================================================
  // CTA CHECKS
  // ============================================================================
  
  private checkCTAPatterns(
    content: string,
    profile: BrandStyleProfile,
    config: BrandGuardrailConfig
  ): BrandViolation[] {
    const violations: BrandViolation[] = [];
    
    const ctaPatterns = profile.ctaPatterns;
    const wordCount = content.split(/\s+/).length;
    
    // Count CTAs in content
    let ctaCount = 0;
    for (const phrase of ctaPatterns.commonPhrases) {
      const regex = new RegExp(`\\b${this.escapeRegex(phrase)}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) ctaCount += matches.length;
    }
    
    // Check CTA frequency
    const expectedCtaCount = (wordCount / 1000) * ctaPatterns.frequency;
    
    if (ctaCount > expectedCtaCount * 2) {
      violations.push({
        id: this.generateViolationId(),
        type: ViolationType.CTA_OVERUSE,
        severity: ViolationSeverity.WARNING,
        message: `Too many CTAs: ${ctaCount} found (expected ~${expectedCtaCount.toFixed(0)})`,
        explanation: `The content has more call-to-action phrases than typical for this brand, which may feel pushy.`,
        suggestion: 'Consider reducing the number of CTAs to maintain a balanced, informative tone.',
        confidence: 0.7,
        ruleReference: `CTA frequency: ~${ctaPatterns.frequency} per 1000 words`,
        detectedAt: new Date().toISOString(),
      });
    }
    
    // Check CTA intensity
    const urgentPatterns = (content.match(/\b(now|today|limited|hurry|act fast|immediately)\b/gi) || []).length;
    
    if (urgentPatterns > 0 && ctaPatterns.intensityLevel < 0.3) {
      violations.push({
        id: this.generateViolationId(),
        type: ViolationType.CTA_STYLE,
        severity: ViolationSeverity.INFO,
        message: `CTA intensity mismatch: urgent language detected but brand prefers low-intensity CTAs`,
        explanation: `The brand typically uses subtle, non-urgent CTAs. Urgent language like "now", "limited time", etc. may not align with brand voice.`,
        suggestion: 'Consider softening CTA language to match brand style.',
        confidence: 0.65,
        ruleReference: `CTA intensity level: ${(ctaPatterns.intensityLevel * 100).toFixed(0)}%`,
        detectedAt: new Date().toISOString(),
      });
    }
    
    return violations;
  }
  
  // ============================================================================
  // PROHIBITED PATTERN CHECKS
  // ============================================================================
  
  private checkProhibitedPatterns(
    content: string,
    profile: BrandStyleProfile,
    config: BrandGuardrailConfig
  ): BrandViolation[] {
    const violations: BrandViolation[] = [];
    const prohibited = profile.prohibitedPatterns;
    
    // Check prohibited phrases
    for (const phrase of prohibited.prohibitedPhrases) {
      const regex = new RegExp(`\\b${this.escapeRegex(phrase)}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        violations.push({
          id: this.generateViolationId(),
          type: ViolationType.PROHIBITED_PHRASE,
          severity: ViolationSeverity.BLOCKING,
          message: `Prohibited phrase found: "${phrase}"`,
          explanation: `The phrase "${phrase}" is explicitly prohibited in brand content.`,
          location: {
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            excerpt: this.getExcerpt(content, match.index, match[0].length),
          },
          suggestion: 'Remove or rephrase to avoid the prohibited phrase.',
          confidence: 0.99,
          ruleReference: 'Prohibited phrases list',
          detectedAt: new Date().toISOString(),
        });
      }
    }
    
    // Check regex patterns
    for (const patternDef of prohibited.regexPatterns) {
      try {
        const regex = new RegExp(patternDef.pattern, 'gi');
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          violations.push({
            id: this.generateViolationId(),
            type: ViolationType.PROHIBITED_PHRASE,
            severity: patternDef.severity === 'blocking' ? ViolationSeverity.BLOCKING : ViolationSeverity.WARNING,
            message: `Pattern violation: ${patternDef.description}`,
            explanation: `Content matches prohibited pattern: ${patternDef.description}`,
            location: {
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              excerpt: this.getExcerpt(content, match.index, match[0].length),
            },
            suggestion: 'Review and revise the flagged content.',
            confidence: 0.9,
            ruleReference: patternDef.description,
            detectedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        this.logger.warn(`[BrandComplianceChecker] Invalid regex pattern: ${patternDef.pattern}`);
      }
    }
    
    // Check over-promotional triggers
    for (const trigger of prohibited.overPromotionalTriggers) {
      const regex = new RegExp(`\\b${this.escapeRegex(trigger)}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        violations.push({
          id: this.generateViolationId(),
          type: ViolationType.OVER_PROMOTIONAL,
          severity: ViolationSeverity.WARNING,
          message: `Over-promotional language: "${trigger}"`,
          explanation: `The phrase "${trigger}" may be perceived as overly promotional or exaggerated.`,
          location: {
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            excerpt: this.getExcerpt(content, match.index, match[0].length),
          },
          suggestion: 'Consider using more measured, credible language.',
          confidence: 0.85,
          ruleReference: 'Over-promotional triggers list',
          detectedAt: new Date().toISOString(),
        });
      }
    }
    
    // Check keyword stuffing
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 3) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    for (const [word, count] of wordCounts.entries()) {
      const frequency = count / words.length;
      if (frequency > config.keywordStuffingThreshold && count >= 5) {
        violations.push({
          id: this.generateViolationId(),
          type: ViolationType.KEYWORD_STUFFING,
          severity: ViolationSeverity.WARNING,
          message: `Potential keyword stuffing: "${word}" appears ${count} times (${(frequency * 100).toFixed(1)}% of content)`,
          explanation: `The word "${word}" appears unusually frequently, which may be seen as keyword stuffing by search engines.`,
          suggestion: `Consider reducing usage of "${word}" and using synonyms or related terms instead.`,
          confidence: 0.8,
          ruleReference: `Keyword density threshold: ${(config.keywordStuffingThreshold * 100).toFixed(1)}%`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
    
    return violations;
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private calculateOverallScore(violations: BrandViolation[]): number {
    if (violations.length === 0) return 1.0;
    
    // Weight by severity
    const weights: Record<ViolationSeverity, number> = {
      [ViolationSeverity.BLOCKING]: 0.4,
      [ViolationSeverity.WARNING]: 0.15,
      [ViolationSeverity.INFO]: 0.05,
    };
    
    let totalPenalty = 0;
    for (const v of violations) {
      totalPenalty += weights[v.severity];
    }
    
    return Math.max(0, 1 - totalPenalty);
  }
  
  private generateSummary(
    violations: BrandViolation[],
    score: number,
    canProceed: boolean
  ): string {
    const blocking = violations.filter(v => v.severity === ViolationSeverity.BLOCKING);
    const warnings = violations.filter(v => v.severity === ViolationSeverity.WARNING);
    const info = violations.filter(v => v.severity === ViolationSeverity.INFO);
    
    if (violations.length === 0) {
      return 'Content fully compliant with brand guidelines.';
    }
    
    const parts: string[] = [];
    
    if (blocking.length > 0) {
      parts.push(`${blocking.length} blocking issue(s)`);
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning(s)`);
    }
    if (info.length > 0) {
      parts.push(`${info.length} suggestion(s)`);
    }
    
    const status = canProceed ? 'Can proceed with caution.' : 'Cannot proceed - blocking issues must be resolved.';
    
    return `Brand compliance score: ${(score * 100).toFixed(0)}%. Found ${parts.join(', ')}. ${status}`;
  }
  
  private generateViolationId(): string {
    return `violation-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  private getExcerpt(content: string, index: number, matchLength: number): string {
    const contextBefore = 30;
    const contextAfter = 30;
    
    const start = Math.max(0, index - contextBefore);
    const end = Math.min(content.length, index + matchLength + contextAfter);
    
    let excerpt = content.substring(start, end);
    
    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';
    
    return excerpt;
  }
}

// ============================================================================
// EXPORT FACTORY
// ============================================================================

export function createComplianceChecker(): BrandComplianceChecker {
  return new BrandComplianceChecker();
}
