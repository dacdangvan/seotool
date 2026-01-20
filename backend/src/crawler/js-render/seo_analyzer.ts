/**
 * SEO Analyzer (Post-render)
 * 
 * Analyzes extracted SEO data and generates issues/recommendations.
 */

import {
  ExtractedSeoData,
  SeoAnalysisResult,
  SeoIssue,
  SeoIssueType,
  SEO_THRESHOLDS
} from './types';

export class SeoAnalyzer {
  /**
   * Analyze extracted SEO data and generate report
   */
  analyze(url: string, data: ExtractedSeoData): SeoAnalysisResult {
    const issues: SeoIssue[] = [];

    // Analyze each aspect
    this.analyzeTitle(data, issues);
    this.analyzeMetaDescription(data, issues);
    this.analyzeHeadings(data, issues);
    this.analyzeCanonical(data, issues);
    this.analyzeRobots(data, issues);
    this.analyzeContent(data, issues);
    this.analyzeLinks(data, issues);
    this.analyzeStructuredData(data, issues);
    this.analyzeTechnical(data, issues);

    // Calculate overall score
    const score = this.calculateScore(issues);

    return {
      url,
      renderMode: data.renderMode,
      extractedData: data,
      issues,
      score,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze page title
   */
  private analyzeTitle(data: ExtractedSeoData, issues: SeoIssue[]): void {
    const { title } = data;
    const { minLength, maxLength } = SEO_THRESHOLDS.title;

    if (!title) {
      issues.push({
        type: 'missing_title',
        severity: 'error',
        message: 'Page is missing a title tag',
        recommendation: 'Add a descriptive <title> tag between 50-60 characters'
      });
      return;
    }

    if (title.length < minLength) {
      issues.push({
        type: 'title_too_short',
        severity: 'warning',
        message: `Title is too short (${title.length} characters)`,
        details: `Current title: "${title}"`,
        recommendation: `Expand the title to at least ${minLength} characters`
      });
    }

    if (title.length > maxLength) {
      issues.push({
        type: 'title_too_long',
        severity: 'warning',
        message: `Title is too long (${title.length} characters)`,
        details: `Current title: "${title.substring(0, 70)}..."`,
        recommendation: `Shorten the title to ${maxLength} characters or less to prevent truncation in search results`
      });
    }
  }

  /**
   * Analyze meta description
   */
  private analyzeMetaDescription(data: ExtractedSeoData, issues: SeoIssue[]): void {
    const { metaDescription } = data;
    const { minLength, maxLength } = SEO_THRESHOLDS.metaDescription;

    if (!metaDescription) {
      issues.push({
        type: 'missing_meta_description',
        severity: 'warning',
        message: 'Page is missing a meta description',
        recommendation: 'Add a compelling meta description between 120-155 characters'
      });
      return;
    }

    if (metaDescription.length < minLength) {
      issues.push({
        type: 'meta_description_too_short',
        severity: 'info',
        message: `Meta description is too short (${metaDescription.length} characters)`,
        details: `Current description: "${metaDescription}"`,
        recommendation: `Expand the meta description to at least ${minLength} characters`
      });
    }

    if (metaDescription.length > maxLength) {
      issues.push({
        type: 'meta_description_too_long',
        severity: 'info',
        message: `Meta description is too long (${metaDescription.length} characters)`,
        details: `Current description: "${metaDescription.substring(0, 100)}..."`,
        recommendation: `Shorten the meta description to ${maxLength} characters or less`
      });
    }
  }

  /**
   * Analyze heading structure
   */
  private analyzeHeadings(data: ExtractedSeoData, issues: SeoIssue[]): void {
    const { h1, h2, headingStructure } = data;
    const { maxLength } = SEO_THRESHOLDS.h1;

    // Check H1
    if (h1.length === 0) {
      issues.push({
        type: 'missing_h1',
        severity: 'error',
        message: 'Page is missing an H1 heading',
        recommendation: 'Add a single, descriptive H1 heading that includes your main keyword'
      });
    } else if (h1.length > 1) {
      issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        message: `Page has ${h1.length} H1 headings`,
        details: `H1s found: ${h1.map(h => `"${h}"`).join(', ')}`,
        recommendation: 'Use only one H1 heading per page'
      });
    } else if (h1[0] && h1[0].length > maxLength) {
      issues.push({
        type: 'h1_too_long',
        severity: 'info',
        message: `H1 is too long (${h1[0].length} characters)`,
        details: `Current H1: "${h1[0].substring(0, 50)}..."`,
        recommendation: `Keep H1 under ${maxLength} characters`
      });
    }

    // Check heading hierarchy
    if (headingStructure.length > 0) {
      const hierarchyIssues = this.checkHeadingHierarchy(headingStructure);
      if (hierarchyIssues.length > 0) {
        issues.push({
          type: 'heading_hierarchy_broken',
          severity: 'warning',
          message: 'Heading hierarchy has issues',
          details: hierarchyIssues.join('; '),
          recommendation: 'Use headings in proper hierarchical order (H1 → H2 → H3)'
        });
      }
    }
  }

