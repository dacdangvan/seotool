/**
 * Brand Style Learner v1.4
 * 
 * Learns brand style from approved content to build a Brand Style Profile.
 * 
 * Learning Sources:
 * - High-performing articles
 * - Manually approved content
 * - Brand guidelines
 * 
 * Extracted Signals:
 * - Tone and formality
 * - Sentence length distribution
 * - Vocabulary preferences
 * - CTA patterns
 * - Structure patterns
 * 
 * Design Principles:
 * - Deterministic extraction (same content → same signals)
 * - No hallucinated rules (only what's in the content)
 * - Explainable learning (can trace back to source)
 * - Statistical aggregation across documents
 */

import {
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
  LearningMetadata,
  BrandLearningDocument,
  LearningDocumentType,
} from './models';

const ALGORITHM_VERSION = '1.4.0';

// ============================================================================
// TEXT ANALYSIS UTILITIES
// ============================================================================

/**
 * Basic text statistics
 */
interface TextStats {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  avgWordLength: number;
  uniqueWords: number;
  vocabularyDiversity: number;
}

/**
 * Analyze basic text statistics
 */
function analyzeTextStats(text: string): TextStats {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();
  
  // Word analysis
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(wordCount, 1);
  
  // Unique words (lowercased)
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, ''))).size;
  const vocabularyDiversity = uniqueWords / Math.max(wordCount, 1);
  
  // Sentence analysis
  const sentences = normalized.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;
  
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(sentenceCount, 1);
  
  // Standard deviation of sentence length
  const variance = sentenceLengths.reduce(
    (sum, len) => sum + Math.pow(len - avgSentenceLength, 2), 0
  ) / Math.max(sentenceCount, 1);
  const sentenceLengthStdDev = Math.sqrt(variance);
  
  // Paragraph analysis
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length;
  
  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    avgSentenceLength,
    sentenceLengthStdDev,
    avgWordLength,
    uniqueWords,
    vocabularyDiversity,
  };
}

/**
 * Extract word frequencies
 */
function extractWordFrequencies(text: string): Map<string, number> {
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2); // Skip very short words
  
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  // Normalize to frequencies (0-1)
  const maxFreq = Math.max(...freq.values());
  for (const [word, count] of freq.entries()) {
    freq.set(word, count / maxFreq);
  }
  
  return freq;
}

// ============================================================================
// TONE DETECTION
// ============================================================================

/**
 * Tone indicators for detection
 */
