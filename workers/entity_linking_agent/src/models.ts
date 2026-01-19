/**
 * Entity + Internal Linking Agent - Domain Models
 * 
 * Based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 4: Entity & Internal Linking Agent
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export enum EntityType {
  BRAND = 'brand',
  TOPIC = 'topic',
  SUBTOPIC = 'subtopic',
  AUTHOR = 'author',
  PRODUCT = 'product',
  LOCATION = 'location',
  EVENT = 'event',
  CONCEPT = 'concept',
}

export enum RelationType {
  TOPIC_SUBTOPIC = 'topic_subtopic',      // Topic → Subtopic
  ARTICLE_TOPIC = 'article_topic',         // Article → Topic
  BRAND_TOPIC = 'brand_topic',             // Brand → Topic
  AUTHOR_ARTICLE = 'author_article',       // Author → Article
  RELATED_TO = 'related_to',               // Generic relation
}

export enum LinkStrength {
  STRONG = 'strong',     // Direct topical match
  MEDIUM = 'medium',     // Related topics
  WEAK = 'weak',         // Tangential connection
}

export enum ContentHealth {
  HEALTHY = 'healthy',           // Well connected
  WEAK = 'weak',                 // Few links
  ORPHAN = 'orphan',             // No incoming links
  OVER_OPTIMIZED = 'over_optimized', // Too many links
}

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

/**
 * Content item from Content Engine (v0.3)
 */
export const ContentItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string(),
  content: z.string(),           // Markdown or HTML content
  primaryKeyword: z.string(),
  supportingKeywords: z.array(z.string()).optional(),
  publishedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  author: z.string().optional(),
  wordCount: z.number().optional(),
  internalLinks: z.array(z.object({
    href: z.string(),
    anchorText: z.string(),
  })).optional(),
});

export type ContentItem = z.infer<typeof ContentItemSchema>;

/**
 * Entity Linking Task - Input from Orchestrator
 */
export const EntityLinkingTaskSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  
  // Content to analyze
  contentItems: z.array(ContentItemSchema),
  
  // Site context
  siteUrl: z.string().url(),
  brandName: z.string(),
  
  // Configuration
  config: z.object({
    maxLinksPerPage: z.number().min(1).max(50).default(10),
    minRelevanceScore: z.number().min(0).max(1).default(0.5),
    includeSchemaGeneration: z.boolean().default(true),
    topicClusteringEnabled: z.boolean().default(true),
  }).optional(),
  
  // Metadata
  createdAt: z.string().datetime().optional(),
});

export type EntityLinkingTask = z.infer<typeof EntityLinkingTaskSchema>;

// =============================================================================
// ENTITY MODELS
// =============================================================================

/**
 * Extracted entity
 */
export interface Entity {
  id: string;
  name: string;
  normalizedName: string;      // Lowercase, trimmed
  type: EntityType;
  mentions: number;            // How many times mentioned
  sourceContentIds: string[];  // Which content items mention this
  confidence: number;          // 0-1 extraction confidence
  metadata: Record<string, unknown>;
}

/**
 * Entity relationship
 */
export interface EntityRelation {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: RelationType;
  weight: number;              // Relationship strength 0-1
  metadata: Record<string, unknown>;
}

/**
 * Topic cluster (topical authority)
 */
export interface TopicCluster {
  id: string;
  pillarTopic: Entity;
  pillarContentId: string | null;  // Main pillar content
  subtopics: Entity[];
  relatedContentIds: string[];
  coherenceScore: number;       // How well cluster holds together
}

// =============================================================================
// INTERNAL LINK MODELS
// =============================================================================

/**
 * Existing internal link
 */
export interface ExistingLink {
  sourceUrl: string;
  sourceContentId: string;
  targetUrl: string;
  targetContentId: string | null;  // null if target not in our content
  anchorText: string;
}

/**
 * Link suggestion
 */
export interface LinkSuggestion {
  id: string;
  sourceUrl: string;
  sourceContentId: string;
  targetUrl: string;
  targetContentId: string;
  
  // Suggested anchor text options
  suggestedAnchors: SuggestedAnchor[];
  
  // Relevance and reasoning
  relevanceScore: number;        // 0-1
  strength: LinkStrength;
  
  // Explainability
  reasoning: LinkReasoning;
}

export interface SuggestedAnchor {
  text: string;
  type: 'exact_match' | 'partial_match' | 'natural' | 'branded';
  seoSafeScore: number;          // 0-1, higher = safer
}

export interface LinkReasoning {
  topicRelevance: string;
  authorityFlow: string;
  userBenefit: string;
  seoImpact: string;
}

/**
 * Content link analysis
 */
export interface ContentLinkAnalysis {
  contentId: string;
  url: string;
  health: ContentHealth;
  
  // Counts
  incomingLinks: number;
  outgoingLinks: number;
  
  // Issues
  issues: LinkIssue[];
  
  // Suggestions
  suggestedLinksTo: string[];    // Content IDs to link TO
  suggestedLinksFrom: string[];  // Content IDs to link FROM
}

export interface LinkIssue {
  type: 'orphan' | 'weak_incoming' | 'weak_outgoing' | 'over_optimized' | 'broken';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// =============================================================================
// SCHEMA.ORG MODELS
// =============================================================================

/**
 * Generated schema.org JSON-LD
 */
export interface GeneratedSchema {
  contentId: string;
  url: string;
  schemaType: 'Article' | 'Organization' | 'Person' | 'BreadcrumbList' | 'FAQPage';
  jsonLd: Record<string, unknown>;
  isValid: boolean;
  validationErrors: string[];
}

// =============================================================================
// OUTPUT MODELS
// =============================================================================

/**
 * Entity Linking Result - Output to Orchestrator
 */
export interface EntityLinkingResult {
  taskId: string;
  status: TaskStatus;
  
  // Extracted entities
  entities: Entity[];
  entityRelations: EntityRelation[];
  
  // Topic clusters
  topicClusters: TopicCluster[];
  
  // Link analysis
  contentAnalysis: ContentLinkAnalysis[];
  existingLinks: ExistingLink[];
  
  // Link suggestions
  linkSuggestions: LinkSuggestion[];
  
  // Generated schemas
  schemas: GeneratedSchema[];
  
  // Summary
  summary: ResultSummary;
  
  // Processing info
  processingTimeMs: number;
  error?: string;
}

export interface ResultSummary {
  totalEntities: number;
  totalRelations: number;
  totalClusters: number;
  
  contentHealthBreakdown: {
    healthy: number;
    weak: number;
    orphan: number;
    overOptimized: number;
  };
  
  totalLinkSuggestions: number;
  highPrioritySuggestions: number;
  
  schemasGenerated: number;
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Content with parsed metadata
 */
export interface ParsedContent {
  item: ContentItem;
  textContent: string;          // Plain text extracted
  existingLinks: ExistingLink[];
  wordCount: number;
}

/**
 * Entity extraction context
 */
export interface ExtractionContext {
  brandName: string;
  siteUrl: string;
  allKeywords: string[];
}
