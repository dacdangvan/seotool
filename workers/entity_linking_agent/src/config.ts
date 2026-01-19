/**
 * Configuration
 */

export interface Config {
  // Linking limits
  maxLinksPerPage: number;
  minRelevanceScore: number;
  
  // Entity extraction
  minEntityConfidence: number;
  maxEntitiesPerContent: number;
  
  // Topic clustering
  minClusterSize: number;
  clusterSimilarityThreshold: number;
  
  // Schema generation
  includeSchemaGeneration: boolean;
  
  // Health thresholds
  orphanThreshold: number;       // Min incoming links to not be orphan
  weakThreshold: number;         // Min links for healthy status
  overOptimizedThreshold: number; // Max links before over-optimized
}

export const DEFAULT_CONFIG: Config = {
  maxLinksPerPage: 10,
  minRelevanceScore: 0.5,
  minEntityConfidence: 0.6,
  maxEntitiesPerContent: 50,
  minClusterSize: 2,
  clusterSimilarityThreshold: 0.4,
  includeSchemaGeneration: true,
  orphanThreshold: 1,
  weakThreshold: 3,
  overOptimizedThreshold: 15,
};

export function loadConfig(overrides?: Partial<Config>): Config {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}
