/**
 * Content Engine - Domain Models
 * 
 * Based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 2: AI Content Engine
 * 
 * Defines the data structures for:
 * - Task input from Orchestrator
 * - Generated content output
 * - Internal content models
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export enum SearchIntent {
  INFORMATIONAL = 'informational',
  COMMERCIAL = 'commercial',
  TRANSACTIONAL = 'transactional',
  NAVIGATIONAL = 'navigational',
}

export enum ContentStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ContentType {
  ARTICLE = 'article',
  LANDING_PAGE = 'landing_page',
  PRODUCT_PAGE = 'product_page',
  GUIDE = 'guide',
}

// =============================================================================
// INPUT SCHEMAS (from Orchestrator)
// =============================================================================

/**
 * Keyword from Keyword Intelligence Agent
 */
export const KeywordSchema = z.object({
  text: z.string(),
  searchVolume: z.number().optional().default(0),
  intent: z.nativeEnum(SearchIntent).optional(),
  intentConfidence: z.number().min(0).max(1).optional(),
});

export type Keyword = z.infer<typeof KeywordSchema>;

/**
 * Content Generation Task - Input from Orchestrator
 */
export const ContentGenerationTaskSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  
  // Primary keyword to target
  primaryKeyword: KeywordSchema,
  
  // Supporting keywords from cluster
  supportingKeywords: z.array(KeywordSchema).default([]),
  
  // Search intent (from keyword analysis)
  searchIntent: z.nativeEnum(SearchIntent),
  
  // Target language/locale
  targetLanguage: z.string().default('en-US'),
  
  // Content type
  contentType: z.nativeEnum(ContentType).default(ContentType.ARTICLE),
  
  // Optional target URL for optimization
  targetUrl: z.string().url().optional(),
  
  // Optional brand/author info for EEAT
  brandName: z.string().optional(),
  authorName: z.string().optional(),
  
  // Custom instructions
  customInstructions: z.string().optional(),
  
  // Metadata
  createdAt: z.string().datetime().optional(),
});

export type ContentGenerationTask = z.infer<typeof ContentGenerationTaskSchema>;

// =============================================================================
// OUTPUT SCHEMAS (to Orchestrator)
// =============================================================================

/**
 * Article Outline - H1 to H3 structure
 */
export interface ArticleOutline {
  h1: string;
  sections: ArticleSection[];
}

export interface ArticleSection {
  h2: string;
  subsections: string[]; // H3 headings
  keyPoints?: string[];
}

/**
 * SEO Metadata
 */
export interface SeoMetadata {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
}

/**
 * FAQ Schema (JSON-LD)
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

/**
 * Generated Content - Full article with all components
 */
export interface GeneratedContent {
  // Article content
  outline: ArticleOutline;
  markdownContent: string;
  wordCount: number;
  
  // SEO metadata
  seoMetadata: SeoMetadata;
  
  // Structured data
  faqSchema: FaqSchema;
  
  // Quality metrics
  readabilityScore?: number;
  keywordDensity?: number;
}

/**
 * Content Generation Result - Output to Orchestrator
 */
export interface ContentGenerationResult {
  taskId: string;
  status: ContentStatus;
  
  // Generated content (null if failed)
  content: GeneratedContent | null;
  
  // Timing
  processingTimeMs: number;
  
  // Error info (if failed)
  error?: string;
  
  // Metadata
  metadata: {
    primaryKeyword: string;
    targetLanguage: string;
    contentType: ContentType;
    generatedAt: string;
    modelUsed?: string;
  };
}

// =============================================================================
// INTERNAL MODELS
// =============================================================================

/**
 * Content stored in database
 */
export interface StoredContent {
  id: string;
  taskId: string;
  planId: string;
  
  // Content
  primaryKeyword: string;
  outline: ArticleOutline;
  markdownContent: string;
  htmlContent?: string;
  
  // Metadata
  seoMetadata: SeoMetadata;
  faqSchema: FaqSchema;
  
  // Stats
  wordCount: number;
  status: ContentStatus;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LLM Provider configuration
 */
export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Prompt context for content generation
 */
export interface PromptContext {
  primaryKeyword: string;
  supportingKeywords: string[];
  searchIntent: SearchIntent;
  contentType: ContentType;
  targetLanguage: string;
  brandName?: string;
  authorName?: string;
  customInstructions?: string;
}
