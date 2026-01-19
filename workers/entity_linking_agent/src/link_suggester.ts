/**
 * Link Suggester
 * 
 * Suggests internal links based on:
 * - Topic relevance
 * - Authority flow
 * - User benefit
 * 
 * Generates SEO-safe anchor text suggestions
 */

import { v4 as uuid } from 'uuid';
import {
  Entity,
  EntityRelation,
  TopicCluster,
  ParsedContent,
  ContentLinkAnalysis,
  LinkSuggestion,
  SuggestedAnchor,
  LinkReasoning,
  LinkStrength,
  ContentHealth,
} from './models';
import { Config } from './config';
import { Logger } from './logger';

// =============================================================================
// LINK SUGGESTER
// =============================================================================

export class LinkSuggester {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger
  ) {}

  /**
   * Generate link suggestions
   */
  suggest(
    contents: ParsedContent[],
    analysis: ContentLinkAnalysis[],
    entities: Entity[],
    clusters: TopicCluster[]
  ): LinkSuggestion[] {
    this.logger.info('Generating link suggestions');

    const suggestions: LinkSuggestion[] = [];
    const contentMap = new Map(contents.map(c => [c.item.id, c]));
    const analysisMap = new Map(analysis.map(a => [a.contentId, a]));

    // Priority 1: Link to/from orphan content
    const orphanSuggestions = this.suggestForOrphans(
      contents,
      analysis,
      clusters
    );
    suggestions.push(...orphanSuggestions);

    // Priority 2: Link within topic clusters
    const clusterSuggestions = this.suggestWithinClusters(
      contents,
      analysis,
      clusters
    );
    suggestions.push(...clusterSuggestions);

    // Priority 3: Cross-cluster linking for authority flow
    const crossClusterSuggestions = this.suggestCrossCluster(
      contents,
      analysis,
      clusters
    );
    suggestions.push(...crossClusterSuggestions);

    // Deduplicate and filter by relevance
    const filtered = this.filterAndRank(suggestions);

    this.logger.info({ suggestionCount: filtered.length }, 'Link suggestions generated');
    return filtered;
  }

  /**
   * Suggest links for orphan content
   */
  private suggestForOrphans(
    contents: ParsedContent[],
    analysis: ContentLinkAnalysis[],
    clusters: TopicCluster[]
  ): LinkSuggestion[] {
    const suggestions: LinkSuggestion[] = [];
    const orphans = analysis.filter(a => a.health === ContentHealth.ORPHAN);

    for (const orphan of orphans) {
      const orphanContent = contents.find(c => c.item.id === orphan.contentId);
      if (!orphanContent) continue;

      // Find cluster this orphan belongs to
      const cluster = clusters.find(cl => 
        cl.relatedContentIds.includes(orphan.contentId)
      );

      // Find best sources to link FROM
      const sources = this.findBestSources(
        orphanContent,
        contents,
        analysis,
        cluster
      );

      for (const source of sources) {
        suggestions.push(this.createSuggestion(
          source,
          orphanContent,
          LinkStrength.STRONG,
          {
            topicRelevance: 'High relevance - same topic cluster',
            authorityFlow: 'Critical - orphan content needs incoming links to be discoverable',
            userBenefit: 'Helps users discover related content',
            seoImpact: 'Fixes orphan content issue - high priority for crawlability',
          }
        ));
      }
    }

    return suggestions;
  }

  /**
   * Suggest links within topic clusters
   */
  private suggestWithinClusters(
    contents: ParsedContent[],
    analysis: ContentLinkAnalysis[],
    clusters: TopicCluster[]
  ): LinkSuggestion[] {
    const suggestions: LinkSuggestion[] = [];

    for (const cluster of clusters) {
      const clusterContents = contents.filter(c => 
        cluster.relatedContentIds.includes(c.item.id)
      );

      // Link from pillar to supporting content
      if (cluster.pillarContentId) {
        const pillar = contents.find(c => c.item.id === cluster.pillarContentId);
        if (pillar) {
          for (const support of clusterContents) {
            if (support.item.id === pillar.item.id) continue;
            
            const pillarAnalysis = analysis.find(a => a.contentId === pillar.item.id);
            const supportAnalysis = analysis.find(a => a.contentId === support.item.id);

            // Check if link already exists
            if (pillarAnalysis?.suggestedLinksTo.includes(support.item.id)) {
              suggestions.push(this.createSuggestion(
                pillar,
                support,
                LinkStrength.STRONG,
                {
                  topicRelevance: `Both in "${cluster.pillarTopic.name}" cluster`,
                  authorityFlow: 'Pillar → Supporting: Distributes authority to related content',
                  userBenefit: 'Helps users explore subtopics from main guide',
                  seoImpact: 'Strengthens topical authority and cluster structure',
                }
              ));
            }

            // Also suggest linking back to pillar
            if (supportAnalysis?.suggestedLinksTo.includes(pillar.item.id)) {
              suggestions.push(this.createSuggestion(
                support,
                pillar,
                LinkStrength.MEDIUM,
                {
                  topicRelevance: `Both in "${cluster.pillarTopic.name}" cluster`,
                  authorityFlow: 'Supporting → Pillar: Reinforces pillar as main resource',
                  userBenefit: 'Helps users find comprehensive guide on topic',
                  seoImpact: 'Strengthens pillar page authority',
                }
              ));
            }
          }
        }
      }

      // Link between supporting content
      for (let i = 0; i < clusterContents.length; i++) {
        for (let j = i + 1; j < clusterContents.length; j++) {
          const a = clusterContents[i];
          const b = clusterContents[j];
          
          const analysisA = analysis.find(an => an.contentId === a.item.id);
          
          if (analysisA?.suggestedLinksTo.includes(b.item.id)) {
            suggestions.push(this.createSuggestion(
              a,
              b,
              LinkStrength.MEDIUM,
              {
                topicRelevance: `Related content in "${cluster.pillarTopic.name}" cluster`,
                authorityFlow: 'Peer linking strengthens cluster cohesion',
                userBenefit: 'Helps users find related subtopics',
                seoImpact: 'Improves internal link structure',
              }
            ));
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Suggest cross-cluster links
   */
  private suggestCrossCluster(
    contents: ParsedContent[],
    analysis: ContentLinkAnalysis[],
    clusters: TopicCluster[]
  ): LinkSuggestion[] {
    const suggestions: LinkSuggestion[] = [];

    // Find related clusters (by keyword overlap)
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const clusterA = clusters[i];
        const clusterB = clusters[j];

        // Check if clusters are related
        if (!this.areClustersRelated(clusterA, clusterB)) continue;

        // Suggest linking pillar pages
        if (clusterA.pillarContentId && clusterB.pillarContentId) {
          const pillarA = contents.find(c => c.item.id === clusterA.pillarContentId);
          const pillarB = contents.find(c => c.item.id === clusterB.pillarContentId);

          if (pillarA && pillarB) {
            suggestions.push(this.createSuggestion(
              pillarA,
              pillarB,
              LinkStrength.WEAK,
              {
                topicRelevance: `Related topics: "${clusterA.pillarTopic.name}" and "${clusterB.pillarTopic.name}"`,
                authorityFlow: 'Cross-cluster linking distributes authority between topic areas',
                userBenefit: 'Helps users discover related topic areas',
                seoImpact: 'Moderate - builds site-wide topical relevance',
              }
            ));
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Find best source pages to link FROM
   */
  private findBestSources(
    target: ParsedContent,
    contents: ParsedContent[],
    analysis: ContentLinkAnalysis[],
    cluster: TopicCluster | undefined
  ): ParsedContent[] {
    const sources: Array<{ content: ParsedContent; score: number }> = [];

    for (const content of contents) {
      if (content.item.id === target.item.id) continue;

      let score = 0;

      // Same cluster = higher score
      if (cluster && cluster.relatedContentIds.includes(content.item.id)) {
        score += 0.5;
        
        // Pillar page = even higher
        if (content.item.id === cluster.pillarContentId) {
          score += 0.3;
        }
      }

      // Keyword overlap
      if (this.hasKeywordOverlap(content.item, target.item)) {
        score += 0.3;
      }

      // Healthy content = better source
      const contentAnalysis = analysis.find(a => a.contentId === content.item.id);
      if (contentAnalysis?.health === ContentHealth.HEALTHY) {
        score += 0.2;
      }

      if (score > 0) {
        sources.push({ content, score });
      }
    }

    return sources
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.content);
  }

  /**
   * Create a link suggestion
   */
  private createSuggestion(
    source: ParsedContent,
    target: ParsedContent,
    strength: LinkStrength,
    reasoning: LinkReasoning
  ): LinkSuggestion {
    const anchors = this.generateAnchorSuggestions(target);
    const relevanceScore = this.calculateRelevanceScore(source, target, strength);

    return {
      id: uuid(),
      sourceUrl: source.item.url,
      sourceContentId: source.item.id,
      targetUrl: target.item.url,
      targetContentId: target.item.id,
      suggestedAnchors: anchors,
      relevanceScore,
      strength,
      reasoning,
    };
  }

  /**
   * Generate anchor text suggestions
   */
  private generateAnchorSuggestions(target: ParsedContent): SuggestedAnchor[] {
    const anchors: SuggestedAnchor[] = [];

    // Natural anchor (from title)
    if (target.item.title) {
      anchors.push({
        text: target.item.title,
        type: 'natural',
        seoSafeScore: 0.9,
      });

      // Shorter version if title is long
      if (target.item.title.length > 50) {
        const shortTitle = target.item.title.split(/[:|–-]/)[0].trim();
        anchors.push({
          text: shortTitle,
          type: 'natural',
          seoSafeScore: 0.95,
        });
      }
    }

    // Partial match anchor (primary keyword variation)
    const keyword = target.item.primaryKeyword;
    anchors.push({
      text: `learn more about ${keyword}`,
      type: 'partial_match',
      seoSafeScore: 0.85,
    });

    anchors.push({
      text: `${keyword} guide`,
      type: 'partial_match',
      seoSafeScore: 0.8,
    });

    // Generic safe anchors
    anchors.push({
      text: 'read more',
      type: 'natural',
      seoSafeScore: 0.7,
    });

    anchors.push({
      text: 'learn more',
      type: 'natural',
      seoSafeScore: 0.7,
    });

    return anchors;
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevanceScore(
    source: ParsedContent,
    target: ParsedContent,
    strength: LinkStrength
  ): number {
    let score = 0;

    // Base score from strength
    switch (strength) {
      case LinkStrength.STRONG:
        score = 0.8;
        break;
      case LinkStrength.MEDIUM:
        score = 0.6;
        break;
      case LinkStrength.WEAK:
        score = 0.4;
        break;
    }

    // Boost for keyword overlap
    if (this.hasKeywordOverlap(source.item, target.item)) {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Check if clusters are related
   */
  private areClustersRelated(a: TopicCluster, b: TopicCluster): boolean {
    // Check if pillar topics have keyword overlap
    const aWords = a.pillarTopic.normalizedName.split(' ');
    const bWords = b.pillarTopic.normalizedName.split(' ');
    
    return aWords.some(w => bWords.includes(w) && w.length > 3);
  }

  /**
   * Check keyword overlap between content items
   */
  private hasKeywordOverlap(
    a: { primaryKeyword: string; supportingKeywords?: string[] },
    b: { primaryKeyword: string; supportingKeywords?: string[] }
  ): boolean {
    const aKeywords = [
      a.primaryKeyword.toLowerCase(),
      ...(a.supportingKeywords || []).map((k: string) => k.toLowerCase()),
    ];
    const bKeywords = [
      b.primaryKeyword.toLowerCase(),
      ...(b.supportingKeywords || []).map((k: string) => k.toLowerCase()),
    ];

    // Check for exact keyword match
    for (const ak of aKeywords) {
      for (const bk of bKeywords) {
        if (ak === bk) return true;
        
        // Check word overlap
        const aWords = ak.split(' ');
        const bWords = bk.split(' ');
        const overlap = aWords.filter(w => bWords.includes(w) && w.length > 3);
        if (overlap.length >= 1) return true;
      }
    }

    return false;
  }

  /**
   * Filter and rank suggestions
   */
  private filterAndRank(suggestions: LinkSuggestion[]): LinkSuggestion[] {
    // Deduplicate by source-target pair
    const seen = new Set<string>();
    const unique: LinkSuggestion[] = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.sourceContentId}-${suggestion.targetContentId}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    // Filter by minimum relevance
    const filtered = unique.filter(s => s.relevanceScore >= this.config.minRelevanceScore);

    // Sort by relevance score
    return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
