/**
 * Entity + Internal Linking Agent Runner
 * 
 * Main orchestrator for entity extraction, topic modeling,
 * internal link analysis, and schema generation.
 */

import { v4 as uuid } from 'uuid';
import { Logger } from './logger';
import { Config, loadConfig } from './config';
import {
  EntityLinkingTask,
  EntityLinkingResult,
  TaskStatus,
  ExtractionContext,
  ContentHealth,
} from './models';
import { EntityExtractor } from './entity_extractor';
import { EntityGraphBuilder } from './entity_graph_builder';
import { InternalLinkAnalyzer } from './internal_link_analyzer';
import { LinkSuggester } from './link_suggester';
import { SchemaGenerator } from './schema_generator';

// =============================================================================
// AGENT RUNNER
// =============================================================================

export class EntityLinkingAgent {
  private readonly extractor: EntityExtractor;
  private readonly graphBuilder: EntityGraphBuilder;
  private readonly linkAnalyzer: InternalLinkAnalyzer;
  private readonly linkSuggester: LinkSuggester;
  private readonly config: Config;

  constructor(
    private readonly logger: Logger,
    configOverrides?: Partial<Config>
  ) {
    this.config = loadConfig({
      ...configOverrides,
    });

    this.extractor = new EntityExtractor(this.config, logger);
    this.graphBuilder = new EntityGraphBuilder(this.config, logger);
    this.linkAnalyzer = new InternalLinkAnalyzer(this.config, logger);
    this.linkSuggester = new LinkSuggester(this.config, logger);
  }

  /**
   * Run the entity linking agent
   */
  async run(task: EntityLinkingTask): Promise<EntityLinkingResult> {
    const startTime = Date.now();
    const contentCount = task.contentItems?.length || 0;
    this.logger.info({ taskId: task.id, contentCount }, 'Starting entity linking agent');

    try {
      // Validate input
      if (!task.contentItems || task.contentItems.length === 0) {
        throw new Error('No content items provided');
      }

      // Merge task config with defaults
      const taskConfig = {
        ...this.config,
        ...(task.config || {}),
      };

      // Phase 1: Parse content and extract existing links
      this.logger.info('Phase 1: Parsing content');
      const parsedContents = this.linkAnalyzer.parseContent(
        task.contentItems,
        task.siteUrl
      );

      // Resolve target content IDs for existing links
      for (const content of parsedContents) {
        for (const link of content.existingLinks) {
          const targetContent = parsedContents.find(
            c => c.item.url === link.targetUrl
          );
          if (targetContent) {
            link.targetContentId = targetContent.item.id;
          }
        }
      }

      // Phase 2: Extract entities
      this.logger.info('Phase 2: Extracting entities');
      const extractionContext: ExtractionContext = {
        brandName: task.brandName,
        siteUrl: task.siteUrl,
        allKeywords: task.contentItems.flatMap(item => [
          item.primaryKeyword,
          ...(item.supportingKeywords || []),
        ]),
      };

      const entities = this.extractor.extract(parsedContents, extractionContext);

      // Phase 3: Build entity graph
      this.logger.info('Phase 3: Building entity graph');
      const relations = this.graphBuilder.buildRelations(entities, parsedContents);
      const clusters = this.graphBuilder.buildTopicClusters(entities, relations, parsedContents);

      // Phase 4: Analyze internal links
      this.logger.info('Phase 4: Analyzing internal links');
      const { analysis, existingLinks } = this.linkAnalyzer.analyze(parsedContents);

      // Phase 5: Generate link suggestions
      this.logger.info('Phase 5: Generating link suggestions');
      const linkSuggestions = this.linkSuggester.suggest(
        parsedContents,
        analysis,
        entities,
        clusters
      );

      // Phase 6: Generate schemas
      this.logger.info('Phase 6: Generating schemas');
      const schemaGenerator = new SchemaGenerator(
        taskConfig,
        this.logger,
        task.brandName,
        task.siteUrl
      );
      const schemas = schemaGenerator.generate(parsedContents, entities);

      // Build summary
      const summary = {
        totalEntities: entities.length,
        totalRelations: relations.length,
        totalClusters: clusters.length,
        contentHealthBreakdown: {
          healthy: analysis.filter(a => a.health === ContentHealth.HEALTHY).length,
          weak: analysis.filter(a => a.health === ContentHealth.WEAK).length,
          orphan: analysis.filter(a => a.health === ContentHealth.ORPHAN).length,
          overOptimized: analysis.filter(a => a.health === ContentHealth.OVER_OPTIMIZED).length,
        },
        totalLinkSuggestions: linkSuggestions.length,
        highPrioritySuggestions: linkSuggestions.filter(s => s.relevanceScore >= 0.7).length,
        schemasGenerated: schemas.length,
      };

      const processingTimeMs = Date.now() - startTime;
      this.logger.info({ 
        taskId: task.id, 
        processingTimeMs,
        summary 
      }, 'Entity linking agent completed');

      return {
        taskId: task.id,
        status: TaskStatus.COMPLETED,
        entities,
        entityRelations: relations,
        topicClusters: clusters,
        contentAnalysis: analysis,
        existingLinks,
        linkSuggestions,
        schemas,
        summary,
        processingTimeMs,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ taskId: task.id, error: errorMessage }, 'Entity linking agent failed');

      return {
        taskId: task.id,
        status: TaskStatus.FAILED,
        entities: [],
        entityRelations: [],
        topicClusters: [],
        contentAnalysis: [],
        existingLinks: [],
        linkSuggestions: [],
        schemas: [],
        summary: {
          totalEntities: 0,
          totalRelations: 0,
          totalClusters: 0,
          contentHealthBreakdown: { healthy: 0, weak: 0, orphan: 0, overOptimized: 0 },
          totalLinkSuggestions: 0,
          highPrioritySuggestions: 0,
          schemasGenerated: 0,
        },
        processingTimeMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }
}
