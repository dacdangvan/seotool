# Entity + Internal Linking Agent v0.5.0

Part of the AI SEO Tool - Agent-based architecture for automated SEO optimization.

## Overview

This agent handles:
1. **Entity Extraction** - Extract and classify entities from content
2. **Entity Graph Building** - Build relationships and topic clusters
3. **Internal Link Analysis** - Detect orphan and weakly connected content
4. **Link Suggestions** - Generate SEO-safe internal link recommendations
5. **Schema Generation** - Create schema.org JSON-LD markup

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  EntityLinkingAgent                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ EntityExtractor │  │ EntityGraphBuilder│                 │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ InternalLink    │  │ LinkSuggester   │                   │
│  │ Analyzer        │  │                 │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌─────────────────────────────────────────┐                │
│  │          SchemaGenerator                 │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Installation

```bash
cd workers/entity_linking_agent
npm install
```

## Usage

### As a standalone CLI

```bash
npm run dev
```

### As a module

```typescript
import { EntityLinkingAgent, EntityLinkingTask } from './src';
import pino from 'pino';

const logger = pino();
const agent = new EntityLinkingAgent(logger);

const task: EntityLinkingTask = {
  id: 'task-uuid',
  planId: 'plan-uuid',
  contentItems: [
    {
      id: 'content-1',
      url: 'https://example.com/seo-guide',
      title: 'Complete SEO Guide',
      content: '<p>Your content here...</p>',
      primaryKeyword: 'SEO guide',
      supportingKeywords: ['on-page SEO', 'technical SEO'],
      author: 'John Doe',
    },
    // ... more content items
  ],
  siteUrl: 'https://example.com',
  brandName: 'Your Brand',
  config: {
    maxLinksPerPage: 10,
    minRelevanceScore: 0.5,
    includeSchemaGeneration: true,
    topicClusteringEnabled: true,
  },
};

const result = await agent.run(task);
console.log(result);
```

## Input Schema

### EntityLinkingTask

```typescript
interface EntityLinkingTask {
  id: string;                    // UUID
  planId: string;                // UUID
  contentItems: ContentItem[];   // Content to analyze
  siteUrl: string;               // Base URL
  brandName: string;             // Brand name for entity extraction
  config?: {
    maxLinksPerPage?: number;    // Default: 10
    minRelevanceScore?: number;  // Default: 0.5
    includeSchemaGeneration?: boolean; // Default: true
    topicClusteringEnabled?: boolean;  // Default: true
  };
}

interface ContentItem {
  id: string;
  url: string;
  title: string;
  content: string;               // HTML or Markdown
  primaryKeyword: string;
  supportingKeywords?: string[];
  author?: string;
  publishedAt?: string;          // ISO datetime
  wordCount?: number;
  internalLinks?: Array<{ href: string; anchorText: string }>;
}
```

## Output Schema

### EntityLinkingResult

```typescript
interface EntityLinkingResult {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  entities: Entity[];            // Extracted entities
  entityRelations: EntityRelation[];
  topicClusters: TopicCluster[];
  
  contentAnalysis: ContentLinkAnalysis[];
  existingLinks: ExistingLink[];
  linkSuggestions: LinkSuggestion[];
  
  schemas: GeneratedSchema[];    // JSON-LD schemas
  
  summary: ResultSummary;
  processingTimeMs: number;
  error?: string;
}
```

## Features

### Entity Types
- `brand` - Brand/company entities
- `topic` - Main topic entities
- `subtopic` - Supporting topic entities
- `author` - Author/person entities
- `product` - Product entities
- `location` - Geographic entities
- `event` - Event entities
- `concept` - Abstract concept entities

### Content Health Statuses
- `healthy` - Well connected (sufficient incoming/outgoing links)
- `weak` - Few links (needs improvement)
- `orphan` - No incoming links (critical issue)
- `over_optimized` - Too many outgoing links

### Link Suggestion Features
- SEO-safe anchor text suggestions
- Multiple anchor types: `natural`, `exact_match`, `partial_match`, `branded`
- Relevance scoring (0-1)
- Detailed reasoning for each suggestion

### Schema Generation
- Article schema
- Organization schema
- Person (Author) schema
- Validates schema structure

## Testing

```bash
npm test
```

## Configuration

Default thresholds can be customized:

```typescript
import { loadConfig } from './src';

const config = loadConfig({
  maxLinksPerPage: 15,
  minRelevanceScore: 0.6,
  minEntityConfidence: 0.7,
  orphanThreshold: 2,
  weakThreshold: 5,
  overOptimizedThreshold: 20,
});
```

## Constraints

- **Deterministic output** - Same input always produces same output
- **Explainable decisions** - Every suggestion includes reasoning
- **SEO-safe defaults** - No keyword stuffing or over-optimization
- **Idempotent execution** - Can be run multiple times safely

## License

ISC
