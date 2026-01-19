/**
 * Entity + Internal Linking Agent
 * 
 * Exports all public components
 */

// Main agent
export { EntityLinkingAgent } from './agent_runner';

// Models
export {
  // Enums
  EntityType,
  RelationType,
  LinkStrength,
  ContentHealth,
  TaskStatus,
  
  // Input types
  ContentItem,
  ContentItemSchema,
  EntityLinkingTask,
  EntityLinkingTaskSchema,
  
  // Entity types
  Entity,
  EntityRelation,
  TopicCluster,
  
  // Link types
  ExistingLink,
  LinkSuggestion,
  SuggestedAnchor,
  LinkReasoning,
  ContentLinkAnalysis,
  LinkIssue,
  
  // Schema types
  GeneratedSchema,
  
  // Output types
  EntityLinkingResult,
  ResultSummary,
} from './models';

// Config
export { Config, loadConfig, DEFAULT_CONFIG } from './config';

// Components (for advanced usage)
export { EntityExtractor } from './entity_extractor';
export { EntityGraphBuilder } from './entity_graph_builder';
export { InternalLinkAnalyzer } from './internal_link_analyzer';
export { LinkSuggester } from './link_suggester';
export { SchemaGenerator } from './schema_generator';

// Logger
export { Logger, createLogger } from './logger';
