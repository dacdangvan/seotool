/**
 * Internal Link Analyzer
 * 
 * Analyzes existing internal links:
 * - Detects orphan content
 * - Identifies weakly connected articles
 * - Calculates content health
 */

import {
  ContentItem,
  ParsedContent,
  ExistingLink,
  ContentLinkAnalysis,
  ContentHealth,
  LinkIssue,
} from './models';
import { Config } from './config';
import { Logger } from './logger';

// =============================================================================
// INTERNAL LINK ANALYZER
// =============================================================================

export class InternalLinkAnalyzer {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger
  ) {}

  /**
   * Parse content and extract existing links
   */
  parseContent(items: ContentItem[], siteUrl: string): ParsedContent[] {
    this.logger.info({ itemCount: items.length }, 'Parsing content for link analysis');

    const parsedContents: ParsedContent[] = [];

    for (const item of items) {
      const { textContent, links } = this.extractContentAndLinks(item, siteUrl);
      
      parsedContents.push({
        item,
        textContent,
        existingLinks: links,
        wordCount: item.wordCount || this.countWords(textContent),
      });
    }

    return parsedContents;
  }

  /**
   * Analyze link structure across all content
   */
  analyze(
    parsedContents: ParsedContent[]
  ): { analysis: ContentLinkAnalysis[]; existingLinks: ExistingLink[] } {
    this.logger.info({ contentCount: parsedContents.length }, 'Analyzing internal links');

    // Collect all existing links
    const allLinks: ExistingLink[] = [];
    for (const content of parsedContents) {
      allLinks.push(...content.existingLinks);
    }

    // Build incoming/outgoing link counts
    const incomingCounts = new Map<string, number>();
    const outgoingCounts = new Map<string, number>();

    // Initialize counts
    for (const content of parsedContents) {
      incomingCounts.set(content.item.id, 0);
      outgoingCounts.set(content.item.id, 0);
    }

    // Count links
    for (const link of allLinks) {
      // Outgoing from source
      const currentOutgoing = outgoingCounts.get(link.sourceContentId) || 0;
      outgoingCounts.set(link.sourceContentId, currentOutgoing + 1);

      // Incoming to target
      if (link.targetContentId) {
        const currentIncoming = incomingCounts.get(link.targetContentId) || 0;
        incomingCounts.set(link.targetContentId, currentIncoming + 1);
      }
    }

    // Analyze each content piece
    const analysis: ContentLinkAnalysis[] = [];

    for (const content of parsedContents) {
      const incoming = incomingCounts.get(content.item.id) || 0;
      const outgoing = outgoingCounts.get(content.item.id) || 0;
      
      const health = this.calculateHealth(incoming, outgoing);
      const issues = this.detectIssues(incoming, outgoing, health);

      // Find suggested links (content that should link to/from this)
      const suggestedLinksTo = this.findLinkTargets(content, parsedContents, allLinks);
      const suggestedLinksFrom = this.findLinkSources(content, parsedContents, allLinks);

      analysis.push({
        contentId: content.item.id,
        url: content.item.url,
        health,
        incomingLinks: incoming,
        outgoingLinks: outgoing,
        issues,
        suggestedLinksTo,
        suggestedLinksFrom,
      });
    }

    this.logger.info({
      healthy: analysis.filter(a => a.health === ContentHealth.HEALTHY).length,
      weak: analysis.filter(a => a.health === ContentHealth.WEAK).length,
      orphan: analysis.filter(a => a.health === ContentHealth.ORPHAN).length,
    }, 'Link analysis completed');

    return { analysis, existingLinks: allLinks };
  }

  /**
   * Extract text content and links from HTML/Markdown
   */
  private extractContentAndLinks(
    item: ContentItem,
    siteUrl: string
  ): { textContent: string; links: ExistingLink[] } {
    const content = item.content;
    const links: ExistingLink[] = [];

    // If content has pre-extracted links, use them
    if (item.internalLinks && item.internalLinks.length > 0) {
      for (const link of item.internalLinks) {
        links.push({
          sourceUrl: item.url,
          sourceContentId: item.id,
          targetUrl: link.href,
          targetContentId: null, // Will be resolved later
          anchorText: link.anchorText,
        });
      }
      
      // Extract text (strip HTML)
      const textContent = this.stripHtml(content);
      return { textContent, links };
    }

    // Parse HTML to extract links using regex
    const htmlLinks = this.extractHtmlLinks(content, siteUrl, item);
    const textContent = this.stripHtml(content);
    
    // Also check for markdown links
    const markdownLinks = this.extractMarkdownLinks(content, siteUrl, item);
    
    return { 
      textContent, 
      links: [...htmlLinks, ...markdownLinks] 
    };
  }

  /**
   * Extract links from HTML content using regex
   */
  private extractHtmlLinks(
    content: string,
    siteUrl: string,
    item: ContentItem
  ): ExistingLink[] {
    const links: ExistingLink[] = [];
    // Match <a href="...">...</a> patterns
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      const href = match[1];
      const anchorText = match[2].replace(/<[^>]*>/g, '').trim(); // Strip nested HTML
      
      if (this.isInternalLink(href, siteUrl)) {
        links.push({
          sourceUrl: item.url,
          sourceContentId: item.id,
          targetUrl: this.normalizeUrl(href, siteUrl),
          targetContentId: null,
          anchorText,
        });
      }
    }

    return links;
  }

  /**
   * Extract links from Markdown content
   */
  private extractMarkdownLinks(
    content: string,
    siteUrl: string,
    item: ContentItem
  ): ExistingLink[] {
    const links: ExistingLink[] = [];
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      const anchorText = match[1];
      const href = match[2];
      
      if (this.isInternalLink(href, siteUrl)) {
        links.push({
          sourceUrl: item.url,
          sourceContentId: item.id,
          targetUrl: this.normalizeUrl(href, siteUrl),
          targetContentId: null,
          anchorText,
        });
      }
    }

    return links;
  }

  /**
   * Check if link is internal
   */
  private isInternalLink(href: string, siteUrl: string): boolean {
    if (href.startsWith('/')) return true;
    if (href.startsWith('#')) return false;
    
    try {
      const linkUrl = new URL(href, siteUrl);
      const siteHost = new URL(siteUrl).hostname;
      return linkUrl.hostname === siteHost;
    } catch {
      return false;
    }
  }

  /**
   * Normalize URL
   */
  private normalizeUrl(href: string, siteUrl: string): string {
    try {
      const url = new URL(href, siteUrl);
      return url.href;
    } catch {
      return href;
    }
  }

  /**
   * Calculate content health based on link counts
   */
  private calculateHealth(incoming: number, outgoing: number): ContentHealth {
    if (incoming < this.config.orphanThreshold) {
      return ContentHealth.ORPHAN;
    }
    
    if (outgoing > this.config.overOptimizedThreshold) {
      return ContentHealth.OVER_OPTIMIZED;
    }
    
    if (incoming < this.config.weakThreshold || outgoing < 2) {
      return ContentHealth.WEAK;
    }
    
    return ContentHealth.HEALTHY;
  }

  /**
   * Detect link issues
   */
  private detectIssues(
    incoming: number,
    outgoing: number,
    health: ContentHealth
  ): LinkIssue[] {
    const issues: LinkIssue[] = [];

    if (health === ContentHealth.ORPHAN) {
      issues.push({
        type: 'orphan',
        description: `This content has no incoming internal links (${incoming}). It may be difficult for users and search engines to discover.`,
        severity: 'high',
      });
    }

    if (incoming > 0 && incoming < this.config.weakThreshold) {
      issues.push({
        type: 'weak_incoming',
        description: `Only ${incoming} incoming links. Consider adding more links from related content.`,
        severity: 'medium',
      });
    }

    if (outgoing < 2) {
      issues.push({
        type: 'weak_outgoing',
        description: `Only ${outgoing} outgoing internal links. Consider linking to more related content.`,
        severity: 'low',
      });
    }

    if (health === ContentHealth.OVER_OPTIMIZED) {
      issues.push({
        type: 'over_optimized',
        description: `Too many outgoing links (${outgoing}). This may dilute link equity and appear unnatural.`,
        severity: 'medium',
      });
    }

    return issues;
  }

  /**
   * Find content that this should link TO
   */
  private findLinkTargets(
    content: ParsedContent,
    allContents: ParsedContent[],
    existingLinks: ExistingLink[]
  ): string[] {
    const targets: string[] = [];
    const existingTargetUrls = existingLinks
      .filter(l => l.sourceContentId === content.item.id)
      .map(l => l.targetUrl);

    for (const other of allContents) {
      if (other.item.id === content.item.id) continue;
      if (existingTargetUrls.includes(other.item.url)) continue;

      // Check keyword overlap
      if (this.hasKeywordOverlap(content.item, other.item)) {
        targets.push(other.item.id);
      }
    }

    return targets.slice(0, 5); // Limit suggestions
  }

  /**
   * Find content that should link FROM (to this)
   */
  private findLinkSources(
    content: ParsedContent,
    allContents: ParsedContent[],
    existingLinks: ExistingLink[]
  ): string[] {
    const sources: string[] = [];
    const existingSourceIds = existingLinks
      .filter(l => l.targetUrl === content.item.url)
      .map(l => l.sourceContentId);

    for (const other of allContents) {
      if (other.item.id === content.item.id) continue;
      if (existingSourceIds.includes(other.item.id)) continue;

      // Check if other content mentions this content's keyword
      if (this.hasKeywordOverlap(other.item, content.item)) {
        sources.push(other.item.id);
      }
    }

    return sources.slice(0, 5);
  }

  /**
   * Check if two content items have keyword overlap
   */
  private hasKeywordOverlap(a: ContentItem, b: ContentItem): boolean {
    const aKeywords = [
      a.primaryKeyword.toLowerCase(),
      ...(a.supportingKeywords || []).map(k => k.toLowerCase()),
    ];
    const bKeywords = [
      b.primaryKeyword.toLowerCase(),
      ...(b.supportingKeywords || []).map(k => k.toLowerCase()),
    ];

    return aKeywords.some(k => bKeywords.includes(k)) ||
           bKeywords.some(k => aKeywords.includes(k));
  }

  /**
   * Strip HTML tags
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Strip Markdown formatting
   */
  private stripMarkdown(md: string): string {
    return md
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
      .replace(/[*_~`#]/g, '')                   // Formatting
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }
}
