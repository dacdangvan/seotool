/**
 * Heading Structure Detector
 * Detects issues with H1-H6 heading hierarchy
 */

import { Detector } from './base';
import {
  DetectorContext,
  DetectorResult,
  SEOIssue,
  IssueCategory,
  IssueSeverity,
} from '../models';
import { v4 as uuid } from 'uuid';

export class HeadingDetector implements Detector {
  readonly name = 'HeadingDetector';

  detect(context: DetectorContext): DetectorResult {
    const issues: SEOIssue[] = [];
    const { page, allPages } = context;

    // Check for missing H1
    if (page.h1.length === 0) {
      issues.push(this.createMissingH1Issue(page.url));
    }

    // Check for multiple H1s
    if (page.h1.length > 1) {
      issues.push(this.createMultipleH1Issue(page.url, page.h1));
    }

    // Check for empty H1
    const emptyH1s = page.h1.filter(h => h.trim() === '');
    if (emptyH1s.length > 0) {
      issues.push(this.createEmptyH1Issue(page.url));
    }

    // Check for very long H1
    const longH1s = page.h1.filter(h => h.length > 70);
    if (longH1s.length > 0) {
      issues.push(this.createLongH1Issue(page.url, longH1s[0]));
    }

    // Check for duplicate H1 across pages
    if (page.h1.length > 0) {
      const h1Text = page.h1[0];
      const pagesWithSameH1 = allPages.filter(
        p => p.url !== page.url && p.h1.includes(h1Text)
      );
      if (pagesWithSameH1.length > 0) {
        issues.push(this.createDuplicateH1Issue(page.url, h1Text, pagesWithSameH1.map(p => p.url)));
      }
    }

    // Check for missing subheadings (no H2s when content is present)
    if (page.h1.length > 0 && page.h2.length === 0) {
      // Only flag if the page seems to have substantial content
      // We don't have word count in the model, so we check by proxy
      issues.push(this.createNoSubheadingsIssue(page.url));
    }

    // Check for heading hierarchy issues (H3 without H2, etc.)
    const hasHierarchyIssue = this.checkHeadingHierarchy(page.h1.length, page.h2.length, page.h3.length);
    if (hasHierarchyIssue) {
      issues.push(this.createHierarchyIssue(page.url, page.h1.length, page.h2.length, page.h3.length));
    }

    return { issues };
  }

  private checkHeadingHierarchy(h1Count: number, h2Count: number, h3Count: number): boolean {
    // H3 without any H2 is a hierarchy issue
    if (h3Count > 0 && h2Count === 0 && h1Count > 0) {
      return true;
    }
    return false;
  }