const TONE_INDICATORS: Record<ToneDescriptor, { words: string[]; patterns: RegExp[] }> = {
  professional: {
    words: ['therefore', 'consequently', 'furthermore', 'regarding', 'pursuant', 'accordingly'],
    patterns: [/\b(in accordance with|with respect to|it is important to note)\b/gi],
  },
  friendly: {
    words: ['hey', 'awesome', 'great', 'love', 'excited', 'amazing', 'wonderful'],
    patterns: [/\b(can't wait|so excited|really love)\b/gi, /!{2,}/g],
  },
  authoritative: {
    words: ['must', 'should', 'essential', 'critical', 'fundamental', 'imperative'],
    patterns: [/\b(it is essential|you must|always|never)\b/gi],
  },
  conversational: {
    words: ['you', 'your', 'we', 'our', 'let\'s', 'gonna', 'wanna'],
    patterns: [/\b(you know|by the way|here's the thing)\b/gi, /\?/g],
  },
  educational: {
    words: ['learn', 'understand', 'example', 'explain', 'guide', 'tutorial', 'step'],
    patterns: [/\b(for example|in this guide|let's learn|how to)\b/gi],
  },
  inspirational: {
    words: ['dream', 'achieve', 'success', 'journey', 'transform', 'empower', 'believe'],
    patterns: [/\b(you can|believe in|reach your|achieve your)\b/gi],
  },
  urgent: {
    words: ['now', 'immediately', 'urgent', 'limited', 'hurry', 'today', 'act'],
    patterns: [/\b(act now|don't miss|limited time|hurry)\b/gi, /!{1,}/g],
  },
  empathetic: {
    words: ['understand', 'feel', 'struggle', 'challenge', 'support', 'help', 'care'],
    patterns: [/\b(we understand|we're here|you're not alone)\b/gi],
  },
  neutral: {
    words: [],
    patterns: [],
  },
};

/**
 * Detect primary and secondary tones
 */
function detectTones(text: string): { primary: ToneDescriptor; secondary: ToneDescriptor[] } {
  const scores: Record<ToneDescriptor, number> = {
    professional: 0,
    friendly: 0,
    authoritative: 0,
    conversational: 0,
    educational: 0,
    inspirational: 0,
    urgent: 0,
    empathetic: 0,
    neutral: 0,
  };
  
  const lowerText = text.toLowerCase();
  
  for (const [tone, indicators] of Object.entries(TONE_INDICATORS) as [ToneDescriptor, typeof TONE_INDICATORS[ToneDescriptor]][]) {
    // Word matches
    for (const word of indicators.words) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        scores[tone] += matches.length;
      }
    }
    
    // Pattern matches
    for (const pattern of indicators.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        scores[tone] += matches.length * 2; // Patterns weighted higher
      }
    }
  }
  
  // Sort by score
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score > 0);
  
  if (sorted.length === 0) {
    return { primary: 'neutral', secondary: [] };
  }
  
  const primary = sorted[0][0] as ToneDescriptor;
  const secondary = sorted.slice(1, 3)
    .filter(([, score]) => score >= sorted[0][1] * 0.3)
    .map(([tone]) => tone as ToneDescriptor);
  
  return { primary, secondary };
}

/**
 * Detect point of view
 */
function detectPointOfView(text: string): PointOfView {
  const firstSingular = (text.match(/\b(I|me|my|mine)\b/gi) || []).length;
  const firstPlural = (text.match(/\b(we|us|our|ours)\b/gi) || []).length;
  const secondPerson = (text.match(/\b(you|your|yours)\b/gi) || []).length;
  
  const max = Math.max(firstSingular, firstPlural, secondPerson);
  
  if (max === 0) return 'third_person';
  if (firstSingular === max) return 'first_person_singular';
  if (firstPlural === max) return 'first_person_plural';
  return 'second_person';
}

/**
 * Detect reader addressing style
 */
function detectReaderAddressing(text: string): ReaderAddressing {
  const directAddressing = (text.match(/\b(you|your|yours)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;
  const ratio = directAddressing / wordCount;
  
  if (ratio > 0.02) return 'direct';
  if (ratio > 0.005) return 'mixed';
  return 'indirect';
}

// ============================================================================
// STYLE ATTRIBUTE DETECTION
// ============================================================================

/**
 * Formality indicators
 */
const FORMAL_WORDS = ['therefore', 'consequently', 'furthermore', 'however', 'nevertheless', 'regarding', 'pursuant', 'accordingly', 'henceforth', 'whereby'];
const INFORMAL_WORDS = ['gonna', 'wanna', 'kinda', 'sorta', 'yeah', 'nope', 'cool', 'awesome', 'stuff', 'things', 'lots'];
const CONTRACTIONS = /\b(can't|won't|don't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|couldn't|wouldn't|shouldn't|let's|it's|that's|there's|here's|what's|who's)\b/gi;

/**
 * Detect formality level (0 = casual, 1 = formal)
 */
function detectFormality(text: string): number {
  const lowerText = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;
  
  let formalScore = 0;
  let informalScore = 0;
  
  // Formal word count
  for (const word of FORMAL_WORDS) {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    formalScore += matches * 2;
  }
  
  // Informal word count
  for (const word of INFORMAL_WORDS) {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    informalScore += matches * 3;
  }
  
  // Contractions indicate informality
  const contractions = (text.match(CONTRACTIONS) || []).length;
  informalScore += contractions;
  
  // Exclamation marks indicate informality
  const exclamations = (text.match(/!/g) || []).length;
  informalScore += exclamations * 0.5;
  
  // Calculate ratio
  const total = formalScore + informalScore;
  if (total === 0) return 0.5; // Neutral
  
  const formality = formalScore / total;
  return Math.min(1, Math.max(0, formality));
}

/**
 * Detect technical level (0 = layperson, 1 = expert)
 */
function detectTechnicalLevel(text: string): number {
  const stats = analyzeTextStats(text);
  
  // Longer words = more technical
  const wordLengthScore = Math.min(1, (stats.avgWordLength - 4) / 4);
  
  // Lower vocabulary diversity = more technical (specialized terms)
  const diversityScore = 1 - stats.vocabularyDiversity;
  
  // Sentence complexity
  const sentenceScore = Math.min(1, (stats.avgSentenceLength - 10) / 20);
  
  return (wordLengthScore * 0.4 + diversityScore * 0.3 + sentenceScore * 0.3);
}

/**
 * Detect emotional intensity (0 = neutral, 1 = emotional)
 */
function detectEmotionalIntensity(text: string): number {
  const emotionalWords = [
    'love', 'hate', 'amazing', 'terrible', 'incredible', 'awful',
    'fantastic', 'horrible', 'wonderful', 'disaster', 'excited',
    'frustrated', 'thrilled', 'devastated', 'delighted', 'furious',
  ];
  
  const lowerText = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;
  
  let emotionalCount = 0;
  for (const word of emotionalWords) {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    emotionalCount += matches;
  }
  
  // Exclamation marks
  const exclamations = (text.match(/!/g) || []).length;
  emotionalCount += exclamations * 0.3;
  
  // Caps lock words (shouting)
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  emotionalCount += capsWords * 0.5;
  
  const ratio = emotionalCount / wordCount * 20;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * Detect assertiveness (0 = hedging, 1 = definitive)
 */
function detectAssertiveness(text: string): number {
  const hedgingWords = ['might', 'maybe', 'perhaps', 'possibly', 'could', 'somewhat', 'kind of', 'sort of', 'appears', 'seems', 'likely'];
  const assertiveWords = ['will', 'must', 'definitely', 'certainly', 'always', 'never', 'absolutely', 'guaranteed', 'proven'];
  
  const lowerText = text.toLowerCase();
  
  let hedgingCount = 0;
  let assertiveCount = 0;
  
  for (const word of hedgingWords) {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    hedgingCount += matches;
  }
  
  for (const word of assertiveWords) {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    assertiveCount += matches;
  }
  
  const total = hedgingCount + assertiveCount;
  if (total === 0) return 0.5;
  
  return assertiveCount / total;
}

/**
 * Detect persuasion level (0 = informational, 1 = sales-focused)
 */
function detectPersuasionLevel(text: string): number {
  const persuasivePatterns = [
    /\b(buy|purchase|order|get yours|sign up|subscribe|register|join)\b/gi,
    /\b(limited time|exclusive|special offer|discount|free|bonus)\b/gi,
    /\b(don't miss|act now|hurry|today only|last chance)\b/gi,
    /\b(best|top|#1|number one|leading|premier)\b/gi,
    /\b(guarantee|risk-free|money back|no obligation)\b/gi,
  ];
  
  const wordCount = text.split(/\s+/).length;
  let persuasiveCount = 0;
  
  for (const pattern of persuasivePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      persuasiveCount += matches.length;
    }
  }
  
  const ratio = persuasiveCount / wordCount * 50;
  return Math.min(1, Math.max(0, ratio));
}

// ============================================================================
// CTA DETECTION
// ============================================================================

const CTA_PATTERNS = [
  /\b(click here|learn more|read more|find out|discover|explore)\b/gi,
  /\b(sign up|subscribe|register|join|get started)\b/gi,
  /\b(buy now|shop now|order now|add to cart|purchase)\b/gi,
  /\b(download|get your|claim your|request|contact us)\b/gi,
  /\b(try|start|begin|schedule|book)\b/gi,
];

const CTA_VERBS = ['click', 'learn', 'read', 'find', 'discover', 'explore', 'sign', 'subscribe', 'register', 'join', 'get', 'buy', 'shop', 'order', 'add', 'purchase', 'download', 'claim', 'request', 'contact', 'try', 'start', 'begin', 'schedule', 'book'];

/**
 * Extract CTA patterns from text
 */
function extractCTAPatterns(text: string): Partial<CTAPatterns> {
  const phrases: string[] = [];
  
  for (const pattern of CTA_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      phrases.push(...matches.map(m => m.toLowerCase()));
    }
  }
  
  // Deduplicate
  const uniquePhrases = [...new Set(phrases)];
  
  // Count CTAs
  const wordCount = text.split(/\s+/).length;
  const frequency = (uniquePhrases.length / wordCount) * 1000;
  
  // Detect intensity
  const urgentPatterns = (text.match(/\b(now|today|limited|hurry|act fast)\b/gi) || []).length;
  const intensityLevel = Math.min(1, urgentPatterns / Math.max(uniquePhrases.length, 1));
  
  // Extract verbs used
  const usedVerbs = CTA_VERBS.filter(verb => 
    new RegExp(`\\b${verb}\\b`, 'gi').test(text)
  );
  
  return {
    commonPhrases: uniquePhrases.slice(0, 10),
    frequency,
    intensityLevel,
    preferredVerbs: usedVerbs,
  };
}

// ============================================================================
// BRAND STYLE LEARNER CLASS
// ============================================================================

export class BrandStyleLearner {
  private documents: BrandLearningDocument[] = [];
  private logger: Console;
  
  constructor() {
    this.logger = console;
  }
  
  /**
   * Add document for learning
   */
  addDocument(document: BrandLearningDocument): void {
    this.documents.push(document);
    this.logger.log(`[BrandStyleLearner] Added document: ${document.id} (${document.documentType})`);
  }
  
  /**
   * Add multiple documents
   */
  addDocuments(documents: BrandLearningDocument[]): void {
    for (const doc of documents) {
      this.addDocument(doc);
    }
  }
  
  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documents.length;
  }
  
  /**
   * Clear all documents
   */
  clearDocuments(): void {
    this.documents = [];
  }
  
  /**
   * Learn brand style profile from added documents
   */
  learn(projectId: string, profileName: string): BrandStyleProfile {
    if (this.documents.length === 0) {
      throw new Error('No documents to learn from');
    }
    
    this.logger.log(`[BrandStyleLearner] Learning from ${this.documents.length} documents`);
    
    // Analyze each document
    const analyses = this.documents.map(doc => this.analyzeDocument(doc));
    
    // Aggregate results
    const styleAttributes = this.aggregateStyleAttributes(analyses);
    const vocabulary = this.aggregateVocabulary(analyses);
    const toneProfile = this.aggregateToneProfile(analyses);
    const structurePatterns = this.aggregateStructurePatterns(analyses);
    const ctaPatterns = this.aggregateCTAPatterns(analyses);
    
    // Build profile
    const profile: BrandStyleProfile = {
      id: `profile-${projectId}-${Date.now()}`,
      projectId,
      name: profileName,
      styleAttributes,
      vocabulary,
      toneProfile,
      structurePatterns,
      ctaPatterns,
      prohibitedPatterns: this.getDefaultProhibitedPatterns(),
      learningMetadata: {
        documentCount: this.documents.length,
        totalWordsAnalyzed: analyses.reduce((sum, a) => sum + a.stats.wordCount, 0),
        sourceDocumentIds: this.documents.map(d => d.id),
        lastLearnedAt: new Date().toISOString(),
        profileConfidence: this.calculateProfileConfidence(),
        algorithmVersion: ALGORITHM_VERSION,
      },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.logger.log(`[BrandStyleLearner] Created profile: ${profile.id}`);
    this.logger.log(`[BrandStyleLearner] Profile confidence: ${(profile.learningMetadata.profileConfidence * 100).toFixed(1)}%`);
    
    return profile;
  }
  
  /**
   * Analyze a single document
   */
  private analyzeDocument(doc: BrandLearningDocument): DocumentAnalysis {
    const text = doc.content;
    const stats = analyzeTextStats(text);
    const tones = detectTones(text);
    const wordFreq = extractWordFrequencies(text);
    const ctaPatterns = extractCTAPatterns(text);
    
    return {
      documentId: doc.id,
      documentType: doc.documentType,
      weight: doc.learningWeight,
      stats,
      formality: detectFormality(text),
      technicalLevel: detectTechnicalLevel(text),
      emotionalIntensity: detectEmotionalIntensity(text),
      assertiveness: detectAssertiveness(text),
      persuasionLevel: detectPersuasionLevel(text),
      primaryTone: tones.primary,
      secondaryTones: tones.secondary,
      pointOfView: detectPointOfView(text),
      readerAddressing: detectReaderAddressing(text),
      wordFrequencies: wordFreq,
      ctaPatterns,
    };
  }
  
  /**
   * Aggregate style attributes across documents
   */
  private aggregateStyleAttributes(analyses: DocumentAnalysis[]): StyleAttributes {
    const weightedSum = (prop: keyof Pick<DocumentAnalysis, 'formality' | 'technicalLevel' | 'emotionalIntensity' | 'assertiveness' | 'persuasionLevel'>) => {
      let sum = 0;
      let totalWeight = 0;
      for (const a of analyses) {
        sum += a[prop] * a.weight;
        totalWeight += a.weight;
      }
      return sum / Math.max(totalWeight, 1);
    };
    
    return {
      formality: weightedSum('formality'),
      technicalLevel: weightedSum('technicalLevel'),
      emotionalIntensity: weightedSum('emotionalIntensity'),
      assertiveness: weightedSum('assertiveness'),
      persuasionLevel: weightedSum('persuasionLevel'),
    };
  }
  
  /**
   * Aggregate vocabulary across documents
   */
  private aggregateVocabulary(analyses: DocumentAnalysis[]): VocabularyProfile {
    // Merge word frequencies
    const mergedFreq = new Map<string, number>();
    
    for (const analysis of analyses) {
      for (const [word, freq] of analysis.wordFrequencies.entries()) {
        const current = mergedFreq.get(word) || 0;
        mergedFreq.set(word, current + freq * analysis.weight);
      }
    }
    
    // Normalize
    const maxFreq = Math.max(...mergedFreq.values());
    const normalized: Record<string, number> = {};
    for (const [word, freq] of mergedFreq.entries()) {
      normalized[word] = freq / maxFreq;
    }
    
    // Extract preferred terms (top 50 by frequency, excluding common words)
    const commonWords = new Set(['the', 'and', 'for', 'that', 'with', 'this', 'are', 'was', 'were', 'have', 'has', 'had', 'not', 'but', 'from', 'they', 'which', 'their', 'been', 'would', 'could', 'should', 'will', 'can']);
    const preferred = Object.entries(normalized)
      .filter(([word]) => !commonWords.has(word) && word.length > 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50);
    
    const preferredTerms: Record<string, number> = {};
    for (const [word, freq] of preferred) {
      preferredTerms[word] = freq;
    }
    
    // Calculate average complexity and diversity
    const avgComplexity = analyses.reduce((sum, a) => sum + a.stats.avgWordLength * a.weight, 0) /
      analyses.reduce((sum, a) => sum + a.weight, 0);
    
    const avgDiversity = analyses.reduce((sum, a) => sum + a.stats.vocabularyDiversity * a.weight, 0) /
      analyses.reduce((sum, a) => sum + a.weight, 0);
    
    return {
      preferredTerms,
      avoidedTerms: [], // Will be populated from prohibited patterns
      industryTerms: [], // Would need industry context
      brandPhrases: [], // Would need explicit input
      avgWordComplexity: avgComplexity,
      vocabularyDiversity: avgDiversity,
    };
  }
  
  /**
   * Aggregate tone profile across documents
   */
  private aggregateToneProfile(analyses: DocumentAnalysis[]): ToneProfile {
    // Count tone occurrences
    const toneCount: Record<ToneDescriptor, number> = {
      professional: 0,
      friendly: 0,
      authoritative: 0,
      conversational: 0,
      educational: 0,
      inspirational: 0,
      urgent: 0,
      empathetic: 0,
      neutral: 0,
    };
    
    for (const a of analyses) {
      toneCount[a.primaryTone] += 2 * a.weight;
      for (const secondary of a.secondaryTones) {
        toneCount[secondary] += a.weight;
      }
    }
    
    // Find primary and secondary
    const sorted = Object.entries(toneCount)
      .sort(([, a], [, b]) => b - a)
      .filter(([, count]) => count > 0);
    
    const primaryTone = (sorted[0]?.[0] || 'neutral') as ToneDescriptor;
    const secondaryTones = sorted.slice(1, 3)
      .filter(([, count]) => count >= sorted[0][1] * 0.3)
      .map(([tone]) => tone as ToneDescriptor);
    
    // Aggregate point of view
    const povCount: Record<PointOfView, number> = {
      first_person_singular: 0,
      first_person_plural: 0,
      second_person: 0,
      third_person: 0,
    };
    
    for (const a of analyses) {
      povCount[a.pointOfView] += a.weight;
    }
    
    const pointOfView = Object.entries(povCount)
      .sort(([, a], [, b]) => b - a)[0][0] as PointOfView;
    
    // Aggregate reader addressing
    const addressingCount: Record<ReaderAddressing, number> = {
      direct: 0,
      indirect: 0,
      mixed: 0,
    };
    
    for (const a of analyses) {
      addressingCount[a.readerAddressing] += a.weight;
    }
    
    const readerAddressing = Object.entries(addressingCount)
      .sort(([, a], [, b]) => b - a)[0][0] as ReaderAddressing;
    
    // Humor level based on friendly/conversational tones
    const humorLevel = (toneCount.friendly + toneCount.conversational) /
      Object.values(toneCount).reduce((a, b) => a + b, 0.01);
    
    return {
      primaryTone,
      secondaryTones,
      pointOfView,
      readerAddressing,
      humorLevel: Math.min(1, humorLevel),
    };
  }
  
  /**
   * Aggregate structure patterns across documents
   */
  private aggregateStructurePatterns(analyses: DocumentAnalysis[]): StructurePatterns {
    const totalWeight = analyses.reduce((sum, a) => sum + a.weight, 0);
    
    const avgSentenceLength = analyses.reduce(
      (sum, a) => sum + a.stats.avgSentenceLength * a.weight, 0
    ) / totalWeight;
    
    const sentenceLengthStdDev = analyses.reduce(
      (sum, a) => sum + a.stats.sentenceLengthStdDev * a.weight, 0
    ) / totalWeight;
    
    const avgParagraphLength = analyses.reduce(
      (sum, a) => sum + (a.stats.sentenceCount / Math.max(a.stats.paragraphCount, 1)) * a.weight, 0
    ) / totalWeight;
    
    // Calculate min/max from std dev
    const minSentenceLength = Math.max(3, Math.floor(avgSentenceLength - 2 * sentenceLengthStdDev));
    const maxSentenceLength = Math.ceil(avgSentenceLength + 2 * sentenceLengthStdDev);
    
    return {
      avgSentenceLength,
      sentenceLengthStdDev,
      minSentenceLength,
      maxSentenceLength,
      avgParagraphLength,
      headingFrequency: 5, // Default, would need actual heading detection
      listFrequency: 3, // Default, would need actual list detection
      questionFrequency: 2, // Default, would need question detection
    };
  }
  
  /**
   * Aggregate CTA patterns across documents
   */
  private aggregateCTAPatterns(analyses: DocumentAnalysis[]): CTAPatterns {
    const allPhrases: string[] = [];
    const allVerbs: string[] = [];
    let totalFrequency = 0;
    let totalIntensity = 0;
    let count = 0;
    
    for (const a of analyses) {
      if (a.ctaPatterns.commonPhrases) {
        allPhrases.push(...a.ctaPatterns.commonPhrases);
      }
      if (a.ctaPatterns.preferredVerbs) {
        allVerbs.push(...a.ctaPatterns.preferredVerbs);
      }
      if (a.ctaPatterns.frequency !== undefined) {
        totalFrequency += a.ctaPatterns.frequency * a.weight;
        count += a.weight;
      }
      if (a.ctaPatterns.intensityLevel !== undefined) {
        totalIntensity += a.ctaPatterns.intensityLevel * a.weight;
      }
    }
    
    // Deduplicate and count
    const phraseCount = new Map<string, number>();
    for (const phrase of allPhrases) {
      phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
    }
    
    const verbCount = new Map<string, number>();
    for (const verb of allVerbs) {
      verbCount.set(verb, (verbCount.get(verb) || 0) + 1);
    }
    
    return {
      commonPhrases: [...phraseCount.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([phrase]) => phrase),
      placementPreferences: ['conclusion', 'mid_content'] as CTAPlacement[],
      intensityLevel: count > 0 ? totalIntensity / count : 0.3,
      frequency: count > 0 ? totalFrequency / count : 2,
      preferredVerbs: [...verbCount.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([verb]) => verb),
    };
  }
  
  /**
   * Get default prohibited patterns
   */
  private getDefaultProhibitedPatterns(): ProhibitedPatterns {
    return {
      prohibitedPhrases: [
        'click here',
        'buy now',
        'act now',
        'limited time offer',
      ],
      regexPatterns: [
        {
          pattern: '\\b(fuck|shit|damn|ass|bitch)\\b',
          description: 'Profanity',
          severity: 'blocking' as any,
        },
        {
          pattern: '(\\b\\w+\\b)(?:\\s+\\1){3,}',
          description: 'Keyword stuffing (word repeated 4+ times)',
          severity: 'blocking' as any,
        },
      ],
      competitorMentions: [],
      sensitiveTopics: [],
      overPromotionalTriggers: [
        'guaranteed results',
        '100% satisfaction',
        'best in the world',
        'unbeatable price',
        'once in a lifetime',
      ],
    };
  }
  
  /**
   * Calculate profile confidence based on sample size and diversity
   */
  private calculateProfileConfidence(): number {
    const docCount = this.documents.length;
    
    // More documents = higher confidence (diminishing returns)
    const sampleSizeConfidence = Math.min(1, docCount / 20);
    
    // Diversity of document types
    const types = new Set(this.documents.map(d => d.documentType));
    const typeConfidence = Math.min(1, types.size / 3);
    
    // Check for approved documents
    const approvedCount = this.documents.filter(d => d.approvalStatus === 'approved').length;
    const approvalConfidence = approvedCount / Math.max(docCount, 1);
    
    return (sampleSizeConfidence * 0.4 + typeConfidence * 0.3 + approvalConfidence * 0.3);
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface DocumentAnalysis {
  documentId: string;
  documentType: LearningDocumentType;
  weight: number;
  stats: TextStats;
  formality: number;
  technicalLevel: number;
  emotionalIntensity: number;
  assertiveness: number;
  persuasionLevel: number;
  primaryTone: ToneDescriptor;
  secondaryTones: ToneDescriptor[];
  pointOfView: PointOfView;
  readerAddressing: ReaderAddressing;
  wordFrequencies: Map<string, number>;
  ctaPatterns: Partial<CTAPatterns>;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  analyzeTextStats,
  extractWordFrequencies,
  detectTones,
  detectFormality,
  detectTechnicalLevel,
  detectEmotionalIntensity,
  detectAssertiveness,
  detectPersuasionLevel,
  extractCTAPatterns,
};
