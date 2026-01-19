/**
 * Configuration
 * v0.5.1 - Updated thresholds for SEO safety
 */

export interface Config {
  // Linking limits
  maxLinksPerPage: number;
  minRelevanceScore: number;
  maxNewLinksPerDeployment: number;  // v0.5.1: Link velocity control
  
  // Entity extraction
  minEntityConfidence: number;
  maxEntitiesPerContent: number;
  minKeywordOccurrences: number;     // v0.5.1: Keyword verification
  
  // Topic clustering
  minClusterSize: number;
  clusterSimilarityThreshold: number;
  useLemmatization: boolean;         // v0.5.1: Better similarity
  
  // Schema generation
  includeSchemaGeneration: boolean;
  includeBreadcrumbs: boolean;       // v0.5.1: Breadcrumb support
  
  // Health thresholds
  orphanThreshold: number;           // Min incoming links to not be orphan
  weakThreshold: number;             // Min links for healthy status
  overOptimizedThreshold: number;    // Max links before over-optimized (per 1000 words)
  
  // Anchor diversity (v0.5.1)
  maxKeywordAnchorRatio: number;     // Max % of keyword-containing anchors
  preferNaturalAnchors: boolean;
}

export const DEFAULT_CONFIG: Config = {
  // Linking
  maxLinksPerPage: 10,
  minRelevanceScore: 0.5,
  maxNewLinksPerDeployment: 15,      // v0.5.1: Prevent link velocity spike
  
  // Entity extraction
  minEntityConfidence: 0.6,
  maxEntitiesPerContent: 50,
  minKeywordOccurrences: 2,          // v0.5.1: Keyword must appear 2+ times
  
  // Topic clustering
  minClusterSize: 2,
  clusterSimilarityThreshold: 0.3,   // v0.5.1: Lowered for better clustering
  useLemmatization: true,            // v0.5.1: Enable lemmatization
  
  // Schema generation
  includeSchemaGeneration: true,
  includeBreadcrumbs: true,          // v0.5.1: Generate breadcrumbs
  
  // Health thresholds
  orphanThreshold: 1,
  weakThreshold: 3,
  overOptimizedThreshold: 10,        // v0.5.1: Lowered from 20 to 10
  
  // Anchor diversity
  maxKeywordAnchorRatio: 0.3,        // v0.5.1: Max 30% keyword anchors
  preferNaturalAnchors: true,
};

export function loadConfig(overrides?: Partial<Config>): Config {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}