  private createMissingH1Issue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.HEADING_STRUCTURE,
      severity: IssueSeverity.HIGH,
      title: 'Missing H1 heading',
      description: 'The page does not have an H1 heading.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'The H1 is the most important heading for SEO and accessibility.',
        seoEffect: 'Search engines use the H1 to understand the main topic of the page. Missing H1 makes it harder to rank for target keywords.',
        userEffect: 'Screen readers announce H1 as the main page heading. Missing H1 hurts accessibility.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Add a single, descriptive H1 heading.',
        steps: [
          'Add exactly one H1 tag near the top of the main content',
          'Include the primary keyword for the page',
          'Make it descriptive of the page topic',
          'Ensure it\'s different from the page title but thematically related',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Add H1 heading',
            code: '<main>\n  <h1>Your Main Page Heading</h1>\n  <!-- Page content -->\n</main>',
          },
        ],
      },
    };
  }

  private createMultipleH1Issue(url: string, h1s: string[]): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.HEADING_STRUCTURE,
      severity: IssueSeverity.MEDIUM,
      title: 'Multiple H1 headings',
      description: `The page has ${h1s.length} H1 headings. Best practice is to have exactly one.`,
      affectedUrls: [url],
      details: { h1s },
      impact: {
        summary: 'Multiple H1s can dilute the main topic signal.',
        seoEffect: 'While Google says multiple H1s are okay with HTML5, having one clear H1 provides stronger semantic clarity about the page\'s main topic.',
        userEffect: 'Screen readers announce all H1s as main headings, which can be confusing.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Consolidate to a single H1 heading.',
        steps: [
          'Choose the most important heading to be the H1',
          'Demote other H1s to H2 or lower based on content hierarchy',
          'Ensure the remaining H1 represents the main topic',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Convert extra H1s to H2s',
            code: '<!-- Before: -->\n<h1>Main Title</h1>\n<h1>Secondary Title</h1>\n\n<!-- After: -->\n<h1>Main Title</h1>\n<h2>Secondary Title</h2>',
          },
        ],
      },
    };
  }

  private createEmptyH1Issue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.HEADING_STRUCTURE,
      severity: IssueSeverity.HIGH,
      title: 'Empty H1 heading',
      description: 'The page has an H1 tag with no text content.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'An empty H1 provides no value to search engines or users.',
        seoEffect: 'Search engines cannot extract topic relevance from an empty heading.',
        userEffect: 'Screen readers will announce "heading level 1" with no content, causing confusion.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Add descriptive text to the H1 or remove it.',
        steps: [
          'If the H1 is meant to display text, add the appropriate content',
          'If the H1 is used for styling purposes only, use CSS with a different element',
          'If the H1 contains an image, add text (can be visually hidden for accessibility)',
        ],
      },
    };
  }

  private createLongH1Issue(url: string, h1: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.HEADING_STRUCTURE,
      severity: IssueSeverity.LOW,
      title: 'H1 heading too long',
      description: `The H1 heading is ${h1.length} characters. Consider keeping it under 70 characters.`,
      affectedUrls: [url],
      details: { h1, length: h1.length },
      impact: {
        summary: 'Very long H1s may dilute keyword focus.',
        seoEffect: 'While there\'s no strict limit, concise H1s typically perform better for keyword targeting.',
        userEffect: 'Long headings can overwhelm the page design.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Shorten the H1 to focus on the main topic.',
        steps: [
          'Identify the core topic or keyword',
          'Remove unnecessary words',
          'Move additional context to a subtitle or first paragraph',
        ],
      },
    };
  }

  private createDuplicateH1Issue(url: string, h1: string, duplicateUrls: string[]): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.HEADING_STRUCTURE,
      severity: IssueSeverity.MEDIUM,
      title: 'Duplicate H1 heading',
      description: `This H1 is shared with ${duplicateUrls.length} other page(s).`,
      affectedUrls: [url, ...duplicateUrls],
      details: { h1 },
      impact: {
        summary: 'Duplicate H1s suggest duplicate or similar content.',
        seoEffect: 'Each page should have a unique H1 that differentiates its content.',
        userEffect: 'Users may confuse pages with identical headings.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Create unique H1s for each page.',
        steps: [
          'Review each page\'s specific content and purpose',
          'Write distinct H1s that reflect unique value',
          'Ensure each H1 targets different keywords when appropriate',
        ],
      },
    };
  }

  private createNoSubheadingsIssue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.HEADING_STRUCTURE,
      severity: IssueSeverity.LOW,
      title: 'No subheadings (H2)',
      description: 'The page has an H1 but no H2 subheadings.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'Subheadings help break up content and provide structure.',
        seoEffect: 'H2s provide additional keyword opportunities and help search engines understand content structure.',
        userEffect: 'Long content without subheadings is harder to scan and read.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Add H2 subheadings to structure the content.',
        steps: [
          'Identify natural sections in your content',
          'Add H2 headings to introduce each section',
          'Include relevant keywords in subheadings where natural',
        ],
      },
    };
  }

  private createHierarchyIssue(url: string, h1Count: number, h2Count: number, h3Count: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.HEADING_STRUCTURE,
      severity: IssueSeverity.LOW,
      title: 'Heading hierarchy issue',
      description: `The page has heading hierarchy issues (H1: ${h1Count}, H2: ${h2Count}, H3: ${h3Count}). H3s should be nested under H2s.`,
      affectedUrls: [url],
      details: { h1Count, h2Count, h3Count },
      impact: {
        summary: 'Skipping heading levels breaks the logical document structure.',
        seoEffect: 'Search engines prefer proper heading hierarchy for understanding content relationships.',
        userEffect: 'Screen reader users rely on heading levels for navigation. Skipped levels are confusing.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Fix the heading hierarchy to follow proper nesting.',
        steps: [
          'Ensure H2s come after H1, H3s after H2s, etc.',
          'Don\'t skip levels (e.g., H1 → H3)',
          'Consider the logical structure of your content',
        ],
      },
    };
  }
}