  /**
   * Check heading hierarchy for issues
   */
  private checkHeadingHierarchy(structure: ExtractedSeoData['headingStructure']): string[] {
    const issues: string[] = [];
    let lastLevel = 0;

    const checkNode = (node: typeof structure[0], path: string = '') => {
      const currentPath = path ? `${path} > H${node.level}` : `H${node.level}`;
      
      // Check for skipped levels
      if (lastLevel > 0 && node.level > lastLevel + 1) {
        issues.push(`Skipped heading level: ${currentPath} (jumped from H${lastLevel})`);
      }
      
      lastLevel = node.level;

      if (node.children) {
        for (const child of node.children) {
          checkNode(child, currentPath);
        }
      }
    };

    for (const node of structure) {
      checkNode(node);
    }

    return issues;
  }

  /**
   * Analyze canonical tag
   */
  private analyzeCanonical(data: ExtractedSeoData, issues: SeoIssue[]): void {
    if (!data.canonical) {
      issues.push({
        type: 'missing_canonical',
        severity: 'info',
        message: 'Page is missing a canonical tag',
        recommendation: 'Add a canonical tag to prevent duplicate content issues'
      });
    }
  }

  /**
   * Analyze robots directives
   */
  private analyzeRobots(data: ExtractedSeoData, issues: SeoIssue[]): void {
    if (data.hasNoindex) {
      issues.push({
        type: 'noindex_detected',
        severity: 'warning',
        message: 'Page has noindex directive',
        details: 'This page will not be indexed by search engines',
        recommendation: 'Remove noindex if you want this page to appear in search results'
      });
    }
  }

  /**
   * Analyze content quality
   */
  private analyzeContent(data: ExtractedSeoData, issues: SeoIssue[]): void {
    const { wordCount } = data;
    const { minWordCount, thinContentThreshold } = SEO_THRESHOLDS.content;

    if (wordCount < thinContentThreshold) {
      issues.push({
        type: 'thin_content',
        severity: 'warning',
        message: `Page has thin content (${wordCount} words)`,
        recommendation: `Add more substantive content. Aim for at least ${minWordCount} words`
      });
    }
  }

  /**
   * Analyze internal links
   */
  private analyzeLinks(data: ExtractedSeoData, issues: SeoIssue[]): void {
    if (data.internalLinks.length === 0) {
      issues.push({
        type: 'no_internal_links',
        severity: 'warning',
        message: 'Page has no internal links',
        recommendation: 'Add internal links to help users and search engines discover related content'
      });
    }
  }

  /**
   * Analyze structured data
   */
  private analyzeStructuredData(data: ExtractedSeoData, issues: SeoIssue[]): void {
    if (data.jsonLd.length === 0) {
      issues.push({
        type: 'missing_structured_data',
        severity: 'info',
        message: 'Page has no structured data (JSON-LD)',
        recommendation: 'Add relevant structured data to improve search appearance'
      });
    }
  }

  /**
   * Analyze technical SEO elements
   */
  private analyzeTechnical(data: ExtractedSeoData, issues: SeoIssue[]): void {
    if (!data.language) {
      issues.push({
        type: 'missing_lang_attribute',
        severity: 'info',
        message: 'HTML element is missing lang attribute',
        recommendation: 'Add lang="en" (or appropriate language code) to the <html> tag'
      });
    }
  }

  /**
   * Calculate overall SEO score based on issues
   */
  private calculateScore(issues: SeoIssue[]): number {
    let score = 100;

    // Weight by severity
    const weights: Record<SeoIssue['severity'], number> = {
      error: 15,
      warning: 8,
      info: 3
    };

    for (const issue of issues) {
      score -= weights[issue.severity];
    }

    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get summary of issues by severity
   */
  getIssueSummary(issues: SeoIssue[]): {
    errors: number;
    warnings: number;
    info: number;
    total: number;
  } {
    return {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
      total: issues.length
    };
  }

  /**
   * Get issues grouped by type
   */
  getIssuesByType(issues: SeoIssue[]): Map<SeoIssueType, SeoIssue[]> {
    const grouped = new Map<SeoIssueType, SeoIssue[]>();
    
    for (const issue of issues) {
      const existing = grouped.get(issue.type) ?? [];
      existing.push(issue);
      grouped.set(issue.type, existing);
    }

    return grouped;
  }
}

export default SeoAnalyzer;
